import { useEffect, useMemo, useRef, useState } from 'react';
import { sampleRichTextDocument } from '../document/richTextDocument';
import { clearRichCanvasWordDraft, loadRichCanvasWordDraft, saveRichCanvasWordDraft } from '../document/richTextPersistence';
import { createRichTextDocumentPdfBlob } from '../document/richTextPdfExport';
import {
  serializeRichTextDocumentToJson,
  serializeRichTextDocumentToPlainText,
} from '../document/richTextSerialization';
import { findRichTextMatches, replaceRichTextSearchMatches } from '../editing/richTextSearch';
import { renderRichTextDocumentPrintPages } from '../layout/richTextPrintPages';
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
const printFrameId = 'rich-canvas-word-print-frame';

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

type UseRichCanvasWordEditorOptions = {
  autoSave?: boolean;
  defaultValue?: RichTextDocument;
  onChange?: (document: RichTextDocument) => void;
  onSave?: (document: RichTextDocument) => Promise<void> | void;
  readonly?: boolean;
  toolbarConfig?: ToolbarCommand[];
  value?: RichTextDocument;
};

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

function createExportFileName(document: RichTextDocument, extension: string) {
  const safeTitle = document.title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48);
  const date = new Date().toISOString().slice(0, 10);
  return `${safeTitle || 'rich-canvas-word'}-${date}.${extension}`;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlob(filename, blob);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function waitForFrameImages(frame: HTMLIFrameElement) {
  const images = Array.from(frame.contentDocument?.images ?? []);

  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            image.decode?.().then(() => resolve(), () => resolve()) ?? resolve();
            return;
          }

          const done = () => {
            image.decode?.().then(() => resolve(), () => resolve()) ?? resolve();
          };
          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

