/**
 * Canvas Word 的绘制器。
 *
 * 职责：
 * - 根据纯文本、光标和选区完成 Canvas 全量重绘。
 * - 调用 layoutCanvasText() 生成视觉行和分页信息。
 * - 绘制页面背景、纸张、页码、选区、文本和光标。
 * - 返回最新 layout，供主组件继续做 hit test、光标定位和 textarea 定位。
 *
 * 不直接负责：
 * - React state 更新。
 * - 鼠标、键盘或 IME 事件处理。
 */
import { canvasWordLayout } from '../../medical-record/medicalRecordDocument';
import {
  drawLayoutLine,
  findCursorLine,
  layoutCanvasText,
  measureLinePrefix,
  visualOffsetForSourceCursor,
} from './canvasTextLayout';
import { createSelectionRects, normalizeSelection } from '../editing/textSelection';
import type { TextLayoutResult } from './canvasTextLayout';
import type { TextSelection } from '../editing/textSelection';

type RenderCanvasWordInput = {
  canvas: HTMLCanvasElement | null;
  text: string;
  cursor: number;
  selection: TextSelection | null;
};

type RenderCanvasWordResult = {
  layout: TextLayoutResult;
};

const minCanvasHeight = canvasWordLayout.pageHeight;

export function renderCanvasWord({ canvas, text, cursor, selection }: RenderCanvasWordInput): RenderCanvasWordResult | null {
  if (!canvas) {
    return null;
  }

  const dpr = window.devicePixelRatio || 1;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  // Measure first, then size the bitmap backing store to keep text crisp on high-DPI screens.
  const layout = layoutCanvasText(context, text);
  const cssWidth = canvasWordLayout.pageWidth;
  const cssHeight = Math.max(
    minCanvasHeight,
    layout.pages * canvasWordLayout.pageHeight + (layout.pages - 1) * canvasWordLayout.pageGap,
  );
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  // 先画编辑器背景，再画每一页白纸。
  context.fillStyle = '#e6edf2';
  context.fillRect(0, 0, cssWidth, cssHeight);

  for (let page = 0; page < layout.pages; page += 1) {
    const pageTop = page * (canvasWordLayout.pageHeight + canvasWordLayout.pageGap);
    context.fillStyle = '#ffffff';
    context.shadowColor = 'rgba(25, 39, 68, 0.16)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    context.fillRect(0, pageTop, canvasWordLayout.pageWidth, canvasWordLayout.pageHeight);
    context.shadowColor = 'transparent';
    context.strokeStyle = '#d7deeb';
    context.strokeRect(0.5, pageTop + 0.5, canvasWordLayout.pageWidth - 1, canvasWordLayout.pageHeight - 1);
    context.fillStyle = '#8a97aa';
    context.font = '12px "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(`第 ${page + 1} 页`, canvasWordLayout.pageWidth / 2, pageTop + canvasWordLayout.pageHeight - 28);
  }

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';

  const activeRange = normalizeSelection(selection);
  if (activeRange) {
    // Canvas 没有原生文本选区，需要先手动画蓝色选区矩形，再画文字。
    context.fillStyle = 'rgba(79, 142, 247, 0.26)';
    createSelectionRects(context, layout.lines, selection!).forEach((rect) => {
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    });
  }

  // 目前仅第一行使用标题色；未来富文本会把样式下沉到 block/run。
  layout.lines.forEach((line) => {
    context.fillStyle = line.start === 0 ? '#172033' : '#263248';
    drawLayoutLine(context, line);
  });

  const cursorLine = findCursorLine(layout.lines, cursor);
  if (cursorLine && !activeRange) {
    // 有选区时隐藏光标，保持和常见文字处理器一致。
    const cursorOffset = visualOffsetForSourceCursor(cursorLine, cursor);
    const cursorX = cursorLine.x + measureLinePrefix(context, cursorLine, cursorOffset);
    context.strokeStyle = '#d64545';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(cursorX, cursorLine.y - canvasWordLayout.lineHeight + 7);
    context.lineTo(cursorX, cursorLine.y + 5);
    context.stroke();
  }

  return { layout };
}
