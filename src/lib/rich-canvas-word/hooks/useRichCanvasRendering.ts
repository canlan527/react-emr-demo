import { RefObject, useEffect, useRef, useState } from 'react';
import { deleteRichTextSelection, insertTextAtRichPosition } from '../editing/richTextEditing';
import { getRichCursorRect } from '../layout/richTextLayout';
import { renderRichTextDocument } from '../layout/richTextRenderer';
import type { RichTextDocument, RichTextLayoutResult, RichTextPosition, RichTextSelection } from '../richTypes';

type UseRichCanvasRenderingInput = {
  compositionText: string;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  focusRequest: number;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  scrollerRef?: RefObject<HTMLDivElement | null>;
  selection: RichTextSelection | null;
  zoom: number;
};

// 正文渲染和 IME 锚点 hook。
//
// 它拥有 canvas ref、textarea ref 和最新 layout：
// - document/cursor/selection/zoom 变化时重绘 canvas。
// - compositionText 存在时生成临时 preview document，用于中文输入过程中的内联预览。
// - layout 更新后根据 cursor rect 定位透明 textarea，让系统 IME 候选框跟随光标。
export function useRichCanvasRendering({
  compositionText,
  cursor,
  document,
  focusRequest,
  inputRef: externalInputRef,
  scrollerRef,
  selection,
  zoom,
}: UseRichCanvasRenderingInput) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ownedInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = externalInputRef ?? ownedInputRef;
  const [layout, setLayout] = useState<RichTextLayoutResult | null>(null);

  // textarea 是输入代理，聚焦它等于让 Canvas 编辑器进入可输入状态。
  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    // composition 期间不直接提交 document，而是先绘制预览。
    // 如果有选区，预览时先删除选区再插入 compositionText，和最终提交语义保持一致。
    const selectionPreview = compositionText && selection ? deleteRichTextSelection(document, selection) : null;
    const preview = compositionText
      ? insertTextAtRichPosition(selectionPreview?.document ?? document, selectionPreview?.cursor ?? cursor, compositionText)
      : null;
    const nextLayout = renderRichTextDocument({
      canvas: canvasRef.current,
      cursor: preview?.cursor ?? cursor,
      document: preview?.document ?? document,
      selection: compositionText ? null : selection,
      zoom,
    });
    if (nextLayout) {
      setLayout(nextLayout);
    }
  }, [compositionText, cursor, document, selection, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const input = inputRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !input || !layout) {
      return;
    }

    const cursorRect = getRichCursorRect(context, layout, cursor);
    if (!cursorRect) {
      return;
    }

    input.style.left = `${canvas.offsetLeft + cursorRect.x * zoom}px`;
    input.style.top = `${canvas.offsetTop + cursorRect.y * zoom}px`;
    input.style.height = `${Math.max(28, cursorRect.height * zoom)}px`;
  }, [cursor, layout, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef?.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !layout || !scroller) {
      return;
    }

    const cursorRect = getRichCursorRect(context, layout, cursor);
    if (!cursorRect) {
      return;
    }

    const caretTop = canvas.offsetTop + cursorRect.y * zoom;
    const caretBottom = caretTop + cursorRect.height * zoom;
    const visibleTop = scroller.scrollTop;
    const visibleBottom = visibleTop + scroller.clientHeight;
    const margin = 40;

    if (caretBottom + margin > visibleBottom) {
      scroller.scrollTop = caretBottom + margin - scroller.clientHeight;
      return;
    }

    if (caretTop - margin < visibleTop) {
      scroller.scrollTop = Math.max(0, caretTop - margin);
    }
  }, [cursor, layout, scrollerRef, zoom]);

  useEffect(() => {
    if (focusRequest > 0) {
      window.requestAnimationFrame(focusInput);
    }
  }, [focusRequest]);

  return {
    canvasRef,
    focusInput,
    inputRef,
    layout,
  };
}
