import type {
  RichLayoutFragment,
  RichLayoutLine,
  RichLayoutTable,
  RichLayoutTableCell,
  RichLayoutTableTextFragment,
  RichTextTableBlock,
  RichTextDocument,
  RichTextMarks,
  RichTextRun,
  RichTextTextBlock,
} from '../richTypes';
import { isRichTextHeadingBlock, isRichTextTableBlock, isRichTextTextBlock } from '../document/richTextBlocks';

const defaultFontFamily = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';
const acceptablePunctuationGap = 48;
const acceptableSpaceGap = 96;
const tableAcceptablePunctuationGap = 16;
const tableAcceptableSpaceGap = 32;
const tableCellPaddingX = 10;
const tableCellPaddingY = 8;
const tableDefaultFontSize = 14;
const tableLineHeight = 22;

// line breaking 负责把 document 排成视觉行和页面。
// 这里是唯一可以访问 Canvas measureText 的排版层，renderer 只消费 layout 结果。

type BreakKind = 'space' | 'punctuation';

// 字符级单元是 v1 排版的关键中间层。先拆成字符，才能按真实 Canvas 宽度换行；
// 换行完成后再合并回 fragment，减少 renderer 逐字符绘制的成本。
type RichCharUnit = {
  block: RichTextTextBlock;
  run: RichTextRun;
  char: string;
  offset: number;
  width: number;
  height: number;
  font: string;
  breakKind: BreakKind | null;
};

type BreakCandidate = {
  index: number;
  kind: BreakKind;
};

type RichTableCharUnit = {
  run: RichTextRun;
  char: string;
  offset: number;
  width: number;
  font: string;
  breakKind: BreakKind | null;
  isHardBreak: boolean;
};

export const richCanvasWordLayout = {
  pageWidth: 794,
  pageHeight: 1123,
  pageGap: 28,
  marginX: 72,
  marginY: 72,
  defaultFontSize: 16,
  headingFontSize: 26,
  lineHeightRatio: 1.65,
};

// 避头标点：换行时尽量不要让这些标点出现在行首。
const chineseLineStartPunctuation = new Set(Array.from('，。！？；：、）】》」』〕〉〗〙〛”’…—'));
const englishLineStartPunctuation = new Set(Array.from(',.!?;:)]}>"\'%'));

function getPunctuationKind(char: string): BreakKind | null {
  if (chineseLineStartPunctuation.has(char) || englishLineStartPunctuation.has(char)) {
    return 'punctuation';
  }

  return null;
}

function readBreakKind(char: string): BreakKind | null {
  if (/\s/.test(char)) {
    return 'space';
  }

  return getPunctuationKind(char);
}

function isLineStartPunctuation(char: string | undefined) {
  return Boolean(char && (chineseLineStartPunctuation.has(char) || englishLineStartPunctuation.has(char)));
}

function getFontSize(block: RichTextTextBlock, marks: RichTextMarks) {
  return marks.fontSize ?? (isRichTextHeadingBlock(block) ? richCanvasWordLayout.headingFontSize : richCanvasWordLayout.defaultFontSize);
}

// 统一生成 Canvas font 字符串，renderer 和 layout 必须共享同一套规则。
export function createRichFont(block: RichTextTextBlock, marks: RichTextMarks) {
  const weight = marks.bold || isRichTextHeadingBlock(block) ? 700 : 400;
  const size = getFontSize(block, marks);
  const family = marks.fontFamily ?? defaultFontFamily;
  return `${weight} ${size}px ${family}`;
}

function getRunHeight(block: RichTextTextBlock, marks: RichTextMarks) {
  return Math.ceil(getFontSize(block, marks) * richCanvasWordLayout.lineHeightRatio);
}

function createTableFont(marks: RichTextMarks) {
  const weight = marks.bold ? 700 : 400;
  const size = marks.fontSize ?? tableDefaultFontSize;
  const family = marks.fontFamily ?? defaultFontFamily;
  return `${weight} ${size}px ${family}`;
}

