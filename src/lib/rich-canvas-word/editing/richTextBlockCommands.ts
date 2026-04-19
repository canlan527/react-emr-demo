import type { RichTextBlock, RichTextDocument, RichTextPosition, RichTextRun } from '../richTypes';
import { clampOffset, findBlockAndRun, getOrderedRuns, getTextBoundaries, updateRunText } from './richTextPosition';
import { createBlockId, createEmptyRun, createRunId, type RichTextEditResult } from './richTextNormalization';

// block command 负责段落边界处的编辑行为：
// - Backspace 在段首合并上一段。
// - Delete 在段尾合并下一段。
// - Enter 把当前 block 拆成两个 block。
// 普通字符级删除仍按 run 的 Unicode 字符边界处理。

function findLastTextRun(block: RichTextDocument['blocks'][number]) {
  return [...block.runs].reverse().find((run) => run.text.length > 0) ?? null;
}

function findFirstTextRun(block: RichTextDocument['blocks'][number]) {
  return block.runs.find((run) => run.text.length > 0) ?? null;
}

function isEmptyBlock(block: RichTextDocument['blocks'][number]) {
  return block.runs.every((run) => run.text.length === 0);
}

function getOnlyRun(block: RichTextDocument['blocks'][number]) {
  return block.runs[0];
}

function mergeRunsForBackspace(
  previousBlock: RichTextDocument['blocks'][number],
  currentBlock: RichTextDocument['blocks'][number],
) {
  if (isEmptyBlock(previousBlock) && isEmptyBlock(currentBlock)) {
    return [getOnlyRun(previousBlock) ?? getOnlyRun(currentBlock)].filter(Boolean);
  }

  if (isEmptyBlock(previousBlock)) {
    return currentBlock.runs;
  }

  if (isEmptyBlock(currentBlock)) {
    return previousBlock.runs;
  }

  return [...previousBlock.runs, ...currentBlock.runs];
}

function mergeRunsForDelete(
  currentBlock: RichTextDocument['blocks'][number],
  nextBlock: RichTextDocument['blocks'][number],
) {
  if (isEmptyBlock(currentBlock) && isEmptyBlock(nextBlock)) {
    return [getOnlyRun(currentBlock) ?? getOnlyRun(nextBlock)].filter(Boolean);
  }

  if (isEmptyBlock(currentBlock)) {
    return nextBlock.runs;
  }

  if (isEmptyBlock(nextBlock)) {
    return currentBlock.runs;
  }

  return [...currentBlock.runs, ...nextBlock.runs];
}

function getBackspaceMergeCursor(
  previousBlock: RichTextDocument['blocks'][number],
  currentBlock: RichTextDocument['blocks'][number],
) {
  const previousRun = findLastTextRun(previousBlock);
  if (previousRun) {
    return { blockId: previousBlock.id, runId: previousRun.id, offset: previousRun.text.length };
  }

  const currentRun = findFirstTextRun(currentBlock) ?? getOnlyRun(previousBlock) ?? getOnlyRun(currentBlock);
  return { blockId: previousBlock.id, runId: currentRun.id, offset: 0 };
}

function getDeleteMergeCursor(
  currentBlock: RichTextDocument['blocks'][number],
  nextBlock: RichTextDocument['blocks'][number],
) {
  const currentRun = findLastTextRun(currentBlock);
  if (currentRun) {
    return { blockId: currentBlock.id, runId: currentRun.id, offset: currentRun.text.length };
  }

  const nextRun = findFirstTextRun(nextBlock) ?? getOnlyRun(currentBlock) ?? getOnlyRun(nextBlock);
  return { blockId: currentBlock.id, runId: nextRun.id, offset: 0 };
}

// Backspace：光标在 block 开头时合并上一段，否则删除前一个字符。
export function deleteBeforeRichTextPosition(
  document: RichTextDocument,
  position: RichTextPosition | null,
): RichTextEditResult {
  // 光标位于 block 开头时，Backspace 合并到上一段；否则删除前一个字符。
  const { block, blockIndex, run, runIndex } = findBlockAndRun(document, position);
  if (block && run && runIndex === 0 && clampOffset(position?.offset ?? 0, run.text) === 0) {
    const previousBlock = document.blocks[blockIndex - 1];
    if (!previousBlock) {
      return { document, cursor: { blockId: block.id, runId: run.id, offset: 0 } };
    }

    const mergedBlock = {
      ...previousBlock,
      runs: mergeRunsForBackspace(previousBlock, block),
    };

    return {
      document: {
        ...document,
        blocks: [
          ...document.blocks.slice(0, blockIndex - 1),
          mergedBlock,
          ...document.blocks.slice(blockIndex + 1),
        ],
      },
      cursor: getBackspaceMergeCursor(previousBlock, block),
    };
  }

  const runs = getOrderedRuns(document);
  const currentIndex = position ? runs.findIndex(({ run }) => run.id === position.runId) : -1;
  const current = currentIndex >= 0 ? runs[currentIndex] : null;

  if (!current) {
    return { document, cursor: position ?? { blockId: '', runId: '', offset: 0 } };
  }

  const offset = clampOffset(position?.offset ?? 0, current.run.text);
  const previousOffset = [...getTextBoundaries(current.run.text)].reverse().find((item) => item < offset);

  if (previousOffset !== undefined) {
    return {
      document: updateRunText(
        document,
        current.run.id,
        (text) => `${text.slice(0, previousOffset)}${text.slice(offset)}`,
      ),
      cursor: { blockId: current.block.id, runId: current.run.id, offset: previousOffset },
    };
  }

  const previous = runs[currentIndex - 1];
  if (!previous) {
    return { document, cursor: { blockId: current.block.id, runId: current.run.id, offset: 0 } };
  }

  const previousBoundaries = getTextBoundaries(previous.run.text);
  const deleteStart = previousBoundaries[Math.max(0, previousBoundaries.length - 2)] ?? 0;

  return {
    document: updateRunText(document, previous.run.id, (text) => text.slice(0, deleteStart)),
    cursor: { blockId: previous.block.id, runId: previous.run.id, offset: deleteStart },
  };
}

