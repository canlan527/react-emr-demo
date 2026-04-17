import { canvasWordLayout } from './medicalRecordDocument';

export type LayoutLine = {
  text: string;
  start: number;
  end: number;
  sourceIndexes: number[];
  font: string;
  x: number;
  y: number;
  page: number;
  lineIndex: number;
  letterSpacing: number;
};

type DraftLine = {
  text: string;
  start: number;
  end: number;
  sourceIndexes: number[];
  paragraphLineIndex: number;
  looseTextSpacing?: boolean;
};

type PunctuationKind = 'chinese' | 'english';

type LeadingPunctuationRun = {
  text: string;
  kind: PunctuationKind;
};

type BreakCandidate = {
  index: number;
  kind: 'space' | 'punctuation';
};

export type TextLayoutResult = {
  lines: LayoutLine[];
  pages: number;
};

const chineseLineStartPunctuation = new Set(
  Array.from('，。！？；：、）】》」』〕〉〗〙〛”’…—'),
);

const englishLineStartPunctuation = new Set(Array.from(',.!?;:)]}>"\'%'));

const acceptablePunctuationGap = 48;

function getPunctuationKind(char: string): PunctuationKind | null {
  if (chineseLineStartPunctuation.has(char)) {
    return 'chinese';
  }

  if (englishLineStartPunctuation.has(char)) {
    return 'english';
  }

  return null;
}

function readLeadingPunctuation(text: string): LeadingPunctuationRun | null {
  let value = '';
  let kind: PunctuationKind | null = null;

  for (const char of text) {
    const charKind = getPunctuationKind(char);
    if (!charKind) {
      break;
    }

    value += char;
    kind = kind ?? charKind;
  }

  return value ? { text: value, kind: kind ?? 'chinese' } : null;
}

function takeLastChar(text: string) {
  return Array.from(text).at(-1) ?? '';
}

function removeLastChar(text: string) {
  const chars = Array.from(text);
  chars.pop();
  return chars.join('');
}

function createSourceIndexes(start: number, text: string) {
  let cursor = start;
  return Array.from(text).map((char) => {
    const index = cursor;
    cursor += char.length;
    return index;
  });
}

function calculateLetterSpacing(ctx: CanvasRenderingContext2D, line: DraftLine, maxWidth: number) {
  const chars = Array.from(line.text);
  if (!line.looseTextSpacing || chars.length <= 1) {
    return 0;
  }

  const looseSpace = (maxWidth - ctx.measureText(line.text).width) / (chars.length - 1);
  return Math.max(0, Math.min(looseSpace, 6));
}

function readBreakCandidate(char: string, index: number): BreakCandidate | null {
  if (/\s/.test(char)) {
    return { index, kind: 'space' };
  }

  if (getPunctuationKind(char)) {
    return { index, kind: 'punctuation' };
  }

  return null;
}

function chooseBreakIndex(
  ctx: CanvasRenderingContext2D,
  paragraph: string,
  lineStart: number,
  overflowIndex: number,
  candidate: BreakCandidate | null,
  maxWidth: number,
) {
  const fallbackIndex = Math.max(lineStart + 1, overflowIndex - 1);
  if (!candidate || candidate.index <= lineStart) {
    return fallbackIndex;
  }

  if (candidate.kind === 'space') {
    return candidate.index;
  }

  const candidateLine = paragraph.slice(lineStart, candidate.index);
  const remainingWidth = maxWidth - ctx.measureText(candidateLine).width;

  // 中文输入时，离当前溢出点很远的旧标点不应把整段新文字搬到下一行。
  return remainingWidth <= acceptablePunctuationGap ? candidate.index : fallbackIndex;
}