// 将 run 拆成可测量的字符单元。offset 仍使用原 run.text 的 JS 字符串位置。
function createCharUnits(ctx: CanvasRenderingContext2D, block: RichTextTextBlock) {
  const units: RichCharUnit[] = [];

  block.runs.forEach((run) => {
    let offset = 0;
    Array.from(run.text).forEach((char) => {
      const font = createRichFont(block, run.marks);
      ctx.font = font;
      units.push({
        block,
        run,
        char,
        offset,
        width: ctx.measureText(char).width,
        height: getRunHeight(block, run.marks),
        font,
        breakKind: readBreakKind(char),
      });
      offset += char.length;
    });
  });

  return units;
}

function sumWidth(units: RichCharUnit[], start: number, end: number) {
  let width = 0;
  for (let index = start; index < end; index += 1) {
    width += units[index]?.width ?? 0;
  }
  return width;
}

function sumTableWidth(units: RichTableCharUnit[], start: number, end: number) {
  let width = 0;
  for (let index = start; index < end; index += 1) {
    width += units[index]?.width ?? 0;
  }
  return width;
}

// 在溢出时选择更自然的断行点：
// 优先使用接近行尾的空格/标点候选，否则按字符强制断开。
function chooseBreakIndex(
  units: RichCharUnit[],
  lineStart: number,
  overflowIndex: number,
  candidate: BreakCandidate | null,
  maxWidth: number,
) {
  let fallbackIndex = Math.max(lineStart + 1, overflowIndex);

  if (isLineStartPunctuation(units[fallbackIndex]?.char) && fallbackIndex > lineStart) {
    fallbackIndex += 1;
  }

  if (!candidate || candidate.index <= lineStart) {
    return Math.min(fallbackIndex, units.length);
  }

  const remainingWidth = maxWidth - sumWidth(units, lineStart, candidate.index);

  if (candidate.kind === 'space') {
    return remainingWidth <= acceptableSpaceGap ? candidate.index : Math.min(fallbackIndex, units.length);
  }

  return remainingWidth <= acceptablePunctuationGap ? candidate.index : Math.min(fallbackIndex, units.length);
}

function chooseTableBreakIndex(
  units: RichTableCharUnit[],
  lineStart: number,
  overflowIndex: number,
  candidate: BreakCandidate | null,
  maxWidth: number,
) {
  let fallbackIndex = Math.max(lineStart + 1, overflowIndex);

  if (isLineStartPunctuation(units[fallbackIndex]?.char) && fallbackIndex > lineStart) {
    fallbackIndex += 1;
  }

  if (!candidate || candidate.index <= lineStart) {
    return Math.min(fallbackIndex, units.length);
  }

  const remainingWidth = maxWidth - sumTableWidth(units, lineStart, candidate.index);

  if (candidate.kind === 'space') {
    return remainingWidth <= tableAcceptableSpaceGap ? candidate.index : Math.min(fallbackIndex, units.length);
  }

  return remainingWidth <= tableAcceptablePunctuationGap ? candidate.index : Math.min(fallbackIndex, units.length);
}

function pullPreviousWordTail(previousLine: RichTableCharUnit[]) {
  while (previousLine.length > 0 && /\s/.test(previousLine[previousLine.length - 1]?.char ?? '')) {
    previousLine.pop();
  }

  for (let index = previousLine.length - 1; index >= 0; index -= 1) {
    const unit = previousLine[index];
    if (!unit || /\s/.test(unit.char) || isLineStartPunctuation(unit.char)) {
      continue;
    }

    return previousLine.splice(index);
  }

  return [];
}

function trimLineStartSpaces(line: RichTableCharUnit[]) {
  while (line.length > 0 && /\s/.test(line[0]?.char ?? '')) {
    line.shift();
  }
}

function getLineStartPunctuationCount(line: RichTableCharUnit[]) {
  trimLineStartSpaces(line);

  let punctuationCount = 0;
  while (line[punctuationCount] && isLineStartPunctuation(line[punctuationCount].char)) {
    punctuationCount += 1;
  }

  return punctuationCount;
}

