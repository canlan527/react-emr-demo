import { getRichCursorRect, getRichSelectionRects, layoutRichTextDocument, richCanvasWordLayout } from './richTextLayout';
import { normalizeRichTextSelection } from '../editing/richTextEditing';
import type { RichTextDocument, RichTextPosition, RichTextSelection } from '../richTypes';

// 正文 Canvas renderer。
//
// renderer 的职责是“根据 document + selection + cursor 画出当前画面”，
// 并把最新 layout 返回给 React 层。它不直接修改 editor state。
type RenderRichTextInput = {
  canvas: HTMLCanvasElement | null;
  document: RichTextDocument;
  cursor: RichTextPosition | null;
  selection: RichTextSelection | null;
  zoom: number;
};

export function renderRichTextDocument({ canvas, document, cursor, selection, zoom }: RenderRichTextInput) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const layout = layoutRichTextDocument(context, document);
  const dpr = window.devicePixelRatio || 1;
  const { pageWidth, pageHeight, pageGap } = richCanvasWordLayout;

  // Canvas 不能只靠 CSS 放大，否则浏览器会拉伸已有位图导致文字发糊。
  // 真实绘制缓冲区同时乘以 zoom，绘制时再用 dpr * zoom 映射回逻辑坐标。
  canvas.width = Math.floor(pageWidth * zoom * dpr);
  canvas.height = Math.floor(layout.height * zoom * dpr);
  canvas.style.width = `${pageWidth * zoom}px`;
  canvas.style.height = `${layout.height * zoom}px`;

  context.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
  context.clearRect(0, 0, pageWidth, layout.height);

  context.fillStyle = '#e6edf2';
  context.fillRect(0, 0, pageWidth, layout.height);

  // 页面背景和纸张先画，后续选区、文字、光标都叠在纸张上。
  for (let page = 0; page < layout.pages; page += 1) {
    const pageY = page * (pageHeight + pageGap);
    context.fillStyle = '#ffffff';
    context.shadowColor = 'rgba(15, 23, 42, 0.14)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 5;
    context.fillRect(0, pageY, pageWidth, pageHeight);
    context.shadowColor = 'transparent';
    context.strokeStyle = '#d9e2ea';
    context.strokeRect(0.5, pageY + 0.5, pageWidth - 1, pageHeight - 1);

    context.fillStyle = '#94a3b8';
    context.font = '12px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(`${page + 1}`, pageWidth / 2, pageY + pageHeight - 28);
  }

  // 选区必须在文字之前绘制，避免高亮盖住文字。
  const activeSelection = normalizeRichTextSelection(document, selection);

  getRichSelectionRects(context, layout, document, selection).forEach((rect) => {
    context.fillStyle = 'rgba(37, 99, 235, 0.2)';
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  });

  layout.lines.forEach((line) => {
    line.fragments.forEach((fragment) => {
      context.font = fragment.font;
      context.textBaseline = 'alphabetic';
      context.textAlign = 'left';

      // 背景高亮按整条视觉行高度绘制，而不是按单个字体 ascent/descent，
      // 这样混合字号时高亮区域更稳定。
      if (fragment.marks.backgroundColor) {
        context.fillStyle = fragment.marks.backgroundColor;
        context.fillRect(fragment.x - 2, line.y + 5, fragment.width + 4, line.height - 10);
      }

      context.fillStyle = fragment.marks.color ?? '#243044';
      context.fillText(fragment.text, fragment.x, line.baseline);

      if (fragment.marks.underline) {
        context.strokeStyle = fragment.marks.color ?? '#243044';
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(fragment.x, line.baseline + 3);
        context.lineTo(fragment.x + fragment.width, line.baseline + 3);
        context.stroke();
      }
    });
  });

  const cursorRect = activeSelection ? null : getRichCursorRect(context, layout, cursor);
  if (cursorRect) {
    context.strokeStyle = '#d9534f';
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(cursorRect.x + 0.5, cursorRect.y);
    context.lineTo(cursorRect.x + 0.5, cursorRect.y + cursorRect.height);
    context.stroke();
  }

  return layout;
}
