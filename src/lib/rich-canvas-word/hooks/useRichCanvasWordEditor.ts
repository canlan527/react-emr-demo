import { useEffect, useMemo, useState } from 'react';
import { sampleRichTextDocument } from '../document/richTextDocument';
import { clearRichCanvasWordDraft, loadRichCanvasWordDraft, saveRichCanvasWordDraft } from '../document/richTextPersistence';
import { useRichCanvasClipboardCommands } from './useRichCanvasClipboardCommands';
import { useRichCanvasFormatCommands } from './useRichCanvasFormatCommands';
import { useRichCanvasHistory } from './useRichCanvasHistory';
import { useRichCanvasTextCommands } from './useRichCanvasTextCommands';
import type {
  RichTextClipboardSlice,
  RichTextDocument,
  RichTextMarks,
  RichTextPosition,
  RichTextSelection,
  ToolbarCommand,
} from '../richTypes';

const toastDuration = 1600;
const autoSaveDelay = 1500;
const zoomLevels = [0.75, 1, 1.25, 1.5];

// 创建文档首次打开时的默认光标。当前策略是落到第一段第一个 run 的开头。
function getInitialRichTextPosition(document: RichTextDocument): RichTextPosition | null {
  const firstBlock = document.blocks[0];
  const firstRun = firstBlock?.runs[0];
  if (!firstBlock || !firstRun) {
    return null;
  }

  return {
    blockId: firstBlock.id,
    runId: firstRun.id,
    offset: 0,
  };
}

type SaveKind = 'manual' | 'auto' | null;

