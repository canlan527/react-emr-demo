import { useEffect, useRef } from 'react';
import { useRichCanvasCompositionHandlers } from '../hooks/useRichCanvasCompositionHandlers';
import { useRichCanvasKeyboardHandlers } from '../hooks/useRichCanvasKeyboardHandlers';
import { useRichCanvasPointerHandlers } from '../hooks/useRichCanvasPointerHandlers';
import { useRichCanvasRendering } from '../hooks/useRichCanvasRendering';
import type { RichTextDocument, RichTextFormatCommand, RichTextPosition, RichTextSelection } from '../richTypes';
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
  selection: RichTextSelection | null;
  toast: string;
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
  onUndo: () => void;
};

export function RichCanvasWordSurface({
  cursor,
  document,
  focusRequest,
  selection,
  toast,
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
  });
  const { canvasRef, focusInput, layout } = useRichCanvasRendering({
    compositionText: compositionHandlers.compositionText,
    cursor,
    document,
    focusRequest,
    inputRef,
    scrollerRef,
    selection,
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
    onUndo,
    selection,
  });

  return (
    <div className="rich-canvas-surface" aria-label="富文本正文画布">
      {toast ? <div className="emr-toast">{toast}</div> : null}
      <div ref={scrollerRef} className="rich-canvas-scroller">
        <textarea
          ref={inputRef}
          className={`rich-canvas-ime-input${compositionHandlers.isComposing ? ' is-composing' : ''}`}
          aria-label="Rich Canvas Word 输入代理"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
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
          onMouseDown={pointerHandlers.handleMouseDown}
          onMouseLeave={pointerHandlers.stopDragging}
          onMouseMove={pointerHandlers.handleMouseMove}
          onMouseUp={pointerHandlers.stopDragging}
        />
      </div>
    </div>
  );
}
