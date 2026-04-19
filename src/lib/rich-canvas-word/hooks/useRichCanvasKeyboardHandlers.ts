import { KeyboardEvent, RefObject } from 'react';
import {
  getRichDocumentBoundaryPositions,
  isSameRichTextPosition,
  normalizeRichTextSelection,
} from '../editing/richTextEditing';
import {
  getRichLineBoundaryPosition,
  moveRichTextPosition,
  moveRichTextPositionVertically,
} from '../layout/richTextLayout';
import type {
  RichTextDocument,
  RichTextFormatCommand,
  RichTextLayoutResult,
  RichTextPosition,
  RichTextSelection,
} from '../richTypes';

// textarea 键盘事件桥接。
//
// 这个 hook 只把浏览器键盘事件转换为 editor 命令：
// - 快捷键：撤销、重做、全选、复制、剪切、粘贴、格式。
// - 导航键：左右/上下/Home/End。
// - 编辑键：Backspace/Delete/Enter。

type UseRichCanvasKeyboardHandlersOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  composingRef: RefObject<boolean>;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  latestCursorRef: RefObject<RichTextPosition | null>;
  latestSelectionRef: RefObject<RichTextSelection | null>;
  layout: RichTextLayoutResult | null;
  onCancelSelection: () => void;
  onCopySelection: () => void;
  onCursorChange: (position: RichTextPosition) => void;
  onCutSelection: () => void;
  onDeleteAfter: (cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
  onDeleteBefore: (cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
  onFormatCommand: (command: RichTextFormatCommand) => void;
  onPasteClipboard: () => void;
  onRedo: () => void;
  onSelectionChange: (selection: RichTextSelection | null) => void;
  onSplitBlock: (cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
  onUndo: () => void;
  selection: RichTextSelection | null;
};

export function useRichCanvasKeyboardHandlers({
  canvasRef,
  composingRef,
  cursor,
  document,
  latestCursorRef,
  latestSelectionRef,
  layout,
  onCancelSelection,
  onCopySelection,
  onCursorChange,
  onCutSelection,
  onDeleteAfter,
  onDeleteBefore,
  onFormatCommand,
  onPasteClipboard,
  onRedo,
  onSelectionChange,
  onSplitBlock,
  onUndo,
  selection,
}: UseRichCanvasKeyboardHandlersOptions) {
  // 统一处理光标移动和 Shift 扩展选区。
  // latest refs 用于避免 React state 尚未刷新时连续键盘事件读到旧 cursor/selection。
  const moveCursor = (nextCursor: RichTextPosition | null, shouldExtendSelection: boolean) => {
    if (!nextCursor) {
      return;
    }

    const currentCursor = latestCursorRef.current ?? cursor;
    if (shouldExtendSelection && currentCursor && !isSameRichTextPosition(currentCursor, nextCursor)) {
      const nextSelection = { anchor: latestSelectionRef.current?.anchor ?? currentCursor, focus: nextCursor };
      latestSelectionRef.current = nextSelection;
      onSelectionChange(nextSelection);
    } else {
      latestSelectionRef.current = null;
      onSelectionChange(null);
    }

    latestCursorRef.current = nextCursor;
    onCursorChange(nextCursor);
  };

  // 所有键盘入口都在 textarea 上，而不是 canvas 上，因为浏览器 IME 和剪贴板快捷键依赖可聚焦输入元素。
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const context = canvasRef.current?.getContext('2d');
    if (!layout || !context) {
      return;
    }

    // composition 中不要处理普通编辑快捷键，避免拼音输入过程被误删或误提交。
    if (event.nativeEvent.isComposing || composingRef.current) {
      return;
    }

    const isCommandKey = event.metaKey || event.ctrlKey;

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancelSelection();
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        onRedo();
      } else {
        onUndo();
      }
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      onRedo();
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const boundaries = getRichDocumentBoundaryPositions(document);
      if (boundaries) {
        onSelectionChange({ anchor: boundaries.start, focus: boundaries.end });
        onCursorChange(boundaries.end);
      }
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      onFormatCommand('bold');
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'u') {
      event.preventDefault();
      onFormatCommand('underline');
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      onCopySelection();
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      onCutSelection();
      return;
    }

    if (isCommandKey && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      onPasteClipboard();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const range = normalizeRichTextSelection(document, selection);
      if (range && !event.shiftKey) {
        moveCursor(range.start, false);
      } else {
        moveCursor(moveRichTextPosition(document, cursor, -1), event.shiftKey);
      }
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const range = normalizeRichTextSelection(document, selection);
      if (range && !event.shiftKey) {
        moveCursor(range.end, false);
      } else {
        moveCursor(moveRichTextPosition(document, cursor, 1), event.shiftKey);
      }
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveCursor(getRichLineBoundaryPosition(layout, cursor, 'start'), event.shiftKey);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveCursor(getRichLineBoundaryPosition(layout, cursor, 'end'), event.shiftKey);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveCursor(moveRichTextPositionVertically(context, layout, cursor, -1), event.shiftKey);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveCursor(moveRichTextPositionVertically(context, layout, cursor, 1), event.shiftKey);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      onDeleteBefore(latestCursorRef.current, latestSelectionRef.current);
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      onDeleteAfter(latestCursorRef.current, latestSelectionRef.current);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onSplitBlock(latestCursorRef.current, latestSelectionRef.current);
      return;
    }
  };

  return {
    handleKeyDown,
  };
}
