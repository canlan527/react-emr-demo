import type {
  RichLayoutFragment,
  RichLayoutLine,
  RichTextBlock,
  RichTextDocument,
  RichTextMarks,
  RichTextRun,
} from '../richTypes';

const defaultFontFamily = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';
const acceptablePunctuationGap = 48;
const acceptableSpaceGap = 96;

// line breaking 负责把 document 排成视觉行和页面。
// 这里是唯一可以访问 Canvas measureText 的排版层，renderer 只消费 layout 结果。

type BreakKind = 'space' | 'punctuation';

// 字符级单元是 v1 排版的关键中间层。先拆成字符，才能按真实 Canvas 宽度换行；
// 换行完成后再合并回 fragment，减少 renderer 逐字符绘制的成本。
type RichCharUnit = {
  block: RichTextBlock;
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

function getFontSize(block: RichTextBlock, marks: RichTextMarks) {
  return marks.fontSize ?? (block.type === 'heading' ? richCanvasWordLayout.headingFontSize : richCanvasWordLayout.defaultFontSize);
}

// 统一生成 Canvas font 字符串，renderer 和 layout 必须共享同一套规则。
export function createRichFont(block: RichTextBlock, marks: RichTextMarks) {
  const weight = marks.bold || block.type === 'heading' ? 700 : 400;
  const size = getFontSize(block, marks);
  const family = marks.fontFamily ?? defaultFontFamily;
  return `${weight} ${size}px ${family}`;
}

function getRunHeight(block: RichTextBlock, marks: RichTextMarks) {
  return Math.ceil(getFontSize(block, marks) * richCanvasWordLayout.lineHeightRatio);
}

// 将 run 拆成可测量的字符单元。offset 仍使用原 run.text 的 JS 字符串位置。
function createCharUnits(ctx: CanvasRenderingContext2D, block: RichTextBlock) {
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

// 主排版入口：负责分页、段落间距、行高、baseline、对齐和空行占位 fragment。
export function layoutRichTextDocument(ctx: CanvasRenderingContext2D, document: RichTextDocument) {
  const { marginX, marginY, pageHeight, pageGap, pageWidth } = richCanvasWordLayout;
  const contentWidth = pageWidth - marginX * 2;
  const lines: RichLayoutLine[] = [];
  let page = 0;
  let y = marginY;

  const pushLine = (block: RichTextBlock, fragments: RichLayoutFragment[], lineHeight: number) => {
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

  document.blocks.forEach((block, blockIndex) => {
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

    if (blockIndex < document.blocks.length - 1) {
      y += block.type === 'heading' ? 12 : 8;
    }
  });

  return {
    lines,
    pages: Math.max(1, lines[lines.length - 1] ? lines[lines.length - 1].page + 1 : 1),
    width: pageWidth,
    height: Math.max(pageHeight, (page + 1) * pageHeight + page * pageGap),
  };
}