function formatSavedAt(value: string | null, kind: SaveKind) {
  if (!value) {
    return '尚未保存';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return kind === 'auto' ? '已自动保存' : '已保存';
  }

  const label = kind === 'auto' ? '已自动保存' : '已保存';
  return `${label} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

// rich-canvas-word 的 editor 聚合 hook。
//
// 这里持有运行时状态，并把 history、format、clipboard、text commands 等子 hook 组装起来。
// 具体编辑算法尽量下沉到 editing/layout 模块，方便后续把这个 hook 包装成受控组件。
export function useRichCanvasWordEditor() {
  const [initialDraft] = useState(() => loadRichCanvasWordDraft());
  const [document, setDocument] = useState<RichTextDocument>(() => initialDraft?.document ?? sampleRichTextDocument);
  const [cursor, setCursor] = useState<RichTextPosition | null>(() =>
    getInitialRichTextPosition(initialDraft?.document ?? sampleRichTextDocument),
  );
  const [selection, setSelection] = useState<RichTextSelection | null>(null);
  const [activeMarks, setActiveMarks] = useState<RichTextMarks>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const [richClipboard, setRichClipboard] = useState<RichTextClipboardSlice | null>(null);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState('');
  const [hasDocumentChangedSinceLoad, setHasDocumentChangedSinceLoad] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => initialDraft?.savedAt ?? null);
  const [lastSaveKind, setLastSaveKind] = useState<SaveKind>(() => (initialDraft ? 'manual' : null));
  const [isSaving, setIsSaving] = useState(false);
  const [savedDocumentSnapshot, setSavedDocumentSnapshot] = useState<string | null>(() =>
    initialDraft ? JSON.stringify(initialDraft.document) : null,
  );
  const currentDocumentSnapshot = useMemo(() => JSON.stringify(document), [document]);
  const hasUnsavedChanges = savedDocumentSnapshot
    ? currentDocumentSnapshot !== savedDocumentSnapshot
    : hasDocumentChangedSinceLoad;

  useEffect(() => {
    if (initialDraft) {
      setToast('已恢复本地草稿');
    }
  }, [initialDraft]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(''), toastDuration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const persistDraft = (kind: Exclude<SaveKind, null>, options?: { showToast?: boolean }) => {
    setIsSaving(true);

    window.setTimeout(() => {
      const result = saveRichCanvasWordDraft(document);
      setIsSaving(false);

      if (result.ok) {
        setHasDocumentChangedSinceLoad(false);
        setLastSavedAt(result.savedAt);
        setLastSaveKind(kind);
        setSavedDocumentSnapshot(currentDocumentSnapshot);
        if (options?.showToast) {
          setToast(kind === 'auto' ? '已自动保存草稿' : '已保存草稿');
        }
        return;
      }

      if (options?.showToast) {
        setToast('保存失败，请稍后重试');
      }
    }, 0);
  };

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const timer = window.setTimeout(() => {
      persistDraft('auto');
    }, autoSaveDelay);

    return () => window.clearTimeout(timer);
  }, [currentDocumentSnapshot, hasUnsavedChanges]);

  const { canRedo, canUndo, commitEdit, redo, resetHistory, undo } = useRichCanvasHistory({
    activeMarks,
    cursor,
    document,
    onDocumentChange: () => setHasDocumentChangedSinceLoad(true),
    selection,
    setActiveMarks,
    setCursor,
    setDocument,
    setSelection,
    setToast,
  });

  const { applyAlignCommand, applyFormatCommand, toolbarItems } = useRichCanvasFormatCommands({
    activeMarks,
    canRedo,
    canUndo,
    commitEdit,
    cursor,
    document,
    selection,
    setActiveMarks,
    setToast,
    zoom,
  });

  const handleToolbarCommand = (command: ToolbarCommand) => {
    // 工具栏在 canvas 上，点击后需要主动请求 textarea 重新聚焦，保证继续键盘输入。
    setFocusRequest((value) => value + 1);

    if (command === 'undo') {
      undo();
      return;
    }

    if (command === 'redo') {
      redo();
      return;
    }

    if (command === 'save') {
      persistDraft('manual', { showToast: true });
      return;
    }

    if (command === 'resetDocument') {
      clearRichCanvasWordDraft();
      setDocument(sampleRichTextDocument);
      setCursor(getInitialRichTextPosition(sampleRichTextDocument));
      setSelection(null);
      setActiveMarks({});
      setRichClipboard(null);
      setHasDocumentChangedSinceLoad(false);
      setLastSavedAt(null);
      setLastSaveKind(null);
      setIsSaving(false);
      setSavedDocumentSnapshot(null);
      resetHistory();
      setToast('已恢复示例文档，并清除本地草稿');
      return;
    }

    if (command === 'alignLeft' || command === 'alignCenter' || command === 'alignRight') {
      applyAlignCommand(command === 'alignLeft' ? 'left' : command === 'alignCenter' ? 'center' : 'right');
      return;
    }

    if (command === 'zoom') {
      setZoom((current) => {
        const currentIndex = zoomLevels.findIndex((item) => item === current);
        const nextZoom = zoomLevels[(currentIndex + 1) % zoomLevels.length] ?? 1;
        setToast(`缩放 ${Math.round(nextZoom * 100)}%`);
        return nextZoom;
      });
      return;
    }

    applyFormatCommand(command);
  };

  const { deleteAfter, deleteBefore, insertText, splitBlock } = useRichCanvasTextCommands({
    activeMarks,
    commitEdit,
    cursor,
    document,
    getInitialPosition: getInitialRichTextPosition,
    selection,
  });

  const { copySelection, cutSelection, pasteClipboard } = useRichCanvasClipboardCommands({
    commitEdit,
    cursor,
    document,
    getInitialPosition: getInitialRichTextPosition,
    insertText,
    richClipboard,
    selection,
    setRichClipboard,
    setToast,
  });

  const cancelSelection = () => {
    if (!selection) {
      return;
    }

    setSelection(null);
    setToast('已取消选择');
  };

  return {
    cursor,
    document,
    focusRequest,
    selection,
    saveStatus: isSaving ? '正在保存...' : hasUnsavedChanges ? '未保存更改' : formatSavedAt(lastSavedAt, lastSaveKind),
    toast,
    toolbarItems,
    zoom,
    cancelSelection,
    copySelection,
    cutSelection,
    deleteAfter,
    deleteBefore,
    handleToolbarCommand,
    insertText,
    pasteClipboard,
    redo,
    setCursor,
    setSelection,
    splitBlock,
    applyFormatCommand,
    undo,
  };
}
