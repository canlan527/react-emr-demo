import { Dispatch, SetStateAction, useState } from 'react';
import type { RichTextDocument, RichTextMarks, RichTextPosition, RichTextSelection } from '../richTypes';

// 一次可撤销快照需要保存 document、cursor、selection 和 activeMarks。
// activeMarks 是“后续输入格式”，不在 document 中，因此必须进 history。
type RichHistorySnapshot = {
  activeMarks: RichTextMarks;
  document: RichTextDocument;
  cursor: RichTextPosition | null;
  selection: RichTextSelection | null;
};

// history 只存在运行时，不进入 document 持久化。
type RichHistoryState = {
  past: RichHistorySnapshot[];
  future: RichHistorySnapshot[];
};

const maxHistorySize = 100;

type UseRichCanvasHistoryOptions = {
  activeMarks: RichTextMarks;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  onDocumentChange?: () => void;
  selection: RichTextSelection | null;
  setActiveMarks: Dispatch<SetStateAction<RichTextMarks>>;
  setCursor: Dispatch<SetStateAction<RichTextPosition | null>>;
  setDocument: Dispatch<SetStateAction<RichTextDocument>>;
  setSelection: Dispatch<SetStateAction<RichTextSelection | null>>;
  setToast: Dispatch<SetStateAction<string>>;
};

// 管理 commit/undo/redo。
// 调用方只需要在编辑命令完成后 commitEdit；这里负责压入 past 和清空 future。
export function useRichCanvasHistory({
  activeMarks,
  cursor,
  document,
  onDocumentChange,
  selection,
  setActiveMarks,
  setCursor,
  setDocument,
  setSelection,
  setToast,
}: UseRichCanvasHistoryOptions) {
  const [history, setHistory] = useState<RichHistoryState>({ past: [], future: [] });

  // 生成“当前状态快照”，用于后续撤销或重做。
  const createCurrentSnapshot = (): RichHistorySnapshot => ({
    activeMarks,
    document,
    cursor,
    selection,
  });

  const commitEdit = (
    nextDocument: RichTextDocument,
    nextCursor: RichTextPosition | null,
    nextSelection: RichTextSelection | null = null,
  ) => {
    // 只有 document 引用变化时才记录历史；纯光标/选区移动不应污染撤销栈。
    if (nextDocument !== document) {
      setHistory((current) => ({
        past: [...current.past, createCurrentSnapshot()].slice(-maxHistorySize),
        future: [],
      }));
      onDocumentChange?.();
    }

    setDocument(nextDocument);
    setCursor(nextCursor);
    setSelection(nextSelection);
  };

  // 撤销：从 past 取最后一项恢复，并把当前状态放入 future。
  const undo = () => {
    const snapshot = history.past[history.past.length - 1];
    if (!snapshot) {
      return;
    }

    setHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [createCurrentSnapshot(), ...current.future].slice(0, maxHistorySize),
    }));
    setDocument(snapshot.document);
    setCursor(snapshot.cursor);
    setSelection(snapshot.selection);
    setActiveMarks(snapshot.activeMarks);
    onDocumentChange?.();
    setToast('已撤销操作');
  };

  // 重做：从 future 取第一项恢复，并把当前状态重新放回 past。
  const redo = () => {
    const snapshot = history.future[0];
    if (!snapshot) {
      return;
    }

    setHistory((current) => ({
      past: [...current.past, createCurrentSnapshot()].slice(-maxHistorySize),
      future: current.future.slice(1),
    }));
    setDocument(snapshot.document);
    setCursor(snapshot.cursor);
    setSelection(snapshot.selection);
    setActiveMarks(snapshot.activeMarks);
    onDocumentChange?.();
    setToast('已回退');
  };

  const resetHistory = () => {
    setHistory({ past: [], future: [] });
  };

  return {
    canRedo: history.future.length > 0,
    canUndo: history.past.length > 0,
    commitEdit,
    redo,
    resetHistory,
    undo,
  };
}
