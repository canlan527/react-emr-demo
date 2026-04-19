import { MouseEvent, RefObject, useRef } from 'react';
import { isSameRichTextPosition } from '../editing/richTextEditing';
import { hitTestRichTextPosition } from '../layout/richTextLayout';
import type { RichTextLayoutResult, RichTextPosition, RichTextSelection } from '../richTypes';

type UseRichCanvasPointerHandlersOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  focusInput: () => void;
  latestCursorRef: RefObject<RichTextPosition | null>;
  latestSelectionRef: RefObject<RichTextSelection | null>;
  layout: RichTextLayoutResult | null;
  onCursorChange: (position: RichTextPosition) => void;
  onSelectionChange: (selection: RichTextSelection | null) => void;
  zoom: number;
};

export function useRichCanvasPointerHandlers({
  canvasRef,
  focusInput,
  latestCursorRef,
  latestSelectionRef,
  layout,
  onCursorChange,
  onSelectionChange,
  zoom,
}: UseRichCanvasPointerHandlersOptions) {
  const dragAnchorRef = useRef<RichTextPosition | null>(null);

  const hitTestFromMouseEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !layout) {
      return null;
    }

    // 鼠标坐标要映射到 renderer 使用的逻辑坐标系，否则 DPR/缩放下 hit test 会偏。
    const rect = canvas.getBoundingClientRect();
    const scaleX = Number.parseFloat(canvas.style.width || `${rect.width}`) / rect.width / zoom;
    const scaleY = Number.parseFloat(canvas.style.height || `${rect.height}`) / rect.height / zoom;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return hitTestRichTextPosition(context, layout, x, y);
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    const position = hitTestFromMouseEvent(event);
    if (position) {
      dragAnchorRef.current = position;
      latestCursorRef.current = position;
      latestSelectionRef.current = null;
      onCursorChange(position);
      onSelectionChange(null);
      window.requestAnimationFrame(focusInput);
    }
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const anchor = dragAnchorRef.current;
    if (!anchor) {
      return;
    }

    const position = hitTestFromMouseEvent(event);
    if (!position) {
      return;
    }

    onCursorChange(position);
    const nextSelection = isSameRichTextPosition(anchor, position) ? null : { anchor, focus: position };
    latestCursorRef.current = position;
    latestSelectionRef.current = nextSelection;
    onSelectionChange(nextSelection);
  };

  const stopDragging = () => {
    dragAnchorRef.current = null;
  };

  return {
    handleMouseDown,
    handleMouseMove,
    stopDragging,
  };
}
