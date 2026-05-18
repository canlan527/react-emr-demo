import type {
  RichTextAlign,
  RichTextBlock,
  RichTextTableBlock,
  RichTextRun,
  RichTextTextBlock,
  RichTextTextBlockType,
} from '../richTypes';

const richTextTextBlockTypes = new Set<RichTextTextBlockType>(['heading', 'paragraph']);

export function isRichTextTextBlockType(value: unknown): value is RichTextTextBlockType {
  return typeof value === 'string' && richTextTextBlockTypes.has(value as RichTextTextBlockType);
}

export function isRichTextTextBlock(block: RichTextBlock): block is RichTextTextBlock {
  return isRichTextTextBlockType(block.type);
}

export function isRichTextHeadingBlock(block: RichTextBlock): block is RichTextTextBlock<'heading'> {
  return block.type === 'heading';
}

export function isRichTextTableBlock(block: RichTextBlock): block is RichTextTableBlock {
  return block.type === 'table';
}

export function createRichTextBlock(
  id: string,
  type: RichTextTextBlockType,
  runs: RichTextRun[],
  align: RichTextAlign = 'left',
): RichTextTextBlock {
  return {
    id,
    type,
    align,
    runs,
  };
}

export function getRichTextBlockPlainText(block: RichTextBlock) {
  if (isRichTextTableBlock(block)) {
    return block.rows
      .map((row) => row.cells.map((cell) => cell.runs.map((run) => run.text).join('')).join('\t'))
      .join('\n');
  }

  return block.runs.map((run) => run.text).join('');
}

export function getRichTextBlockHtmlTag(block: RichTextBlock) {
  return isRichTextHeadingBlock(block) ? 'h1' : 'p';
}