// Delete：光标在 block 末尾时合并下一段，否则删除后一个字符。
export function deleteAfterRichTextPosition(
  document: RichTextDocument,
  position: RichTextPosition | null,
): RichTextEditResult {
  // 光标位于 block 末尾时，Delete 合并下一段；否则删除后一个字符。
  const { block, blockIndex, run, runIndex } = findBlockAndRun(document, position);
  if (
    block &&
    run &&
    runIndex === block.runs.length - 1 &&
    clampOffset(position?.offset ?? 0, run.text) === run.text.length
  ) {
    const nextBlock = document.blocks[blockIndex + 1];
    if (!nextBlock) {
      return { document, cursor: { blockId: block.id, runId: run.id, offset: run.text.length } };
    }

    const mergedBlock = {
      ...block,
      runs: mergeRunsForDelete(block, nextBlock),
    };

    return {
      document: {
        ...document,
        blocks: [
          ...document.blocks.slice(0, blockIndex),
          mergedBlock,
          ...document.blocks.slice(blockIndex + 2),
        ],
      },
      cursor: getDeleteMergeCursor(block, nextBlock),
    };
  }

  const runs = getOrderedRuns(document);
  const currentIndex = position ? runs.findIndex(({ run }) => run.id === position.runId) : -1;
  const current = currentIndex >= 0 ? runs[currentIndex] : runs[0];

  if (!current) {
    return { document, cursor: position ?? { blockId: '', runId: '', offset: 0 } };
  }

  const offset = clampOffset(position?.offset ?? 0, current.run.text);
  const nextOffset = getTextBoundaries(current.run.text).find((item) => item > offset);

  if (nextOffset !== undefined) {
    return {
      document: updateRunText(
        document,
        current.run.id,
        (text) => `${text.slice(0, offset)}${text.slice(nextOffset)}`,
      ),
      cursor: { blockId: current.block.id, runId: current.run.id, offset },
    };
  }

  const next = runs[currentIndex + 1];
  if (!next) {
    return { document, cursor: { blockId: current.block.id, runId: current.run.id, offset: current.run.text.length } };
  }

  const nextOffsetInRun = getTextBoundaries(next.run.text).find((item) => item > 0) ?? 0;

  return {
    document: updateRunText(document, next.run.id, (text) => text.slice(nextOffsetInRun)),
    // Delete keeps the caret at the original logical position; layout reflow pulls following content forward when space allows.
    cursor: { blockId: current.block.id, runId: current.run.id, offset },
  };
}

// Enter：按 cursor 把当前 block 拆成 before/after 两段。
// 如果光标后没有内容，新段落会恢复 paragraph/left/空 marks，避免无限继承标题或特殊对齐。
export function splitBlockAtRichTextPosition(
  document: RichTextDocument,
  position: RichTextPosition | null,
): RichTextEditResult {
  // Enter 是硬换行：把当前 block 按 cursor 拆成两个 block。
  // 自动换行只存在于 layout 中，不会进入 document。
  const blockIndex = position ? document.blocks.findIndex((block) => block.id === position.blockId) : -1;
  const block = blockIndex >= 0 ? document.blocks[blockIndex] : document.blocks[0];
  const targetBlockIndex = blockIndex >= 0 ? blockIndex : 0;
  const runIndex = block && position ? block.runs.findIndex((run) => run.id === position.runId) : -1;
  const run = runIndex >= 0 ? block.runs[runIndex] : block?.runs[0];

  if (!block || !run) {
    return { document, cursor: position ?? { blockId: '', runId: '', offset: 0 } };
  }

  const offset = clampOffset(position?.offset ?? 0, run.text);
  const beforeText = run.text.slice(0, offset);
  const afterText = run.text.slice(offset);
  const hasTrailingContent = afterText.length > 0 || block.runs.slice(runIndex + 1).some((item) => item.text.length > 0);

  const beforeRuns = [
    ...block.runs.slice(0, Math.max(0, runIndex)),
    { ...run, text: beforeText },
  ];
  const afterRun = {
    ...run,
    id: createRunId(run.id),
    text: afterText,
    marks: hasTrailingContent ? run.marks : {},
  };
  const afterRuns = hasTrailingContent ? [afterRun, ...block.runs.slice(runIndex + 1)] : [{ ...afterRun, text: '' }];
  const nextBlockId = createBlockId(block.id);
  const nextBlock = {
    ...block,
    id: nextBlockId,
    type: hasTrailingContent ? block.type : 'paragraph',
    align: hasTrailingContent ? block.align : 'left',
    runs: afterRuns.length > 0 ? afterRuns : [createEmptyRun(run.id, run.marks)],
  };

  const blocks = [
    ...document.blocks.slice(0, targetBlockIndex),
    { ...block, runs: beforeRuns.length > 0 ? beforeRuns : [createEmptyRun(run.id, run.marks)] },
    nextBlock,
    ...document.blocks.slice(targetBlockIndex + 1),
  ];

  return {
    document: { ...document, blocks },
    cursor: {
      blockId: nextBlock.id,
      runId: (findFirstTextRun(nextBlock) ?? nextBlock.runs[0]).id,
      offset: 0,
    },
  };
}
