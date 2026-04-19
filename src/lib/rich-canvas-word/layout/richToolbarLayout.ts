import type { ToolbarItem, ToolbarItemLayout } from '../richTypes';

// 工具栏是单独的 Canvas，不参与正文滚动。layout 阶段只负责把配置项转换成
// 可绘制、可 hit test 的矩形区域；真正的绘制在 richToolbarRenderer.ts。
const toolbarHeight = 52;
const toolbarPaddingX = 14;
const toolbarPaddingY = 8;
const buttonHeight = 34;
const separatorWidth = 13;
const buttonGap = 7;

function measureButtonWidth(item: ToolbarItem) {
  if (item.type === 'separator') {
    return separatorWidth;
  }

  return Math.max(38, item.label.length * 9 + 24);
}

// 根据当前 canvas 宽度横向排布按钮和分隔符。
// 返回的 ToolbarItemLayout 会被 renderer 和 mouse hit test 共同使用。
export function layoutRichToolbar(items: ToolbarItem[], width: number): { items: ToolbarItemLayout[]; height: number } {
  let x = toolbarPaddingX;

  const layouts = items.map<ToolbarItemLayout>((item) => {
    const itemWidth = measureButtonWidth(item);
    const layout: ToolbarItemLayout = {
      id: item.id,
      type: item.type,
      command: item.type === 'button' ? item.command : undefined,
      label: item.type === 'button' ? item.label : undefined,
      color: item.type === 'button' ? item.color : undefined,
      active: item.type === 'button' ? Boolean(item.active) : false,
      disabled: item.type === 'button' ? Boolean(item.disabled) : false,
      x,
      y: toolbarPaddingY,
      width: item.type === 'separator' ? separatorWidth : Math.min(itemWidth, Math.max(34, width - x - toolbarPaddingX)),
      height: buttonHeight,
    };

    x += layout.width + buttonGap;
    return layout;
  });

  return { items: layouts, height: toolbarHeight };
}

// 将鼠标坐标转换为工具栏按钮。disabled 按钮不返回，避免上层重复判断。
export function hitTestRichToolbar(items: ToolbarItemLayout[], x: number, y: number) {
  return (
    items.find(
      (item) =>
        item.type === 'button' &&
        !item.disabled &&
        x >= item.x &&
        x <= item.x + item.width &&
        y >= item.y &&
        y <= item.y + item.height,
    ) ?? null
  );
}
