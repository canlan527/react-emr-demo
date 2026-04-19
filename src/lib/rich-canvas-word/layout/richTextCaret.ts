import type {
  RichCursorRect,
  RichLayoutFragment,
  RichLayoutLine,
  RichTextDocument,
  RichTextLayoutResult,
  RichTextPosition,
  RichTextSelection,
} from '../richTypes';
import { compareRichTextPositions, normalizeRichTextSelection } from '../editing/richTextEditing';
import { hitTestRichTextPosition, richTextHitTestingInternals } from './richTextHitTesting';

const { createPosition, measureFragmentPrefix } = richTextHitTestingInternals;

// caret 模块负责所有“position <-> 光标/选区几何”的逻辑。
// 横向移动基于 document 顺序，纵向移动基于 layout 视觉行。

function getOrderedRuns(document: RichTextDocument) {
  return document.blocks.flatMap((block) => block.runs.map((run) => ({ block, run })));
}

function getTextBoundaries(text: string) {
  const boundaries = [0];
  let offset = 0;

  Array.from(text).forEach((char) => {
    offset += char.length;
    boundaries.push(offset);
  });

  return boundaries;
}

// 左右方向键移动：按 Unicode 字符边界移动，跨 run 时跳过视觉上重合的边界。
export function moveRichTextPosition(
  document: RichTextDocument,
  position: RichTextPosition | null,
  direction: -1 | 1,
): RichTextPosition | null {
  // 左右移动按 Unicode 字符边界前进。跨 run 时跳过视觉上重合的 run 边界，
  // 避免用户需要多按一次方向键才能看到光标移动。
  const runs = getOrderedRuns(document);
  const currentIndex = position ? runs.findIndex(({ run }) => run.id === position.runId) : -1;
  const current = currentIndex >= 0 ? runs[currentIndex] : runs[0];

  if (!current) {
    return null;
  }

  const currentOffset = position?.runId === current.run.id ? position.offset : 0;
  const boundaries = getTextBoundaries(current.run.text);

  if (direction < 0) {
    const previousOffset = [...boundaries].reverse().find((offset) => offset < currentOffset);
    if (previousOffset !== undefined) {
      return { blockId: current.block.id, runId: current.run.id, offset: previousOffset };
    }

    const previous = runs[currentIndex - 1];
    if (!previous) {
      return { blockId: current.block.id, runId: current.run.id, offset: 0 };
    }

    // The previous run's end and current run's start are the same visual caret position.
    // Move to the previous real character boundary so ArrowLeft does not appear to stall at run edges.
    const previousRunBoundaries = getTextBoundaries(previous.run.text);
    const previousVisualOffset = previousRunBoundaries[Math.max(0, previousRunBoundaries.length - 2)] ?? 0;
    return { blockId: previous.block.id, runId: previous.run.id, offset: previousVisualOffset };
  }

  const nextOffset = boundaries.find((offset) => offset > currentOffset);
  if (nextOffset !== undefined) {
    return { blockId: current.block.id, runId: current.run.id, offset: nextOffset };
  }

  const next = runs[currentIndex + 1];
  if (!next) {
    return { blockId: current.block.id, runId: current.run.id, offset: current.run.text.length };
  }

  // The current run's end and next run's start are the same visual caret position.
  // Move to the next real character boundary so ArrowRight does not require an extra key press.
  const nextRunOffset = getTextBoundaries(next.run.text).find((offset) => offset > 0) ?? 0;
  return { blockId: next.block.id, runId: next.run.id, offset: nextRunOffset };
}

// 判断 position 是否落在某个 fragment 覆盖的 run 区间内。
function isPositionInFragment(position: RichTextPosition, fragment: RichLayoutFragment) {
  return position.runId === fragment.runId && position.offset >= fragment.startOffset && position.offset <= fragment.endOffset;
}

function findLineByPosition(layout: RichTextLayoutResult, position: RichTextPosition) {
  return layout.lines.find((line) => line.fragments.some((fragment) => isPositionInFragment(position, fragment))) ?? null;
}

function getCursorXInLine(ctx: CanvasRenderingContext2D, line: RichLayoutLine, position: RichTextPosition) {
  for (const fragment of line.fragments) {
    if (!isPositionInFragment(position, fragment)) {
      continue;
    }

    return fragment.x + measureFragmentPrefix(ctx, fragment, position.offset);
  }

  return line.x;
}

// 获取当前视觉行的行首或行尾 position，用于 Home/End。
export function getRichLineBoundaryPosition(
  layout: RichTextLayoutResult,
  position: RichTextPosition | null,
  boundary: 'start' | 'end',
): RichTextPosition | null {
  const line = position ? findLineByPosition(layout, position) : layout.lines[0];
  const fragment = boundary === 'start' ? line?.fragments[0] : line?.fragments[line.fragments.length - 1];

  if (!fragment) {
    return null;
  }

  return createPosition(fragment, boundary === 'start' ? fragment.startOffset : fragment.endOffset);
}

