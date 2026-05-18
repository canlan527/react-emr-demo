import { useEffect, useRef } from 'react';
import { useRichCanvasCompositionHandlers } from '../hooks/useRichCanvasCompositionHandlers';
import { useRichCanvasKeyboardHandlers } from '../hooks/useRichCanvasKeyboardHandlers';
import { useRichCanvasPointerHandlers } from '../hooks/useRichCanvasPointerHandlers';
import { useRichCanvasRendering } from '../hooks/useRichCanvasRendering';
import type {
  RichTableCellSelection,
  RichTableSelection,
  RichTextDocument,
  RichTextFormatCommand,
  RichTextPosition,
  RichTextSearchMatch,
  RichTextSelection,
} from '../richTypes';
import './styles/RichCanvasWordSurface.scss';

// 正文 Surface 负责 DOM 事件和 Canvas 编辑体验的桥接。
//
// 重要边界：
// - document/cursor/selection 的真实状态由 RichCanvasWordRecord 持有。
// - Surface 持有最新 layout，用它做鼠标命中、方向键移动和 IME 锚点定位。
// - textarea 是输入代理：浏览器 IME、剪贴板快捷键和键盘事件都依赖它。
type RichCanvasWordSurfaceProps = {
  document: RichTextDocument;
  cursor: RichTextPosition | null;
  focusRequest: number;
  placeholder?: string;
  selection: RichTextSelection | null;
  tableCellSelection: RichTableCellSelection | null;
  tableSelection: RichTableSelection | null;
  toast: string;
  readonly: boolean;
  searchActiveIndex: number;
  searchMatches: RichTextSearchMatch[];
  zoom: number;
  onCancelSelection: () => void;
  onCopySelection: () => void;
  onCursorChange: (position: RichTextPosition) => void;
  onCutSelection: () => void;
  onDeleteAfter: (cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
  onDeleteBefore: (cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
  onFormatCommand: (command: RichTextFormatCommand) => void;
  onInsertText: (value: string, cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
  onPasteClipboard: () => void;
  onRedo: () => void;
  onSelectionChange: (selection: RichTextSelection | null) => void;
  onSplitBlock: (cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
  onTableCellSelectionChange: (selection: RichTableCellSelection | null) => void;
  onTableSelectionChange: (selection: RichTableSelection | null) => void;
  onUndo: () => void;
};

export function RichCanvasWordSurface({
  cursor,
  document,
  focusRequest,
  placeholder,
  selection,
  tableCellSelection,
  tableSelection,
  toast,
  readonly,
  searchActiveIndex,
  searchMatches,
  zoom,
  onCancelSelection,
  onCopySelection,
  onCursorChange,
  onCutSelection,
  onDeleteAfter,
  onDeleteBefore,
  onFormatCommand,
  onInsertText,
  onPasteClipboard,
  onRedo,
  onSelectionChange,
  onSplitBlock,
  onTableCellSelectionChange,
  onTableSelectionChange,
  onUndo,
}: RichCanvasWordSurfaceProps) {
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const latestCursorRef = useRef<RichTextPosition | null>(cursor);
  const latestSelectionRef = useRef<RichTextSelection | null>(selection);
  const compositionHandlers = useRichCanvasCompositionHandlers({
    composingRef,
    inputRef,
    latestCursorRef,
    latestSelectionRef,
    onInsertText,
    readonly,
  });
  const { canvasRef, focusInput, layout } = useRichCanvasRendering({
    compositionText: compositionHandlers.compositionText,
    cursor,
    document,
    focusRequest,
    hideCursor: readonly,
    inputRef,
    placeholder,
    scrollerRef,
    searchActiveIndex,
    searchMatches,
    selection,
    tableCellSelection,
    tableSelection,
    zoom,
  });

  useEffect(() => {
    latestCursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    latestSelectionRef.current = selection;
  }, [selection]);

  const pointerHandlers = useRichCanvasPointerHandlers({
    canvasRef,
    focusInput,
    latestCursorRef,
    latestSelectionRef,
    layout,
    onCursorChange,
    onSelectionChange,
    onTableCellSelectionChange,
    onTableSelectionChange,
    zoom,
  });

  const keyboardHandlers = useRichCanvasKeyboardHandlers({
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
    onTableSelectionChange,
    onUndo,
    readonly,
    selection,
    tableCellSelection,
  });

  return (
    <div className={`rich-canvas-surface${readonly ? ' is-readonly' : ''}`} aria-label="富文本正文画布">
      {toast ? <div className="emr-toast">{toast}</div> : null}
      <div ref={scrollerRef} className="rich-canvas-scroller">
        <textarea
          ref={inputRef}
          className={`rich-canvas-ime-input${compositionHandlers.isComposing ? ' is-composing' : ''}`}
          aria-label="Rich Canvas Word 输入代理"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          readOnly={readonly}
          aria-readonly={readonly}
          spellCheck={false}
          onCompositionEnd={compositionHandlers.handleCompositionEnd}
          onCompositionStart={compositionHandlers.handleCompositionStart}
          onCompositionUpdate={compositionHandlers.handleCompositionUpdate}
          onInput={compositionHandlers.handleInput}
          onKeyDown={keyboardHandlers.handleKeyDown}
        />
        <canvas
          ref={canvasRef}
          aria-label="Rich Canvas Word 正文"
          onDoubleClick={pointerHandlers.handleDoubleClick}
          onMouseDown={pointerHandlers.handleMouseDown}
          onMouseLeave={pointerHandlers.stopDragging}
          onMouseMove={pointerHandlers.handleMouseMove}
          onMouseUp={pointerHandlers.stopDragging}
        />
      </div>
    </div>
  );
}
