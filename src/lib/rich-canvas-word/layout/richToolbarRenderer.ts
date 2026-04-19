import { layoutRichToolbar } from './richToolbarLayout';
import type { ToolbarItem } from '../richTypes';

// Canvas 工具栏 renderer。它只读 items 和 hover/pressed 状态并绘制，
// 不直接触发命令，也不读取编辑器 document。
type RenderRichToolbarInput = {
  canvas: HTMLCanvasElement | null;
  hoverItemId?: string | null;
  items: ToolbarItem[];
  pressedItemId?: string | null;
};

export function renderRichToolbar({ canvas, hoverItemId, items, pressedItemId }: RenderRichToolbarInput) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  if (!context || rect.width === 0) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(720, rect.width);
  const { items: layouts, height } = layoutRichToolbar(items, width);

  // 使用 DPR 放大真实画布尺寸，CSS 尺寸仍保持逻辑像素，避免 Retina 屏文字发虚。
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.height = `${height}px`;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#d9e2ea';
  context.beginPath();
  context.moveTo(0, height - 0.5);
  context.lineTo(width, height - 0.5);
  context.stroke();

  layouts.forEach((item) => {
    if (item.type === 'separator') {
      context.strokeStyle = '#d9e2ea';
      context.beginPath();
      context.moveTo(item.x + item.width / 2, item.y + 5);
      context.lineTo(item.x + item.width / 2, item.y + item.height - 5);
      context.stroke();
      return;
    }

    // active 表示当前编辑状态已启用该命令；hover/pressed 只表示鼠标交互状态。
    const isPressed = pressedItemId === item.id;
    const isHovered = hoverItemId === item.id;
    context.fillStyle = isPressed ? '#c8ece2' : item.active ? '#dff3ec' : isHovered ? '#f1f5f9' : '#ffffff';
    context.strokeStyle = item.active ? '#1f7a8c' : isHovered ? '#94a3b8' : '#cbd5df';
    context.globalAlpha = item.disabled ? 0.42 : 1;
    context.beginPath();
    context.roundRect(item.x, item.y, item.width, item.height, 7);
    context.fill();
    context.stroke();

    context.fillStyle = item.active ? '#166173' : '#172033';
    context.font = item.label === 'B' ? '700 14px Inter, Arial, sans-serif' : '700 13px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(item.label ?? '', item.x + item.width / 2, item.y + item.height / 2 + 0.5);
    context.globalAlpha = 1;

    if (item.command === 'textColor') {
      context.fillStyle = item.color ?? '#243044';
      context.fillRect(item.x + 10, item.y + item.height - 7, item.width - 20, 3);
    }

    if (item.command === 'backgroundColor') {
      context.fillStyle = item.color ?? '#ffffff';
      context.fillRect(item.x + 9, item.y + item.height - 8, item.width - 18, 4);
      context.strokeStyle = '#94a3b8';
      context.strokeRect(item.x + 9, item.y + item.height - 8, item.width - 18, 4);
    }
  });
}