function normalizeLineStartPunctuation(lines: DraftLine[]) {
  return lines.map((line, index, allLines) => {
    if (index === 0) {
      return line;
    }

    const punctuation = readLeadingPunctuation(line.text);
    const previousLine = allLines[index - 1];
    if (!punctuation || !previousLine) {
      return line;
    }

    // 单个避头标点直接悬挂到上一行结尾，避免新行以标点开头。
    if (Array.from(punctuation.text).length === 1) {
      previousLine.text += punctuation.text;
      previousLine.end += punctuation.text.length;
      previousLine.sourceIndexes.push(...line.sourceIndexes.slice(0, Array.from(punctuation.text).length));
      line.text = line.text.slice(punctuation.text.length);
      line.sourceIndexes = line.sourceIndexes.slice(Array.from(punctuation.text).length);
      line.start += punctuation.text.length;
      return line;
    }

    // 多个标点开头时，不把整串标点塞回上一行；按中文排版习惯把上一行最后一字带到当前行。
    const movedChar = takeLastChar(previousLine.text);
    if (movedChar) {
      previousLine.text = removeLastChar(previousLine.text);
      const movedIndex = previousLine.sourceIndexes.pop();
      previousLine.end -= movedChar.length;
      previousLine.looseTextSpacing = true;
      line.text = `${movedChar}${line.text}`;
      line.sourceIndexes = movedIndex === undefined ? line.sourceIndexes : [movedIndex, ...line.sourceIndexes];
      line.start -= movedChar.length;
    }

    return line;
  });
}

function createParagraphLines(ctx: CanvasRenderingContext2D, paragraph: string, paragraphStart: number, maxWidth: number) {
  const lines: DraftLine[] = [];

  if (paragraph.length === 0) {
    return [{ text: '', start: paragraphStart, end: paragraphStart, sourceIndexes: [], paragraphLineIndex: 0 }];
  }

  const pushLine = (text: string, start: number, end: number) => {
    lines.push({
      text,
      start,
      end,
      sourceIndexes: createSourceIndexes(start, text),
      paragraphLineIndex: lines.length,
    });
  };

  let lineStart = 0;
  let lastBreak: BreakCandidate | null = null;

  for (let index = 1; index <= paragraph.length; index += 1) {
    const slice = paragraph.slice(lineStart, index);
    if (ctx.measureText(slice).width <= maxWidth) {
      lastBreak = readBreakCandidate(paragraph[index - 1] ?? '', index) ?? lastBreak;
      continue;
    }

    const breakIndex = chooseBreakIndex(ctx, paragraph, lineStart, index, lastBreak, maxWidth);
    pushLine(paragraph.slice(lineStart, breakIndex), paragraphStart + lineStart, paragraphStart + breakIndex);
    lineStart = paragraph[breakIndex] === ' ' ? breakIndex + 1 : breakIndex;
    lastBreak = null;
  }

  pushLine(paragraph.slice(lineStart), paragraphStart + lineStart, paragraphStart + paragraph.length);
  return lines;
}

export function layoutCanvasText(ctx: CanvasRenderingContext2D, text: string): TextLayoutResult {
  const { marginX, marginY, pageHeight, pageGap, pageWidth, lineHeight, font } = canvasWordLayout;
  const maxWidth = pageWidth - marginX * 2;
  const lines: LayoutLine[] = [];
  let page = 0;
  let y = marginY;
  let lineIndex = 0;
  let textCursor = 0;

  ctx.font = font;

  const pushLine = (draftLine: DraftLine) => {
    if (y + lineHeight > pageHeight - marginY) {
      page += 1;
      y = marginY;
    }

    const lineFont = draftLine.start === 0 ? canvasWordLayout.titleFont : font;
    ctx.font = lineFont;

    // Store each visual line's real font so cursor, selection and drawing all measure the same glyph widths.
    lines.push({
      text: draftLine.text,
      start: draftLine.start,
      end: draftLine.end,
      sourceIndexes: draftLine.sourceIndexes,
      font: lineFont,
      x: marginX,
      y: page * (pageHeight + pageGap) + y,
      page,
      lineIndex,
      letterSpacing: calculateLetterSpacing(ctx, draftLine, maxWidth),
    });
    y += lineHeight;
    lineIndex += 1;
  };

  const draftLines: DraftLine[] = [];

  text.split('\n').forEach((paragraph, paragraphIndex, paragraphs) => {
    draftLines.push(...createParagraphLines(ctx, paragraph, textCursor, maxWidth));
    textCursor += paragraph.length + (paragraphIndex === paragraphs.length - 1 ? 0 : 1);
  });

  normalizeLineStartPunctuation(draftLines).forEach(pushLine);

  return {
    lines,
    pages: Math.max(1, lines[lines.length - 1] ? lines[lines.length - 1].page + 1 : 1),
  };
}

