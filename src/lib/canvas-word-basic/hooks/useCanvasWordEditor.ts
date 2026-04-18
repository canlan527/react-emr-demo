/**
 * Canvas Word v0 的编辑器状态和命令 hook。
 *
 * 职责：
 * - 管理纯文本 text、cursor、selection、toast 和撤销/重做 history。
 * - 提供插入、删除、全选、复制、剪切、粘贴、撤销、重做、重置文档等命令。
 * - 统一通过 commitTextChange() 写入历史栈。
 *
 * 不直接负责：
 * - Canvas 绘制。
 * - 鼠标命中测试。
 * - 键盘事件分发。
 * - 隐藏 textarea 的位置同步。
 */
import { useState } from 'react';
import { deleteBefore, deleteRange, insertText, replaceRange } from '../editing/textEditing';
import { normalizeSelection } from '../editing/textSelection';
import { readClipboardText, writeClipboardText } from '../editing/wordClipboard';
import { createRedoHistory, createUndoHistory, pushHistorySnapshot } from '../editing/wordHistory';
import type { TextSelection } from '../editing/textSelection';
import type { HistorySnapshot, HistoryState } from '../wordTypes';

type UseCanvasWordEditorOptions = {
  onInputReset?: () => void;
  onTransientReset?: () => void;
};

const maxHistorySize = 100;
const clampCursor = (value: number, textLength: number) => Math.max(0, Math.min(value, textLength));

export function useCanvasWordEditor(initialText: string, options: UseCanvasWordEditorOptions = {}) {
  const { onInputReset, onTransientReset } = options;
  const [text, setText] = useState(initialText);
  const [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [toast, setToast] = useState('');
  // Plain-text history is enough for the current editor; rich text will need document-level snapshots.
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });

  const resetTransientState = () => {
    onTransientReset?.();
  };

  const getSelectedText = () => {
    const range = normalizeSelection(selection);
    return range ? text.slice(range.start, range.end) : '';
  };

  // 撤销/重做恢复快照时，清空选区和输入代理，避免隐藏 textarea 留下已提交文本。
  const restoreHistorySnapshot = (snapshot: HistorySnapshot) => {
    setText(snapshot.text);
    setCursor(clampCursor(snapshot.cursor, snapshot.text.length));
    setSelection(null);
    resetTransientState();
    onInputReset?.();
  };

  // 所有会改变文本内容的入口都应走这里，统一维护历史栈、光标和选区清理。
  const commitTextChange = (nextText: string, nextCursor: number) => {
    if (nextText === text) {
      // 内容没变时仍允许移动光标，但不产生历史记录。
      setCursor(clampCursor(nextCursor, nextText.length));
      setSelection(null);
      resetTransientState();
      return;
    }

    setHistory((current) => pushHistorySnapshot(current, { text, cursor }, maxHistorySize));
    setText(nextText);
    setCursor(clampCursor(nextCursor, nextText.length));
    setSelection(null);
    resetTransientState();
  };

  // 删除当前选区并把光标放到选区起点；返回值用于键盘删除逻辑判断是否还要删单字符。
  const deleteSelection = () => {
    const range = normalizeSelection(selection);
    if (!range) {
      return false;
    }

    commitTextChange(deleteRange(text, range.start, range.end), range.start);
    return true;
  };

  const deleteBeforeCursor = () => {
    if (deleteSelection()) {
      return;
    }

    commitTextChange(deleteBefore(text, cursor), Math.max(0, cursor - 1));
  };

  const deleteAfterCursor = () => {
    if (deleteSelection()) {
      return;
    }

    commitTextChange(deleteRange(text, cursor, Math.min(text.length, cursor + 1)), cursor);
  };

  // past 栈尾是上一个状态；撤销时把当前状态推入 future，便于 redo。
  const undo = () => {
    const result = createUndoHistory(history, { text, cursor }, maxHistorySize);
    if (!result.snapshot) {
      return;
    }

    setHistory(result.history);
    restoreHistorySnapshot(result.snapshot);
    setToast('已撤销操作');
  };

  // future 栈头是下一个状态；重做时把当前状态推回 past。
  const redo = () => {
    const result = createRedoHistory(history, { text, cursor }, maxHistorySize);
    if (!result.snapshot) {
      return;
    }

    setHistory(result.history);
    restoreHistorySnapshot(result.snapshot);
    setToast('已回退');
  };

  // 统一插入入口：有选区时替换选区，没有选区时插入到光标位置。
  const replaceSelectionOrInsert = (value: string) => {
    const range = normalizeSelection(selection);
    if (range) {
      commitTextChange(replaceRange(text, range.start, range.end, value), range.start + value.length);
    } else {
      commitTextChange(insertText(text, cursor, value), cursor + value.length);
    }
  };

  const commitInput = (value: string) => {
    if (!value) {
      return;
    }

    replaceSelectionOrInsert(value);
  };

  // 全选仍然使用纯文本索引；选区矩形由 layout 层映射到各视觉行。
  const selectAllText = () => {
    setSelection({ anchor: 0, focus: text.length });
    setCursor(text.length);
    resetTransientState();
  };

  const copySelection = async () => {
    await writeClipboardText(getSelectedText());
    setToast('已复制到剪切板');
  };

  const cutSelection = async () => {
    const value = getSelectedText();
    if (!value) {
      return;
    }

    await writeClipboardText(value);
    setToast('已剪切到剪切板');
    deleteSelection();
  };

  const pasteClipboard = async () => {
    const value = await readClipboardText();
    if (value) {
      replaceSelectionOrInsert(value);
      setToast('已粘贴到文档');
    }
  };

  const resetEditorText = (nextText: string) => {
    setText(nextText);
    setCursor(0);
    setSelection(null);
    setHistory({ past: [], future: [] });
    resetTransientState();
    onInputReset?.();
  };

  return {
    text,
    cursor,
    selection,
    toast,
    history,
    setCursor,
    setSelection,
    setToast,
    commitInput,
    deleteAfterCursor,
    deleteBeforeCursor,
    deleteSelection,
    pasteClipboard,
    redo,
    replaceSelectionOrInsert,
    resetEditorText,
    selectAllText,
    undo,
    copySelection,
    cutSelection,
  };
}