function fixTableLineStartPunctuation(lines: RichTableCharUnit[][], contentWidth: number) {
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const previousLine = lines[index - 1];
    if (!line || !previousLine) {
      continue;
    }

    const punctuationCount = getLineStartPunctuationCount(line);
    if (punctuationCount === 0) {
      continue;
    }

    if (punctuationCount > 1) {
      const movedUnits = pullPreviousWordTail(previousLine);
      if (movedUnits.length > 0) {
        line.unshift(...movedUnits);
      }
      continue;
    }

    const punctuationWidth = sumTableWidth(line, 0, punctuationCount);
    const previousWidth = sumTableWidth(previousLine, 0, previousLine.length);
    if (previousWidth + punctuationWidth <= contentWidth) {
      previousLine.push(...line.splice(0, punctuationCount));
      continue;
    }

    const movedUnits = pullPreviousWordTail(previousLine);
    if (movedUnits.length > 0) {
      line.unshift(...movedUnits);
    }
  }
}

function rebalanceTableLines(lines: RichTableCharUnit[][], contentWidth: number) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    while (line.length > 1 && sumTableWidth(line, 0, line.length) > contentWidth) {
      const movedUnit = line.pop();
      if (!movedUnit) {
        break;
      }

      if (!lines[index + 1]) {
        lines[index + 1] = [];
      }
      lines[index + 1].unshift(movedUnit);
    }
  }
}

function normalizeTableLines(lines: RichTableCharUnit[][], contentWidth: number) {
  for (let pass = 0; pass < 4; pass += 1) {
    const snapshot = lines.map((line) => line.map((unit) => `${unit.offset}:${unit.char}`).join('')).join('\n');
    fixTableLineStartPunctuation(lines, contentWidth);
    rebalanceTableLines(lines, contentWidth);
    const nextSnapshot = lines.map((line) => line.map((unit) => `${unit.offset}:${unit.char}`).join('')).join('\n');
    if (snapshot === nextSnapshot) {
      break;
    }
  }
}

// 把字符单元合并回 fragment。同 run、同 font、连续 offset 的字符可以合并绘制。
function unitsToFragments(units: RichCharUnit[], y: number): RichLayoutFragment[] {
  const fragments: RichLayoutFragment[] = [];

  units.forEach((unit) => {
    const previous = fragments[fragments.length - 1];
    if (previous && previous.runId === unit.run.id && previous.font === unit.font && previous.endOffset === unit.offset) {
      previous.text += unit.char;
      previous.endOffset = unit.offset + unit.char.length;
      previous.width += unit.width;
      previous.height = Math.max(previous.height, unit.height);
      return;
    }

    fragments.push({
      blockId: unit.block.id,
      runId: unit.run.id,
      text: unit.char,
      marks: unit.run.marks,
      startOffset: unit.offset,
      endOffset: unit.offset + unit.char.length,
      font: unit.font,
      x: 0,
      y,
      width: unit.width,
      height: unit.height,
    });
  });

  return fragments;
}

// 对一条视觉行做 left/center/right 对齐，并写回 fragment.x。
function alignLine(line: RichLayoutLine, contentWidth: number) {
  const lineWidth = line.fragments.reduce((total, fragment) => total + fragment.width, 0);
  const offset = line.align === 'center' ? (contentWidth - lineWidth) / 2 : line.align === 'right' ? contentWidth - lineWidth : 0;
  let x = line.x + Math.max(0, offset);

  line.width = lineWidth;
  line.fragments.forEach((fragment) => {
    fragment.x = x;
    x += fragment.width;
  });
}

// 将一个 block 的字符单元切成多条视觉行。
function createBlockLineUnits(units: RichCharUnit[], contentWidth: number) {
  const lines: RichCharUnit[][] = [];
  let lineStart = 0;

  while (lineStart < units.length) {
    while (lineStart > 0 && /\s/.test(units[lineStart]?.char ?? '') && lineStart < units.length) {
      lineStart += 1;
    }

    let width = 0;
    let index = lineStart;
    let lastBreak: BreakCandidate | null = null;

    for (; index < units.length; index += 1) {
      const unit = units[index];
      if (!unit) {
        break;
      }

      if (width + unit.width > contentWidth && index > lineStart) {
        break;
      }

      width += unit.width;

      if (unit.breakKind) {
        lastBreak = { index: index + 1, kind: unit.breakKind };
      }
    }

    if (index >= units.length) {
      lines.push(units.slice(lineStart));
      break;
    }

    const breakIndex = chooseBreakIndex(units, lineStart, index, lastBreak, contentWidth);
    lines.push(units.slice(lineStart, breakIndex));
    lineStart = breakIndex;
  }

  return lines.length > 0 ? lines : [[]];
}