export function findCursorLine(lines: LayoutLine[], cursor: number) {
  return (
    lines.find((line) => cursor >= line.start && cursor <= line.end) ??
    lines.find((line) => cursor < line.start) ??
    lines[lines.length - 1]
  );
}

export function fitIndexInLine(ctx: CanvasRenderingContext2D, line: LayoutLine, x: number) {
  if (x <= line.x) {
    return sourceCursorForVisualOffset(line, 0);
  }

  for (let index = 1; index <= line.text.length; index += 1) {
    const prefixWidth = measureLinePrefix(ctx, line, index);
    if (line.x + prefixWidth >= x) {
      const previousWidth = measureLinePrefix(ctx, line, index - 1);
      return x - (line.x + previousWidth) < line.x + prefixWidth - x
        ? sourceCursorForVisualOffset(line, index - 1)
        : sourceCursorForVisualOffset(line, index);
    }
  }

  return sourceCursorForVisualOffset(line, Array.from(line.text).length);
}

export function sourceCursorForVisualOffset(line: LayoutLine, visualOffset: number) {
  const chars = Array.from(line.text);
  const safeOffset = Math.max(0, Math.min(visualOffset, chars.length));

  if (safeOffset === 0) {
    return line.sourceIndexes[0] ?? line.start;
  }

  if (safeOffset >= chars.length) {
    const lastIndex = line.sourceIndexes[chars.length - 1];
    const lastChar = chars[chars.length - 1];
    return lastIndex === undefined || lastChar === undefined ? line.end : lastIndex + lastChar.length;
  }

  return line.sourceIndexes[safeOffset] ?? line.start + safeOffset;
}

export function visualOffsetForSourceCursor(line: LayoutLine, cursor: number) {
  const chars = Array.from(line.text);
  if (chars.length === 0) {
    return 0;
  }

  let closestOffset = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let offset = 0; offset <= chars.length; offset += 1) {
    const sourceCursor = sourceCursorForVisualOffset(line, offset);
    const distance = Math.abs(sourceCursor - cursor);
    if (distance < closestDistance) {
      closestOffset = offset;
      closestDistance = distance;
    }
  }

  return closestOffset;
}

export function measureLinePrefix(ctx: CanvasRenderingContext2D, line: LayoutLine, charCount: number) {
  ctx.font = line.font;
  const chars = Array.from(line.text);
  const safeCount = Math.max(0, Math.min(charCount, chars.length));
  if (safeCount === 0) {
    return 0;
  }

  const prefix = chars.slice(0, safeCount).join('');
  const spacingCount = Math.min(safeCount, Math.max(0, chars.length - 1));
  return ctx.measureText(prefix).width + spacingCount * line.letterSpacing;
}

export function drawLayoutLine(ctx: CanvasRenderingContext2D, line: LayoutLine) {
  ctx.font = line.font;
  if (line.letterSpacing === 0) {
    ctx.fillText(line.text, line.x, line.y);
    return;
  }

  let x = line.x;
  Array.from(line.text).forEach((char, index, chars) => {
    ctx.fillText(char, x, line.y);
    x += ctx.measureText(char).width + (index === chars.length - 1 ? 0 : line.letterSpacing);
  });
}
