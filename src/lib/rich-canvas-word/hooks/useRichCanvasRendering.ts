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
  selection: RichTextSelection | null;
  zoom: number;
};

// Rendering/IME anchor hook for the document surface.
// It owns the canvas and textarea refs plus the latest layout produced by renderer.
export function useRichCanvasRendering({
  compositionText,
  cursor,
  document,
  focusRequest,
  inputRef: externalInputRef,
  selection,
  zoom,
}: UseRichCanvasRenderingInput) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ownedInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = externalInputRef ?? ownedInputRef;
  const [layout, setLayout] = useState<RichTextLayoutResult | null>(null);

  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    // During IME composition, render an inline preview document. The textarea stays
    // transparent and only provides browser IME/candidate-window anchoring.
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
