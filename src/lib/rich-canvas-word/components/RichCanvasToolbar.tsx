import { MouseEvent, useEffect, useRef, useState } from 'react';
import { hitTestRichToolbar, layoutRichToolbar } from '../layout/richToolbarLayout';
import { renderRichToolbar } from '../layout/richToolbarRenderer';
import type { ToolbarCommand, ToolbarItem, ToolbarItemLayout } from '../richTypes';
import './styles/RichCanvasToolbar.scss';

// Canvas 工具栏组件负责三件事：
// 1. 调用 renderer 绘制按钮。
// 2. 维护 hover/pressed 这种纯交互状态。
// 3. 通过 hit test 把 mouseup 转换成 ToolbarCommand 回调给容器层。
type RichCanvasToolbarProps = {
  items: ToolbarItem[];
  onCommand: (command: ToolbarCommand) => void;
};

export function RichCanvasToolbar({ items, onCommand }: RichCanvasToolbarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layoutsRef = useRef<ToolbarItemLayout[]>([]);
  const [hoverItemId, setHoverItemId] = useState<string | null>(null);
  const [pressedItemId, setPressedItemId] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const render = () => {
      if (canvas) {
        const width = Math.max(720, canvas.getBoundingClientRect().width);
        // layoutsRef 保存最近一次布局结果，鼠标事件直接复用它做命中测试。
        // 这样 hit test 和 renderer 使用同一套矩形，避免视觉和交互区域不一致。
        layoutsRef.current = layoutRichToolbar(items, width).items;
      }
      renderRichToolbar({ canvas, hoverItemId, items, pressedItemId });
    };

    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [hoverItemId, items, pressedItemId]);

  const hitTestFromMouseEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    // renderer 使用 canvas.style.width/height 作为逻辑坐标系，鼠标事件需要映射到同一坐标系。
    const scaleX = Number.parseFloat(canvas.style.width || `${rect.width}`) / rect.width;
    const scaleY = Number.parseFloat(canvas.style.height || `${rect.height}`) / rect.height;
    return hitTestRichToolbar(layoutsRef.current, (event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY);
  };

  return (
    <div className="rich-canvas-toolbar" aria-label="富文本工具栏">
      <canvas
        ref={canvasRef}
        aria-label="富文本 Canvas 工具栏"
        onMouseDown={(event) => {
          const item = hitTestFromMouseEvent(event);
          setPressedItemId(item?.id ?? null);
        }}
        onMouseLeave={() => {
          setHoverItemId(null);
          setPressedItemId(null);
        }}
        onMouseMove={(event) => {
          const item = hitTestFromMouseEvent(event);
          setHoverItemId(item?.id ?? null);
        }}
        onMouseUp={(event) => {
          const item = hitTestFromMouseEvent(event);
          if (item?.id && item.id === pressedItemId && item.command) {
            onCommand(item.command);
          }
          setPressedItemId(null);
        }}
      />
    </div>
  );
}
