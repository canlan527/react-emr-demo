import type { RichTextDocument, RichTextPosition } from '../richTypes';

// position helper 是 editing/layout 的最低层工具。
// 它只负责在 RichTextDocument 中定位 block/run/offset，不处理格式、选区或 React state。

// 所有外部传入的 offset 都可能来自鼠标命中或旧 cursor，使用前要先限制到文本边界内。
export function clampOffset(value: number, text: string) {
  return Math.max(0, Math.min(value, text.length));
}

// 按 document 顺序摊平 run。左右移动、跨 run 删除等线性编辑命令依赖这个顺序。
export function getOrderedRuns(document: RichTextDocument) {
  return document.blocks.flatMap((block) => block.runs.map((run) => ({ block, run })));
}

// 返回用户感知字符的 offset 边界。Array.from 能避免中文、emoji 等被普通索引拆坏。
export function getTextBoundaries(text: string) {
  const boundaries = [0];
  let offset = 0;

  Array.from(text).forEach((char) => {
    offset += char.length;
    boundaries.push(offset);
  });

  return boundaries;
}

// 更新单个 run 的 text，保持其他 block/run 结构不变。
export function updateRunText(document: RichTextDocument, runId: string, updater: (text: string) => string) {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({
      ...block,
      runs: block.runs.map((run) => (run.id === runId ? { ...run, text: updater(run.text) } : run)),
    })),
  };
}

// 根据逻辑 position 反查 block/run 和索引。找不到时返回 null 信息，调用方负责兜底。
export function findBlockAndRun(document: RichTextDocument, position: RichTextPosition | null) {
  const blockIndex = position ? document.blocks.findIndex((block) => block.id === position.blockId) : -1;
  const block = blockIndex >= 0 ? document.blocks[blockIndex] : null;
  const runIndex = block && position ? block.runs.findIndex((run) => run.id === position.runId) : -1;
  const run = block && runIndex >= 0 ? block.runs[runIndex] : null;

  return { block, blockIndex, run, runIndex };
}

// selection 收敛、拖拽选区、光标移动都会用它判断两个逻辑位置是否完全相同。
export function isSameRichTextPosition(left: RichTextPosition | null, right: RichTextPosition | null) {
  return left?.blockId === right?.blockId && left?.runId === right?.runId && left?.offset === right?.offset;
}

// 按 document 顺序比较两个位置。选区归一化和选区矩形计算都依赖这个排序。
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

// 获取整篇文档的首尾逻辑位置，用于 Ctrl/Cmd+A 全选。
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