// 上下方向键：保持当前 x 坐标，在上一/下一视觉行执行一次 hit test。
export function moveRichTextPositionVertically(
  ctx: CanvasRenderingContext2D,
  layout: RichTextLayoutResult,
  position: RichTextPosition | null,
  direction: -1 | 1,
): RichTextPosition | null {
  // 上下移动保持当前光标 x 坐标，再在目标视觉行上做一次 hit test。
  const currentLine = position ? findLineByPosition(layout, position) : layout.lines[0];
  if (!currentLine) {
    return null;
  }

  const targetLine = layout.lines[currentLine.lineIndex + direction];
  if (!targetLine) {
    const boundary = direction < 0 ? 'start' : 'end';
    return getRichLineBoundaryPosition(layout, position, boundary);
  }

  const targetX = position ? getCursorXInLine(ctx, currentLine, position) : targetLine.x;
  return hitTestRichTextPosition(ctx, layout, targetX, targetLine.y + targetLine.height / 2);
}

// 根据 position 生成光标矩形。找不到精确 fragment 时，会退到同 run 最近 fragment，避免光标消失。
export function getRichCursorRect(
  ctx: CanvasRenderingContext2D,
  layout: RichTextLayoutResult,
  position: RichTextPosition | null,
): RichCursorRect | null {
  // 光标矩形由 position 反查 layout fragment 得到，供 renderer 和 IME textarea 定位使用。
  if (!position) {
    return null;
  }

  let closestSameRun:
    | {
        distance: number;
        fragment: RichLayoutFragment;
        line: RichLayoutLine;
        offset: number;
      }
    | null = null;

  for (const line of layout.lines) {
    for (const fragment of line.fragments) {
      if (fragment.runId !== position.runId) {
        continue;
      }

      if (position.offset >= fragment.startOffset && position.offset <= fragment.endOffset) {
        return {
          x: fragment.x + measureFragmentPrefix(ctx, fragment, position.offset),
          y: line.y + 4,
          height: Math.max(16, line.height - 8),
        };
      }

      const clampedOffset = Math.max(fragment.startOffset, Math.min(position.offset, fragment.endOffset));
      const distance = Math.abs(position.offset - clampedOffset);
      if (!closestSameRun || distance < closestSameRun.distance) {
        closestSameRun = {
          distance,
          fragment,
          line,
          offset: clampedOffset,
        };
      }
    }
  }

  // 某些 position 可能落在软换行、被跳过的空白或 run 归一化后的边缘。
  // 此时仍应在同 run 最近的可见 fragment 上绘制光标，而不是让光标消失。
  if (closestSameRun) {
    return {
      x: closestSameRun.fragment.x + measureFragmentPrefix(ctx, closestSameRun.fragment, closestSameRun.offset),
      y: closestSameRun.line.y + 4,
      height: Math.max(16, closestSameRun.line.height - 8),
    };
  }

  return null;
}

// 根据 selection 生成多段矩形。矩形只用于绘制，高层复制/删除仍使用 source selection。
export function getRichSelectionRects(
  ctx: CanvasRenderingContext2D,
  layout: RichTextLayoutResult,
  document: RichTextDocument,
  selection: RichTextSelection | null,
) {
  // 选区矩形只基于 layout line/fragment 生成；复制/删除语义仍由 source position 决定。
  const range = normalizeRichTextSelection(document, selection);
  if (!range) {
    return [];
  }

  return layout.lines.flatMap((line) =>
    line.fragments.flatMap((fragment) => {
      const fragmentStart = createPosition(fragment, fragment.startOffset);
      const fragmentEnd = createPosition(fragment, fragment.endOffset);
      const startsBeforeRangeEnd = compareRichTextPositions(document, fragmentStart, range.end) < 0;
      const endsAfterRangeStart = compareRichTextPositions(document, fragmentEnd, range.start) > 0;

      if (!startsBeforeRangeEnd || !endsAfterRangeStart) {
        return [];
      }

      const selectionStartOffset =
        fragment.runId === range.start.runId ? Math.max(fragment.startOffset, range.start.offset) : fragment.startOffset;
      const selectionEndOffset =
        fragment.runId === range.end.runId ? Math.min(fragment.endOffset, range.end.offset) : fragment.endOffset;

      if (selectionEndOffset <= selectionStartOffset) {
        return [];
      }

      const startX = fragment.x + measureFragmentPrefix(ctx, fragment, selectionStartOffset);
      const endX = fragment.x + measureFragmentPrefix(ctx, fragment, selectionEndOffset);

      return [
        {
          x: startX,
          y: line.y + 4,
          width: Math.max(1, endX - startX),
          height: Math.max(16, line.height - 8),
        },
      ];
    }),
  );
}