function createTableCellLineUnits(ctx: CanvasRenderingContext2D, runs: RichTextRun[], contentWidth: number) {
  const units: RichTableCharUnit[] = [];

  runs.forEach((run) => {
    let offset = 0;
    Array.from(run.text).forEach((char) => {
      const font = createTableFont(run.marks);
      ctx.font = font;
      units.push({
        run,
        char,
        offset,
        width: char === '\n' ? 0 : ctx.measureText(char).width,
        font,
        breakKind: readBreakKind(char),
        isHardBreak: char === '\n',
      });
      offset += char.length;
    });
  });

  if (units.length === 0) {
    return [[]];
  }

  const lines: RichTableCharUnit[][] = [];
  let lineStart = 0;

  while (lineStart < units.length) {
    let width = 0;
    let index = lineStart;
    let lastBreak: BreakCandidate | null = null;

    for (; index < units.length; index += 1) {
      const unit = units[index];
      if (!unit) {
        break;
      }

      if (unit.isHardBreak) {
        index += 1;
        break;
      }

      if (width + unit.width > contentWidth && index > lineStart) {
        break;
      }

      width += unit.width;

      if (unit.breakKind) {
        lastBreak = { index: index + 1, kind: unit.breakKind };
      }
    }

    const breakIndex =
      index >= units.length || units[index - 1]?.isHardBreak
        ? Math.max(lineStart + 1, index)
        : chooseTableBreakIndex(units, lineStart, index, lastBreak, contentWidth);
    lines.push(units.slice(lineStart, breakIndex).filter((unit) => !unit.isHardBreak));
    lineStart = breakIndex;
  }

  normalizeTableLines(lines, contentWidth);

  return lines;
}

function tableUnitsToFragments(lines: RichTableCharUnit[][], cellId: string, x: number, y: number): RichLayoutTableTextFragment[] {
  const fragments: RichLayoutTableTextFragment[] = [];

  lines.forEach((lineUnits, lineIndex) => {
    let cursorX = x;
    const baseline = y + tableCellPaddingY + tableDefaultFontSize + lineIndex * tableLineHeight;

    lineUnits.forEach((unit) => {
      const previous = fragments[fragments.length - 1];
      if (previous && previous.cellId === cellId && previous.runId === unit.run.id && previous.font === unit.font && previous.baseline === baseline) {
        previous.text += unit.char;
        previous.endOffset = unit.offset + unit.char.length;
        previous.width += unit.width;
        cursorX += unit.width;
        return;
      }

      fragments.push({
        cellId,
        runId: unit.run.id,
        text: unit.char,
        marks: unit.run.marks,
        startOffset: unit.offset,
        endOffset: unit.offset + unit.char.length,
        font: unit.font,
        x: cursorX,
        width: unit.width,
        baseline,
      });
      cursorX += unit.width;
    });
  });

  return fragments;
}

