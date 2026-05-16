import { renderRichTextDocument } from './richTextRenderer';
import { richCanvasWordLayout } from './richTextLayout';
import type { RichTextDocument } from '../richTypes';

export type RichTextPrintPageImage = {
  height: number;
  index: number;
  src: string;
  width: number;
};

export function renderRichTextDocumentPrintPages(document: RichTextDocument): RichTextPrintPageImage[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const sourceCanvas = window.document.createElement('canvas');
  const layout = renderRichTextDocument({
    canvas: sourceCanvas,
    cursor: null,
    document,
    selection: null,
    zoom: 1,
  });

  if (!layout) {
    return [];
  }

  const dpr = window.devicePixelRatio || 1;
  const { pageGap, pageHeight, pageWidth } = richCanvasWordLayout;
  const pagePixelWidth = Math.floor(pageWidth * dpr);
  const pagePixelHeight = Math.floor(pageHeight * dpr);

  return Array.from({ length: layout.pages }, (_, index) => {
    const pageCanvas = window.document.createElement('canvas');
    pageCanvas.width = pagePixelWidth;
    pageCanvas.height = pagePixelHeight;

    const context = pageCanvas.getContext('2d');
    if (context) {
      context.drawImage(
        sourceCanvas,
        0,
        Math.floor(index * (pageHeight + pageGap) * dpr),
        pagePixelWidth,
        pagePixelHeight,
        0,
        0,
        pagePixelWidth,
        pagePixelHeight,
      );
    }

    return {
      height: pageHeight,
      index,
      src: pageCanvas.toDataURL('image/png'),
      width: pageWidth,
    };
  });
}
