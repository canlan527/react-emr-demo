import type { RichLayoutFragment, RichLayoutLine, RichTextLayoutResult, RichTextPosition } from '../richTypes';

// hit testing 负责把 Canvas 逻辑坐标映射回 RichTextPosition。
// 它不读取 DOM 事件，也不关心缩放；调用方需要先把鼠标坐标转换到 layout 坐标系。

// 测量 fragment 内某个 offset 前的宽度。必须使用 fragment.font，不能依赖 ctx 当前字体状态。
function measureFragmentPrefix(ctx: CanvasRenderingContext2D, fragment: RichLayoutFragment, offset: number) {
  ctx.font = fragment.font;
  const targetOffset = Math.max(fragment.startOffset, Math.min(offset, fragment.endOffset));
  let currentOffset = fragment.startOffset;
  let prefix = '';

  for (const char of Array.from(fragment.text)) {
    const nextOffset = currentOffset + char.length;
    if (nextOffset > targetOffset) {
      break;
    }

    prefix += char;
    currentOffset = nextOffset;
  }

  return ctx.measureText(prefix).width;
}

// 从 fragment 和 offset 创建逻辑 position，并把 offset 限制在 fragment 范围内。
function createPosition(fragment: RichLayoutFragment, offset: number): RichTextPosition {
  return {
    blockId: fragment.blockId,
    runId: fragment.runId,
    offset: Math.max(fragment.startOffset, Math.min(offset, fragment.endOffset)),
  };
}

// 根据 y 找视觉行。若 y 落在行间空白，选择距离最近的行，避免点击段落空隙时光标丢失。
export function findClosestLine(layout: RichTextLayoutResult, y: number) {
  return (
    layout.lines.find((line) => y >= line.y && y <= line.y + line.height) ??
    layout.lines.reduce<RichLayoutLine | null>((closest, line) => {
      if (!closest) {
        return line;
      }

      const lineDistance = Math.abs(line.y + line.height / 2 - y);
      const closestDistance = Math.abs(closest.y + closest.height / 2 - y);
      return lineDistance < closestDistance ? line : closest;
    }, null)
  );
}

// 鼠标命中：先选行，再按 fragment 字符宽度判断落在字符前还是字符后。
export function hitTestRichTextPosition(
  ctx: CanvasRenderingContext2D,
  layout: RichTextLayoutResult,
  x: number,
  y: number,
): RichTextPosition | null {
  // 鼠标命中先找最接近的视觉行，再按 fragment 和字符宽度决定 caret 落点。
  // x 落在字符左半边返回字符前，右半边返回字符后。
  const line = findClosestLine(layout, y);
  const firstFragment = line?.fragments[0];
  const lastFragment = line?.fragments[line.fragments.length - 1];

  if (!line || !firstFragment || !lastFragment) {
    return null;
  }

  if (x <= firstFragment.x) {
    return createPosition(firstFragment, firstFragment.startOffset);
  }

  if (x >= lastFragment.x + lastFragment.width) {
    return createPosition(lastFragment, lastFragment.endOffset);
  }

  for (const fragment of line.fragments) {
    if (fragment.text.length === 0) {
      continue;
    }

    if (x > fragment.x + fragment.width) {
      continue;
    }

    ctx.font = fragment.font;
    let currentX = fragment.x;
    let currentOffset = fragment.startOffset;

    for (const char of Array.from(fragment.text)) {
      const charWidth = ctx.measureText(char).width;
      const nextOffset = currentOffset + char.length;

      if (x <= currentX + charWidth) {
        return createPosition(fragment, x - currentX < charWidth / 2 ? currentOffset : nextOffset);
      }

      currentX += charWidth;
      currentOffset = nextOffset;
    }

    return createPosition(fragment, fragment.endOffset);
  }

  return createPosition(lastFragment, lastFragment.endOffset);
}

// caret/selection 也需要 prefix 测量和 position 创建；这里集中暴露，避免重复实现导致像素不一致。
export const richTextHitTestingInternals = {
  createPosition,
  measureFragmentPrefix,
};
