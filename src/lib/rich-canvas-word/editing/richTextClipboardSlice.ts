import type {
  RichTextBlock,
  RichTextClipboardSlice,
  RichTextDocument,
  RichTextPosition,
  RichTextRun,
  RichTextSelection,
} from '../richTypes';
import { clampOffset, findBlockAndRun } from './richTextPosition';
import {
  cleanMarks,
  cloneRun,
  createBlockId,
  createEmptyRun,
  createRunId,
  ensureRuns,
  normalizeDocumentAndCursor,
  type RichTextEditResult,
} from './richTextNormalization';
import { normalizeRichTextSelection } from './richTextSelection';

// 内部富文本剪贴板 slice 处理：
// - copy/cut 时从选区提取 block/run/marks。
// - paste 时把 slice 克隆进目标位置并重新生成 id。
// - 这里只处理内部结构，不直接访问浏览器 Clipboard API。

export type RichTextPasteResult = RichTextEditResult & {
  selection: RichTextSelection | null;
};

// 把内部 slice 降级为纯文本，用于 text/plain 和内部粘贴匹配。
export function richTextSliceToPlainText(slice: RichTextClipboardSlice | null) {
  if (!slice) {
    return '';
  }

  return slice.blocks.map((block) => block.runs.map((run) => run.text).join('')).join('\n');
}

// 从当前 document 的选区中截取富文本 slice，保留 block/run/marks。
export function extractRichTextSelectionSlice(
  document: RichTextDocument,
  selection: RichTextSelection | null,
): RichTextClipboardSlice | null {
  const range = normalizeRichTextSelection(document, selection);
  if (!range) {
    return null;
  }

  const startInfo = findBlockAndRun(document, range.start);
  const endInfo = findBlockAndRun(document, range.end);
  if (!startInfo.block || !startInfo.run || !endInfo.block || !endInfo.run) {
    return null;
  }

  const blocks = document.blocks
    .slice(startInfo.blockIndex, endInfo.blockIndex + 1)
    .map((block, blockOffset) => {
      const blockIndex = startInfo.blockIndex + blockOffset;
      const runs = block.runs
        .map((run, runIndex) => {
          if (blockIndex === startInfo.blockIndex && runIndex < startInfo.runIndex) {
            return null;
          }

          if (blockIndex === endInfo.blockIndex && runIndex > endInfo.runIndex) {
            return null;
          }

          const startOffset = run.id === startInfo.run?.id ? clampOffset(range.start.offset, run.text) : 0;
          const endOffset = run.id === endInfo.run?.id ? clampOffset(range.end.offset, run.text) : run.text.length;
          const text = run.text.slice(startOffset, endOffset);
          return text.length > 0 ? { ...run, text, marks: cleanMarks(run.marks) } : null;
        })
        .filter((run): run is RichTextRun => Boolean(run));

      return {
        ...block,
        runs: runs.length > 0 ? runs : [{ ...(block.runs[0] ?? startInfo.run), text: '', marks: cleanMarks((block.runs[0] ?? startInfo.run).marks) }],
      };
    });

  return blocks.length > 0 ? { blocks } : null;
}

function cloneBlock(block: RichTextBlock, runs: RichTextRun[]): RichTextBlock {
  return {
    ...block,
    id: createBlockId(block.id),
    runs: runs.length > 0 ? runs : [createEmptyRun(block.runs[0]?.id ?? block.id, block.runs[0]?.marks ?? {})],
  };
}

// 将富文本 slice 插入指定位置。多 block slice 会拆分当前 block，并把前后内容接到首尾 block。
export function insertRichTextSliceAtPosition(
  document: RichTextDocument,
  position: RichTextPosition | null,
  slice: RichTextClipboardSlice | null,
): RichTextPasteResult | null {
  const firstSliceBlock = slice?.blocks[0];
  if (!slice || !firstSliceBlock) {
    return null;
  }

  const { block, blockIndex, run, runIndex } = findBlockAndRun(document, position);
  if (!block || !run) {
    return null;
  }

  const offset = clampOffset(position?.offset ?? 0, run.text);
  const beforeRuns = [
    ...block.runs.slice(0, runIndex),
    offset > 0 ? { ...run, text: run.text.slice(0, offset) } : null,
  ].filter((item): item is RichTextRun => Boolean(item));
  const afterRuns = [
    offset < run.text.length ? { ...run, id: createRunId(run.id), text: run.text.slice(offset) } : null,
    ...block.runs.slice(runIndex + 1),
  ].filter((item): item is RichTextRun => Boolean(item));

  let cursorBeforeNormalize: RichTextPosition | null = null;
  const clonedSliceBlocks = slice.blocks.map((sliceBlock) => cloneBlock(sliceBlock, sliceBlock.runs.map((sliceRun) => cloneRun(sliceRun))));
  const nextBlocks: RichTextBlock[] = [];

  if (clonedSliceBlocks.length === 1) {
    const insertedRuns = clonedSliceBlocks[0].runs;
    const mergedRuns = [...beforeRuns, ...insertedRuns, ...afterRuns];
    const cursorRun = insertedRuns[insertedRuns.length - 1] ?? beforeRuns[beforeRuns.length - 1] ?? afterRuns[0];

    cursorBeforeNormalize = {
      blockId: block.id,
      runId: cursorRun.id,
      offset: cursorRun.text.length,
    };

    nextBlocks.push(
      ...document.blocks.slice(0, blockIndex),
      {
        ...block,
        runs: ensureRuns({ ...block, runs: mergedRuns }, run),
      },
      ...document.blocks.slice(blockIndex + 1),
    );
  } else {
    const firstInsertedBlock = clonedSliceBlocks[0];
    const lastInsertedBlock = clonedSliceBlocks[clonedSliceBlocks.length - 1];
    const middleBlocks = clonedSliceBlocks.slice(1, -1);
    const firstBlock = {
      ...block,
      runs: ensureRuns({ ...block, runs: [...beforeRuns, ...firstInsertedBlock.runs] }, run),
    };
    const lastBlock = {
      ...lastInsertedBlock,
      runs: ensureRuns({ ...lastInsertedBlock, runs: [...lastInsertedBlock.runs, ...afterRuns] }, lastInsertedBlock.runs[0]),
    };
    const cursorRun = lastInsertedBlock.runs[lastInsertedBlock.runs.length - 1] ?? lastBlock.runs[0];

    cursorBeforeNormalize = {
      blockId: lastBlock.id,
      runId: cursorRun.id,
      offset: cursorRun.text.length,
    };

    nextBlocks.push(
      ...document.blocks.slice(0, blockIndex),
      firstBlock,
      ...middleBlocks,
      lastBlock,
      ...document.blocks.slice(blockIndex + 1),
    );
  }

  const nextDocument = { ...document, blocks: nextBlocks };
  const result = normalizeDocumentAndCursor(nextDocument, nextDocument, cursorBeforeNormalize);
  return {
    ...result,
    selection: null,
  };
}