async function printRichCanvasDocument(document: RichTextDocument) {
  window.document.getElementById(printFrameId)?.remove();

  const pages = renderRichTextDocumentPrintPages(document);
  const frame = window.document.createElement('iframe');
  frame.id = printFrameId;
  frame.title = 'Rich Canvas Word 打印';
  frame.style.position = 'fixed';
  frame.style.left = '-100vw';
  frame.style.top = '0';
  frame.style.width = '210mm';
  frame.style.height = '297mm';
  frame.style.border = '0';

  const pageHtml = pages
    .map(
      (page) =>
        `<section class="page"><img alt="第 ${page.index + 1} 页" src="${page.src}" width="${page.width}" height="${page.height}" /></section>`,
    )
    .join('');

  frame.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(document.title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .page {
        width: 210mm;
        height: 297mm;
        margin: 0;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
        background: #fff;
      }
      .page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      img {
        display: block;
        width: 210mm;
        height: 297mm;
      }
    </style>
  </head>
  <body>${pageHtml}</body>
</html>`;

  window.document.body.appendChild(frame);

  await new Promise<void>((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true });
  });
  await waitForFrameImages(frame);

  frame.contentWindow?.focus();
  frame.contentWindow?.print();
}

// rich-canvas-word 的 editor 聚合 hook。
//
// 这里持有运行时状态，并把 history、format、clipboard、text commands 等子 hook 组装起来。
// 具体编辑算法尽量下沉到 editing/layout 模块，方便后续把这个 hook 包装成受控组件。
export function useRichCanvasWordEditor({
  autoSave = true,
  defaultValue,
  onChange,
  onSave,
  readonly = false,
  toolbarConfig,
  value,
}: UseRichCanvasWordEditorOptions = {}) {
  const isControlled = value !== undefined;
  const initialDefaultDocumentRef = useRef(defaultValue ?? value ?? sampleRichTextDocument);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const hasMountedRef = useRef(false);
  const skipNextOnChangeRef = useRef(false);
  const saveRequestIdRef = useRef(0);
  const controlledValueSnapshotRef = useRef<string | null>(value ? JSON.stringify(value) : null);
  const [initialDraft] = useState(() => (defaultValue || value ? null : loadRichCanvasWordDraft()));
  const initialDocument = value ?? initialDraft?.document ?? initialDefaultDocumentRef.current;
  const [document, setDocument] = useState<RichTextDocument>(() => initialDocument);
  const [cursor, setCursor] = useState<RichTextPosition | null>(() => getInitialRichTextPosition(initialDocument));
  const [selection, setSelection] = useState<RichTextSelection | null>(null);
  const [activeMarks, setActiveMarks] = useState<RichTextMarks>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const [richClipboard, setRichClipboard] = useState<RichTextClipboardSlice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchReplacement, setSearchReplacement] = useState('');
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
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
  const canCopy = Boolean(selection);
  const searchMatches = useMemo(() => findRichTextMatches(document, searchQuery), [document, searchQuery]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      return;
    }

    onChangeRef.current?.(document);
  }, [document]);

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

  const persistDocument = async (kind: Exclude<SaveKind, null>, options?: { showToast?: boolean }) => {
    const saveRequestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = saveRequestId;
    setIsSaving(true);

    try {
      const saveDocument = document;
      const saveSnapshot = currentDocumentSnapshot;
      const externalSave = onSaveRef.current;
      let savedAt = new Date().toISOString();

      if (externalSave) {
        await externalSave(saveDocument);
      } else {
        const result = saveRichCanvasWordDraft(saveDocument);

        if (!result.ok) {
          throw new Error('Failed to save rich canvas draft');
        }

        savedAt = result.savedAt;
      }

      if (saveRequestId !== saveRequestIdRef.current) {
        return;
      }

      setHasDocumentChangedSinceLoad(false);
      setLastSavedAt(savedAt);
      setLastSaveKind(kind);
      setSavedDocumentSnapshot(saveSnapshot);
      if (options?.showToast) {
        setToast(externalSave ? '已保存文档' : kind === 'auto' ? '已自动保存草稿' : '已保存草稿');
      }
    } catch {
      if (saveRequestId === saveRequestIdRef.current && options?.showToast) {
        setToast('保存失败，请稍后重试');
      }
    } finally {
      if (saveRequestId === saveRequestIdRef.current) {
        setIsSaving(false);
      }
    }
  };

  useEffect(() => {
    if (!autoSave || !hasUnsavedChanges) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistDocument('auto');
    }, autoSaveDelay);

    return () => window.clearTimeout(timer);
  }, [autoSave, currentDocumentSnapshot, hasUnsavedChanges]);

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

  useEffect(() => {
    if (!isControlled || !value) {
      return;
    }

    const valueSnapshot = JSON.stringify(value);
    if (valueSnapshot === controlledValueSnapshotRef.current) {
      return;
    }
    controlledValueSnapshotRef.current = valueSnapshot;

    if (valueSnapshot !== currentDocumentSnapshot) {
      skipNextOnChangeRef.current = true;
      setDocument(value);
      setCursor(getInitialRichTextPosition(value));
    }
    setSelection(null);
    setActiveMarks({});
    setSearchActiveIndex(-1);
    setHasDocumentChangedSinceLoad(false);
    setSavedDocumentSnapshot(valueSnapshot);
    resetHistory();
  }, [isControlled, resetHistory, value]);

  const { applyAlignCommand, applyFormatCommand, toolbarItems } = useRichCanvasFormatCommands({
    activeMarks,
    canCopy,
    canRedo,
    canUndo,
    commitEdit,
    cursor,
    document,
    readonly,
    selection,
    setActiveMarks,
    setToast,
    toolbarConfig,
    zoom,
  });

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

  const updateSearchQuery = (value: string) => {
    setSearchQuery(value);
    setSearchActiveIndex(-1);
  };

  const jumpToSearchMatch = (direction: 1 | -1) => {
    if (searchMatches.length === 0) {
      setToast(searchQuery.trim() ? '没有找到匹配内容' : '请输入查找内容');
      return;
    }

    const nextIndex =
      searchActiveIndex < 0
        ? direction > 0
          ? 0
          : searchMatches.length - 1
        : (searchActiveIndex + direction + searchMatches.length) % searchMatches.length;
    const match = searchMatches[nextIndex];
    if (!match) {
      return;
    }

    setSearchActiveIndex(nextIndex);
    setSelection(match.selection);
    setCursor(match.selection.focus);
  };

  const replaceCurrentSearchMatch = () => {
    if (readonly) {
      setToast('只读预览模式不可替换');
      return;
    }

    if (searchMatches.length === 0) {
      setToast(searchQuery.trim() ? '没有可替换的匹配内容' : '请输入查找内容');
      return;
    }

    const currentIndex = searchActiveIndex >= 0 ? searchActiveIndex : 0;
    const currentMatch = searchMatches[currentIndex];
    if (!currentMatch) {
      return;
    }

    const result = replaceRichTextSearchMatches(document, [currentMatch], searchReplacement);
    const nextMatches = findRichTextMatches(result.document, searchQuery);
    const nextIndex = nextMatches.length > 0 ? Math.min(currentIndex, nextMatches.length - 1) : -1;
    const nextMatch = nextIndex >= 0 ? nextMatches[nextIndex] : null;

    commitEdit(result.document, nextMatch?.selection.focus ?? result.cursor, nextMatch?.selection ?? null);
    setSearchActiveIndex(nextIndex);
    setToast('已替换当前匹配项');
  };

  const replaceAllSearchMatches = () => {
    if (readonly) {
      setToast('只读预览模式不可替换');
      return;
    }

    if (searchMatches.length === 0) {
      setToast(searchQuery.trim() ? '没有可替换的匹配内容' : '请输入查找内容');
      return;
    }

    const result = replaceRichTextSearchMatches(document, searchMatches, searchReplacement);
    const nextMatches = findRichTextMatches(result.document, searchQuery);
    const nextMatch = nextMatches[0] ?? null;

    commitEdit(result.document, nextMatch?.selection.focus ?? result.cursor, nextMatch?.selection ?? null);
    setSearchActiveIndex(nextMatch ? 0 : -1);
    setToast(`已替换 ${result.count} 处匹配`);
  };

  const exportJson = () => {
    downloadTextFile(
      createExportFileName(document, 'json'),
      serializeRichTextDocumentToJson(document),
      'application/json;charset=utf-8',
    );
    setToast('已导出 JSON');
  };

  const exportPlainText = () => {
    downloadTextFile(
      createExportFileName(document, 'txt'),
      serializeRichTextDocumentToPlainText(document),
      'text/plain;charset=utf-8',
    );
    setToast('已导出纯文本');
  };

  const openPrintPreview = () => {
    printRichCanvasDocument(document);
    setToast('请在打印对话框中选择打印或保存 PDF');
  };

  const exportPdf = async () => {
    setToast('正在生成 PDF...');

    try {
      const blob = await createRichTextDocumentPdfBlob(document);
      downloadBlob(createExportFileName(document, 'pdf'), blob);
      setToast('已导出 PDF');
    } catch {
      setToast('导出 PDF 失败，请稍后重试');
    }
  };

  const printPreview = () => {
    printRichCanvasDocument(document);
    setToast('请在打印对话框中选择打印或保存 PDF');
  };

  const handleToolbarCommand = (command: ToolbarCommand) => {
    // 工具栏在 canvas 上，点击后需要主动请求 textarea 重新聚焦，保证继续键盘输入。
    setFocusRequest((value) => value + 1);

    if (command === 'copy') {
      copySelection();
      return;
    }

    if (command === 'exportJson') {
      exportJson();
      return;
    }

    if (command === 'exportPlainText') {
      exportPlainText();
      return;
    }

    if (command === 'printPreview') {
      openPrintPreview();
      return;
    }

    if (command === 'exportPdf') {
      exportPdf();
      return;
    }

    if (readonly && command !== 'zoom') {
      setToast('只读预览模式不可编辑');
      return;
    }

    if (command === 'undo') {
      undo();
      return;
    }

    if (command === 'redo') {
      redo();
      return;
    }

    if (command === 'save') {
      void persistDocument('manual', { showToast: true });
      return;
    }

    if (command === 'resetDocument') {
      const resetDocument = initialDefaultDocumentRef.current;
      clearRichCanvasWordDraft();
      setDocument(resetDocument);
      setCursor(getInitialRichTextPosition(resetDocument));
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
    readonly,
    searchActiveIndex,
    searchMatches,
    searchMatchCount: searchMatches.length,
    searchQuery,
    searchReplacement,
    selection,
    saveStatus: readonly ? '只读预览' : isSaving ? '正在保存...' : hasUnsavedChanges ? '未保存更改' : formatSavedAt(lastSavedAt, lastSaveKind),
    toast,
    toolbarItems,
    zoom,
    cancelSelection,
    copySelection,
    cutSelection,
    deleteAfter,
    deleteBefore,
    exportJson,
    exportPdf,
    exportPlainText,
    handleToolbarCommand,
    insertText,
    pasteClipboard,
    redo,
    jumpToNextSearchMatch: () => jumpToSearchMatch(1),
    jumpToPreviousSearchMatch: () => jumpToSearchMatch(-1),
    replaceAllSearchMatches,
    replaceCurrentSearchMatch,
    openPrintPreview,
    printPreview,
    setCursor,
    setSelection,
    setSearchReplacement,
    setSearchQuery: updateSearchQuery,
    splitBlock,
    applyFormatCommand,
    undo,
  };
}
