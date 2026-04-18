/**
 * Canvas Word 的纯文本排版模块。
 *
 * 职责：
 * - 将纯文本拆分为视觉行。
 * - 计算自动换行、分页、行坐标、标题字体和字间距。
 * - 处理中文/英文避头标点。
 * - 提供光标索引、视觉 offset 和 Canvas x 坐标之间的转换工具。
 *
 * 不直接负责：
 * - React 状态。
 * - Canvas 页面背景绘制。
 * - 键盘、鼠标或 IME 事件。
 */
import { canvasWordLayout } from '../../medical-record/medicalRecordDocument';

export type LayoutLine = {
  // 当前视觉行展示的文本。它可能因为避头标点规则而和原始切片不完全一致。
  text: string;
  // 当前视觉行在原始纯文本中的起止索引，end 遵循 slice 风格，不包含结束位置字符。
  start: number;
  end: number;
  // 每个可见字符对应的原始文本索引，用于处理中文、emoji 和避头标点调整后的光标映射。
  sourceIndexes: number[];
  font: string;
  x: number;
  y: number;
  page: number;
  lineIndex: number;
  letterSpacing: number;
};

type DraftLine = {
  // DraftLine 是分页前的临时视觉行，先完成自动换行和避头标点，再转成 LayoutLine。
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

// 判断字符是否属于“不能出现在行首”的标点。中英文分开记录，便于后续扩展不同规则。
function getPunctuationKind(char: string): PunctuationKind | null {
  if (chineseLineStartPunctuation.has(char)) {
    return 'chinese';
  }

  if (englishLineStartPunctuation.has(char)) {
    return 'english';
  }

  return null;
}

// 读取一行开头连续的避头标点，例如 “，。” 或 “!)”。
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

// 使用 Array.from 按 Unicode 字符读取，避免中文和 emoji 被 UTF-16 code unit 拆坏。
function takeLastChar(text: string) {
  return Array.from(text).at(-1) ?? '';
}

// 删除最后一个可见字符，同样按 Unicode 字符处理。
function removeLastChar(text: string) {
  const chars = Array.from(text);
  chars.pop();
  return chars.join('');
}

// 为视觉行里的每个字符建立到原始 text 的索引映射，光标和选区会依赖这个映射。
function createSourceIndexes(start: number, text: string) {
  let cursor = start;
  return Array.from(text).map((char) => {
    const index = cursor;
    cursor += char.length;
    return index;
  });
}

// 避头标点把上一行最后一个字挪到下一行后，上一行会变短；这里给它补一点字间距，视觉上更接近满行排版。
function calculateLetterSpacing(ctx: CanvasRenderingContext2D, line: DraftLine, maxWidth: number) {
  const chars = Array.from(line.text);
  if (!line.looseTextSpacing || chars.length <= 1) {
    return 0;
  }

  const looseSpace = (maxWidth - ctx.measureText(line.text).width) / (chars.length - 1);
  return Math.max(0, Math.min(looseSpace, 6));
}

// 记录适合断行的位置：空格优先作为英文断词边界，标点用于中文排版的自然停顿。
function readBreakCandidate(char: string, index: number): BreakCandidate | null {
  if (/\s/.test(char)) {
    return { index, kind: 'space' };
  }

  if (getPunctuationKind(char)) {
    return { index, kind: 'punctuation' };
  }

  return null;
}

// 当当前切片超出最大宽度时，选择真正的断行位置。
function chooseBreakIndex(
  ctx: CanvasRenderingContext2D,
  paragraph: string,
  lineStart: number,
  overflowIndex: number,
  candidate: BreakCandidate | null,
  maxWidth: number,
) {
  // 没有合适断点时，至少保留一个字符，避免极窄宽度下出现空行死循环。
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

// 修正新行以标点开头的情况，让视觉结果更接近中文排版习惯。
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

// 将一个段落拆成多个 DraftLine。这里只处理段内自动换行，不处理分页。
function createParagraphLines(ctx: CanvasRenderingContext2D, paragraph: string, paragraphStart: number, maxWidth: number) {
  const lines: DraftLine[] = [];

  if (paragraph.length === 0) {
    // 空段落也要产生一行，否则连续换行和光标定位会丢失段落高度。
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

  // 逐步扩大当前行切片并测量宽度；一旦溢出，再回退到最近的合理断点。
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

  // 将 DraftLine 放入最终布局，同时处理分页和标题行字体。
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

  // 先按换行符拆段落，再分别做段内自动换行；textCursor 负责把段内索引还原到全文索引。
  text.split('\n').forEach((paragraph, paragraphIndex, paragraphs) => {
    draftLines.push(...createParagraphLines(ctx, paragraph, textCursor, maxWidth));
    textCursor += paragraph.length + (paragraphIndex === paragraphs.length - 1 ? 0 : 1);
  });

  // 自动换行完成后再统一处理避头标点，避免段内测量逻辑和标点修正互相干扰。
  normalizeLineStartPunctuation(draftLines).forEach(pushLine);

  return {
    lines,
    pages: Math.max(1, lines[lines.length - 1] ? lines[lines.length - 1].page + 1 : 1),
  };
}

// 根据原始文本光标位置找到它所在的视觉行；如果光标落在行间边界，则取最近的后续行。
export function findCursorLine(lines: LayoutLine[], cursor: number) {
  return (
    lines.find((line) => cursor >= line.start && cursor <= line.end) ??
    lines.find((line) => cursor < line.start) ??
    lines[lines.length - 1]
  );
}

// 把 Canvas 横坐标转换为原始文本光标索引，用于鼠标点击定位和拖拽选区。
export function fitIndexInLine(ctx: CanvasRenderingContext2D, line: LayoutLine, x: number) {
  if (x <= line.x) {
    return sourceCursorForVisualOffset(line, 0);
  }

  // 找到第一个超过鼠标位置的字符边界，再比较左右边界谁更近。
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

// 把视觉字符偏移转换回原始文本索引。避头标点调整后，这一步不能简单用 line.start + offset。
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

// 把原始文本光标索引转换为视觉字符偏移，用于绘制光标和定位隐藏 textarea。
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

// 测量视觉行前 charCount 个字符的宽度。这里会叠加避头标点产生的额外字间距。
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

// 绘制单行文本。普通行直接 fillText；需要额外字间距时逐字绘制。
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