// 主排版入口：负责分页、段落间距、行高、baseline、对齐和空行占位 fragment。
export function layoutRichTextDocument(ctx: CanvasRenderingContext2D, document: RichTextDocument) {
  const { marginX, marginY, pageHeight, pageGap, pageWidth } = richCanvasWordLayout;
  const contentWidth = pageWidth - marginX * 2;
  const lines: RichLayoutLine[] = [];
  const tables: RichLayoutTable[] = [];
  let page = 0;
  let y = marginY;

  const pushLine = (block: RichTextTextBlock, fragments: RichLayoutFragment[], lineHeight: number) => {
    if (y + lineHeight > pageHeight - marginY) {
      page += 1;
      y = marginY;
    }

    const pageOffsetY = page * (pageHeight + pageGap);
    const line: RichLayoutLine = {
      blockId: block.id,
      align: block.align,
      fragments: fragments.map((fragment) => ({ ...fragment, y: pageOffsetY + y })),
      x: marginX,
      y: pageOffsetY + y,
      width: 0,
      height: lineHeight,
      baseline: pageOffsetY + y + lineHeight * 0.72,
      page,
      lineIndex: lines.length,
    };

    alignLine(line, contentWidth);
    lines.push(line);
    y += lineHeight;
  };

  const pushTable = (block: RichTextTableBlock) => {
    const columnCount = Math.max(1, ...block.rows.map((row) => row.cells.length));
    const totalConfiguredWidth = block.columnWidths?.reduce((total, item) => total + item, 0) ?? 0;
    const columnWidths = Array.from({ length: columnCount }, (_, index) => {
      const configuredWidth = block.columnWidths?.[index];
      return configuredWidth && totalConfiguredWidth > 0 ? (configuredWidth / totalConfiguredWidth) * contentWidth : contentWidth / columnCount;
    });

    block.rows.forEach((row, rowIndex) => {
      const preparedCells = row.cells.map((cell, cellIndex) => {
        const cellWidth = columnWidths[cellIndex] ?? contentWidth / columnCount;
        const textWidth = Math.max(20, cellWidth - tableCellPaddingX * 2);
        const lineUnits = createTableCellLineUnits(ctx, cell.runs, textWidth);
        const height = Math.max(44, lineUnits.length * tableLineHeight + tableCellPaddingY * 2);
        return { cell, cellWidth, lineUnits, height };
      });
      const rowHeight = Math.max(44, ...preparedCells.map((cell) => cell.height));

      if (y + rowHeight > pageHeight - marginY) {
        page += 1;
        y = marginY;
      }

      const pageOffsetY = page * (pageHeight + pageGap);
      let cellX = marginX;
      const cells: RichLayoutTableCell[] = preparedCells.map(({ cell, cellWidth, lineUnits }, cellIndex) => {
        const cellLayout = {
          cellIndex,
          id: cell.id,
          x: cellX,
          y: pageOffsetY + y,
          width: cellWidth,
          height: rowHeight,
          fragments: tableUnitsToFragments(lineUnits, cell.id, cellX + tableCellPaddingX, pageOffsetY + y),
        };
        cellX += cellWidth;
        return cellLayout;
      });

      tables.push({
        blockId: block.id,
        cells,
        x: marginX,
        y: pageOffsetY + y,
        width: contentWidth,
        height: rowHeight,
        page,
        rowIndex,
      });
      y += rowHeight;
    });
  };

  document.blocks.forEach((block, blockIndex) => {
    if (isRichTextTableBlock(block)) {
      pushTable(block);
    }

    if (isRichTextTextBlock(block)) {
      const units = createCharUnits(ctx, block);
      const blockLines = createBlockLineUnits(units, contentWidth);

      blockLines.forEach((lineUnits) => {
        const emptyRun = block.runs[0];
        const lineHeight = Math.max(getRunHeight(block, {}), ...lineUnits.map((unit) => unit.height));
        const fragments =
          lineUnits.length > 0
            ? unitsToFragments(lineUnits, y)
            : [
                {
                  blockId: block.id,
                  runId: emptyRun?.id ?? `${block.id}-empty`,
                  text: '',
                  marks: emptyRun?.marks ?? {},
                  startOffset: 0,
                  endOffset: 0,
                  font: createRichFont(block, emptyRun?.marks ?? {}),
                  x: 0,
                  y,
                  width: 0,
                  height: getRunHeight(block, emptyRun?.marks ?? {}),
                },
              ];
        pushLine(block, fragments, lineHeight);
      });
    }

    if (blockIndex < document.blocks.length - 1) {
      y += isRichTextTextBlock(block) && isRichTextHeadingBlock(block) ? 12 : 8;
    }
  });

  return {
    lines,
    tables,
    pages: Math.max(1, lines[lines.length - 1] ? lines[lines.length - 1].page + 1 : 1),
    width: pageWidth,
    height: Math.max(pageHeight, (page + 1) * pageHeight + page * pageGap),
  };
}
