import type { RichLayoutFragment, RichLayoutLine, RichTextLayoutResult, RichTextPosition } from '../richTypes';

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

function createPosition(fragment: RichLayoutFragment, offset: number): RichTextPosition {
  return {
    blockId: fragment.blockId,
    runId: fragment.runId,
    offset: Math.max(fragment.startOffset, Math.min(offset, fragment.endOffset)),
  };
}

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

export const richTextHitTestingInternals = {
  createPosition,
  measureFragmentPrefix,
};
