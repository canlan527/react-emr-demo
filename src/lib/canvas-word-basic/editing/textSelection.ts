/**
 * Canvas Word 的选区工具模块。
 *
 * 职责：
 * - 归一化 anchor/focus 选区。
 * - 根据 layout 视觉行生成 Canvas 选区高亮矩形。
 *
 * 不直接负责：
 * - 鼠标事件处理。
 * - 修改 selection state。
 * - 复制/剪切的文本读取。
 */
import { canvasWordLayout } from '../../medical-record/medicalRecordDocument';
import { measureLinePrefix, visualOffsetForSourceCursor } from '../layout/canvasTextLayout';
import type { LayoutLine } from '../layout/canvasTextLayout';

export type TextSelection = {
  anchor: number;
  focus: number;
  anchorLineIndex?: number;
  anchorOffset?: number;
  focusLineIndex?: number;
  focusOffset?: number;
};

export type TextRange = {
  start: number;
  end: number;
};

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizeSelection(selection: TextSelection | null): TextRange | null {
  if (!selection || selection.anchor === selection.focus) {
    return null;
  }

  return {
    start: Math.min(selection.anchor, selection.focus),
    end: Math.max(selection.anchor, selection.focus),
  };
}

function lineContentWidth() {
  return canvasWordLayout.pageWidth - canvasWordLayout.marginX * 2;
}

function lineRect(line: LayoutLine, x: number, width: number): SelectionRect {
  return {
    x,
    y: line.y - canvasWordLayout.lineHeight + 6,
    width: Math.max(2, width),
    height: canvasWordLayout.lineHeight,
  };
}

function selectedLineBounds(line: LayoutLine, range: TextRange) {
  const minSource = Math.min(...line.sourceIndexes);
  const maxSource = Math.max(...line.sourceIndexes);
  if (!Number.isFinite(minSource) || !Number.isFinite(maxSource) || range.end <= minSource || range.start > maxSource) {
    return null;
  }

  const startOffset = visualOffsetForSourceCursor(line, Math.max(range.start, minSource));
  const endOffset = visualOffsetForSourceCursor(line, Math.min(range.end, maxSource + 1));
  return startOffset === endOffset ? null : { startOffset: Math.min(startOffset, endOffset), endOffset: Math.max(startOffset, endOffset) };
}

export function createSelectionRects(
  ctx: CanvasRenderingContext2D,
  lines: LayoutLine[],
  selection: TextSelection,
): SelectionRect[] {
  const range = normalizeSelection(selection);
  if (!range) {
    return [];
  }

  const selectedLineIndexes = lines
    .filter((line) => selectedLineBounds(line, range))
    .map((line) => line.lineIndex);
  if (selectedLineIndexes.length === 0) {
    return [];
  }

  const firstSelectedLine = Math.min(...selectedLineIndexes);
  const lastSelectedLine = Math.max(...selectedLineIndexes);

  return lines.flatMap((line) => {
    const fullWidth = lineContentWidth();
    const bounds = selectedLineBounds(line, range);
    const isBetweenSelectedLines = line.lineIndex > firstSelectedLine && line.lineIndex < lastSelectedLine;

    if (!bounds && !isBetweenSelectedLines) {
      return [];
    }

    if (line.lineIndex === firstSelectedLine && line.lineIndex === lastSelectedLine && bounds) {
      const startOffset = bounds.startOffset;
      const endOffset = bounds.endOffset;
      const anchorIsStart = selection.anchor <= selection.focus;
      const visualStartOffset =
        selection.anchorLineIndex === line.lineIndex && anchorIsStart && selection.anchorOffset !== undefined
          ? selection.anchorOffset
          : selection.focusLineIndex === line.lineIndex && !anchorIsStart && selection.focusOffset !== undefined
            ? selection.focusOffset
            : startOffset;
      const visualEndOffset =
        selection.focusLineIndex === line.lineIndex && anchorIsStart && selection.focusOffset !== undefined
          ? selection.focusOffset
          : selection.anchorLineIndex === line.lineIndex && !anchorIsStart && selection.anchorOffset !== undefined
            ? selection.anchorOffset
            : endOffset;
      const visualStart = line.x + measureLinePrefix(ctx, line, visualStartOffset);
      const visualEnd = line.x + measureLinePrefix(ctx, line, visualEndOffset);
      const x = Math.min(visualStart, visualEnd);
      const right = Math.max(visualStart, visualEnd);
      return [lineRect(line, x, right - x)];
    }

    if (line.lineIndex === firstSelectedLine && bounds) {
      const startOffset = bounds.startOffset;
      const anchorIsStart = selection.anchor <= selection.focus;
      const visualStartOffset =
        selection.anchorLineIndex === line.lineIndex && anchorIsStart && selection.anchorOffset !== undefined
          ? selection.anchorOffset
          : selection.focusLineIndex === line.lineIndex && !anchorIsStart && selection.focusOffset !== undefined
            ? selection.focusOffset
            : startOffset;
      const x = line.x + measureLinePrefix(ctx, line, visualStartOffset);
      return [lineRect(line, x, line.x + fullWidth - x)];
    }

    if (line.lineIndex === lastSelectedLine && bounds) {
      const endOffset = bounds.endOffset;
      const anchorIsStart = selection.anchor <= selection.focus;
      const visualEndOffset =
        selection.focusLineIndex === line.lineIndex && anchorIsStart && selection.focusOffset !== undefined
          ? selection.focusOffset
          : selection.anchorLineIndex === line.lineIndex && !anchorIsStart && selection.anchorOffset !== undefined
            ? selection.anchorOffset
            : endOffset;
      const right = line.x + measureLinePrefix(ctx, line, visualEndOffset);
      return [lineRect(line, line.x, right - line.x)];
    }

    return [lineRect(line, line.x, fullWidth)];
  });
}
