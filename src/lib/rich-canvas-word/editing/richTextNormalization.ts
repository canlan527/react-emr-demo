import type { RichTextDocument, RichTextMarks, RichTextPosition, RichTextRun } from '../richTypes';
import { clampOffset, findBlockAndRun } from './richTextPosition';

export type RichTextEditResult = {
  document: RichTextDocument;
  cursor: RichTextPosition;
};

let generatedBlockId = 0;
let generatedRunId = 0;

export function createBlockId(sourceBlockId: string) {
  generatedBlockId += 1;
  return `${sourceBlockId}-split-${generatedBlockId}`;
}

export function createRunId(sourceRunId: string) {
  generatedRunId += 1;
  return `${sourceRunId}-split-${generatedRunId}`;
}

export function areSameMarks(left: RichTextMarks, right: RichTextMarks) {
  return (
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    left.color === right.color &&
    left.backgroundColor === right.backgroundColor &&
    left.fontSize === right.fontSize &&
    left.fontFamily === right.fontFamily
  );
}

export function cleanMarks(marks: RichTextMarks): RichTextMarks {
  const next: RichTextMarks = {};

  if (marks.bold) {
    next.bold = true;
  }

  if (marks.underline) {
    next.underline = true;
  }

  if (marks.color) {
    next.color = marks.color;
  }

  if (marks.backgroundColor) {
    next.backgroundColor = marks.backgroundColor;
  }

  if (marks.fontSize) {
    next.fontSize = marks.fontSize;
  }

  if (marks.fontFamily) {
    next.fontFamily = marks.fontFamily;
  }

  return next;
}

export function mergeAdjacentRuns(runs: RichTextDocument['blocks'][number]['runs']) {
  const merged = runs.reduce<RichTextDocument['blocks'][number]['runs']>((items, run) => {
    if (run.text.length === 0 && runs.length > 1) {
      return items;
    }

    const previous = items[items.length - 1];
    if (previous && areSameMarks(previous.marks, run.marks)) {
      previous.text += run.text;
      return items;
    }

    items.push({ ...run, marks: cleanMarks(run.marks) });
    return items;
  }, []);

  return merged.length > 0 ? merged : runs.slice(0, 1).map((run) => ({ ...run, marks: cleanMarks(run.marks) }));
}

export function getBlockOffsetForPosition(document: RichTextDocument, position: RichTextPosition | null) {
  const { block, runIndex, run } = findBlockAndRun(document, position);
  if (!block || !run) {
    return null;
  }

  const offsetBeforeRun = block.runs.slice(0, runIndex).reduce((total, item) => total + item.text.length, 0);
  return {
    blockId: block.id,
    offset: offsetBeforeRun + clampOffset(position?.offset ?? 0, run.text),
  };
}

export function getPositionAtBlockOffset(document: RichTextDocument, blockId: string, offset: number): RichTextPosition | null {
  const block = document.blocks.find((item) => item.id === blockId);
  if (!block) {
    return null;
  }

  let currentOffset = 0;
  for (const run of block.runs) {
    const nextOffset = currentOffset + run.text.length;
    if (offset <= nextOffset) {
      return {
        blockId,
        runId: run.id,
        offset: Math.max(0, Math.min(offset - currentOffset, run.text.length)),
      };
    }

    currentOffset = nextOffset;
  }

  const fallbackRun = block.runs[block.runs.length - 1];
  return fallbackRun ? { blockId, runId: fallbackRun.id, offset: fallbackRun.text.length } : null;
}

export function normalizeRichTextDocument(document: RichTextDocument) {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({
      ...block,
      runs: mergeAdjacentRuns(block.runs),
    })),
  };
}

export function normalizeDocumentAndCursor(
  sourceDocument: RichTextDocument,
  nextDocument: RichTextDocument,
  cursor: RichTextPosition,
): RichTextEditResult {
  const cursorOffset = getBlockOffsetForPosition(sourceDocument, cursor);
  const normalizedDocument = normalizeRichTextDocument(nextDocument);
  const nextCursor = cursorOffset
    ? getPositionAtBlockOffset(normalizedDocument, cursorOffset.blockId, cursorOffset.offset)
    : cursor;

  return {
    document: normalizedDocument,
    cursor: nextCursor ?? cursor,
  };
}

export function createEmptyRun(sourceRunId: string, marks: RichTextDocument['blocks'][number]['runs'][number]['marks']) {
  return {
    id: createRunId(sourceRunId),
    text: '',
    marks,
  };
}

export function ensureRuns(
  block: RichTextDocument['blocks'][number],
  fallbackRun: RichTextDocument['blocks'][number]['runs'][number],
) {
  return block.runs.length > 0 ? block.runs : [{ ...fallbackRun, id: createRunId(fallbackRun.id), text: '' }];
}

export function cloneRun(run: RichTextRun, text = run.text): RichTextRun {
  return {
    ...run,
    id: createRunId(run.id),
    text,
    marks: cleanMarks(run.marks),
  };
}
