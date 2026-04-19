import type { RichTextDocument, RichTextPosition } from '../richTypes';

export function clampOffset(value: number, text: string) {
  return Math.max(0, Math.min(value, text.length));
}

export function getOrderedRuns(document: RichTextDocument) {
  return document.blocks.flatMap((block) => block.runs.map((run) => ({ block, run })));
}

export function getTextBoundaries(text: string) {
  const boundaries = [0];
  let offset = 0;

  Array.from(text).forEach((char) => {
    offset += char.length;
    boundaries.push(offset);
  });

  return boundaries;
}

export function updateRunText(document: RichTextDocument, runId: string, updater: (text: string) => string) {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({
      ...block,
      runs: block.runs.map((run) => (run.id === runId ? { ...run, text: updater(run.text) } : run)),
    })),
  };
}

export function findBlockAndRun(document: RichTextDocument, position: RichTextPosition | null) {
  const blockIndex = position ? document.blocks.findIndex((block) => block.id === position.blockId) : -1;
  const block = blockIndex >= 0 ? document.blocks[blockIndex] : null;
  const runIndex = block && position ? block.runs.findIndex((run) => run.id === position.runId) : -1;
  const run = block && runIndex >= 0 ? block.runs[runIndex] : null;

  return { block, blockIndex, run, runIndex };
}

export function isSameRichTextPosition(left: RichTextPosition | null, right: RichTextPosition | null) {
  return left?.blockId === right?.blockId && left?.runId === right?.runId && left?.offset === right?.offset;
}

export function compareRichTextPositions(document: RichTextDocument, left: RichTextPosition, right: RichTextPosition) {
  const leftBlockIndex = document.blocks.findIndex((block) => block.id === left.blockId);
  const rightBlockIndex = document.blocks.findIndex((block) => block.id === right.blockId);

  if (leftBlockIndex !== rightBlockIndex) {
    return leftBlockIndex - rightBlockIndex;
  }

  const block = document.blocks[leftBlockIndex];
  const leftRunIndex = block?.runs.findIndex((run) => run.id === left.runId) ?? -1;
  const rightRunIndex = block?.runs.findIndex((run) => run.id === right.runId) ?? -1;

  if (leftRunIndex !== rightRunIndex) {
    return leftRunIndex - rightRunIndex;
  }

  return left.offset - right.offset;
}

export function getRichDocumentBoundaryPositions(document: RichTextDocument) {
  const firstBlock = document.blocks[0];
  const firstRun = firstBlock?.runs[0];
  const lastBlock = document.blocks[document.blocks.length - 1];
  const lastRun = lastBlock?.runs[lastBlock.runs.length - 1];

  if (!firstBlock || !firstRun || !lastBlock || !lastRun) {
    return null;
  }

  return {
    start: { blockId: firstBlock.id, runId: firstRun.id, offset: 0 },
    end: { blockId: lastBlock.id, runId: lastRun.id, offset: lastRun.text.length },
  };
}
