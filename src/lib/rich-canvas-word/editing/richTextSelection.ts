import type { RichTextDocument, RichTextPosition, RichTextSelection } from '../richTypes';
import { clampOffset, compareRichTextPositions, findBlockAndRun, isSameRichTextPosition } from './richTextPosition';
import { createRunId, type RichTextEditResult } from './richTextNormalization';

export function normalizeRichTextSelection(document: RichTextDocument, selection: RichTextSelection | null) {
  if (!selection || isSameRichTextPosition(selection.anchor, selection.focus)) {
    return null;
  }

  return compareRichTextPositions(document, selection.anchor, selection.focus) <= 0
    ? { start: selection.anchor, end: selection.focus }
    : { start: selection.focus, end: selection.anchor };
}

export function extractRichTextSelectionPlainText(document: RichTextDocument, selection: RichTextSelection | null) {
  const range = normalizeRichTextSelection(document, selection);
  if (!range) {
    return '';
  }

  const startInfo = findBlockAndRun(document, range.start);
  const endInfo = findBlockAndRun(document, range.end);
  if (!startInfo.block || !startInfo.run || !endInfo.block || !endInfo.run) {
    return '';
  }

  const readBlockText = (block: RichTextDocument['blocks'][number], blockIndex: number) =>
    block.runs
      .map((run, runIndex) => {
        if (blockIndex === startInfo.blockIndex && runIndex < startInfo.runIndex) {
          return '';
        }

        if (blockIndex === endInfo.blockIndex && runIndex > endInfo.runIndex) {
          return '';
        }

        const startOffset = run.id === startInfo.run?.id ? clampOffset(range.start.offset, run.text) : 0;
        const endOffset = run.id === endInfo.run?.id ? clampOffset(range.end.offset, run.text) : run.text.length;
        return run.text.slice(startOffset, endOffset);
      })
      .join('');

  return document.blocks
    .slice(startInfo.blockIndex, endInfo.blockIndex + 1)
    .map((block, index) => readBlockText(block, startInfo.blockIndex + index))
    .join('\n');
}

export function deleteRichTextSelection(
  document: RichTextDocument,
  selection: RichTextSelection | null,
): RichTextEditResult {
  const range = normalizeRichTextSelection(document, selection);
  if (!range) {
    const fallbackBlock = document.blocks[0];
    const fallbackRun = fallbackBlock?.runs[0];
    return {
      document,
      cursor: {
        blockId: fallbackBlock?.id ?? '',
        runId: fallbackRun?.id ?? '',
        offset: 0,
      },
    };
  }

  const start = range.start;
  const end = range.end;
  const startInfo = findBlockAndRun(document, start);
  const endInfo = findBlockAndRun(document, end);

  if (!startInfo.block || !startInfo.run || !endInfo.block || !endInfo.run) {
    return { document, cursor: start };
  }

  const startRun = startInfo.run;
  const endRun = endInfo.run;
  const startOffset = clampOffset(start.offset, startInfo.run.text);
  const endOffset = clampOffset(end.offset, endInfo.run.text);

  const ensureRuns = (
    block: RichTextDocument['blocks'][number],
    fallbackRun: RichTextDocument['blocks'][number]['runs'][number],
  ) => (block.runs.length > 0 ? block.runs : [{ ...fallbackRun, id: createRunId(fallbackRun.id), text: '' }]);

  if (startInfo.block.id === endInfo.block.id) {
    const nextRuns = startInfo.block.runs
      .map((run, runIndex) => {
        if (runIndex < startInfo.runIndex || runIndex > endInfo.runIndex) {
          return run;
        }

        if (startInfo.runIndex === endInfo.runIndex && run.id === startRun.id) {
          return { ...run, text: `${run.text.slice(0, startOffset)}${run.text.slice(endOffset)}` };
        }

        if (run.id === startRun.id) {
          return { ...run, text: run.text.slice(0, startOffset) };
        }

        if (run.id === endRun.id) {
          return { ...run, text: run.text.slice(endOffset) };
        }

        return null;
      })
      .filter((run): run is RichTextDocument['blocks'][number]['runs'][number] => Boolean(run));

    const nextBlock = { ...startInfo.block, runs: ensureRuns({ ...startInfo.block, runs: nextRuns }, startInfo.run) };
    return {
      document: {
        ...document,
        blocks: document.blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block)),
      },
      cursor: start,
    };
  }

  const startRuns = [
    ...startInfo.block.runs.slice(0, startInfo.runIndex),
    { ...startInfo.run, text: startInfo.run.text.slice(0, startOffset) },
  ];
  const endRuns = [
    { ...endInfo.run, text: endInfo.run.text.slice(endOffset) },
    ...endInfo.block.runs.slice(endInfo.runIndex + 1),
  ];
  const mergedBlock = {
    ...startInfo.block,
    runs: ensureRuns({ ...startInfo.block, runs: [...startRuns, ...endRuns] }, startInfo.run),
  };

  return {
    document: {
      ...document,
      blocks: [
        ...document.blocks.slice(0, startInfo.blockIndex),
        mergedBlock,
        ...document.blocks.slice(endInfo.blockIndex + 1),
      ],
    },
    cursor: start,
  };
}
