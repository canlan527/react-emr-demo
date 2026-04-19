import type { RichTextDocument, RichTextMarks, RichTextPosition, RichTextRun } from '../richTypes';
import { clampOffset, findBlockAndRun } from './richTextPosition';

// 编辑命令的标准返回值：新的 document 和新的 cursor。
// selection 是否保留由更高层命令决定，避免基础命令耦合 UI 行为。
export type RichTextEditResult = {
  document: RichTextDocument;
  cursor: RichTextPosition;
};

let generatedBlockId = 0;
let generatedRunId = 0;

// 拆分 block 时生成临时 id。当前 demo 足够使用，后续持久化可替换为统一 id 服务。
export function createBlockId(sourceBlockId: string) {
  generatedBlockId += 1;
  return `${sourceBlockId}-split-${generatedBlockId}`;
}

// run 被格式命令、粘贴命令频繁拆分；生成新 id 可以避免同一 runId 出现在多个位置。
export function createRunId(sourceRunId: string) {
  generatedRunId += 1;
  return `${sourceRunId}-split-${generatedRunId}`;
}

// 判断两个 marks 在渲染语义上是否一致，用于合并相邻 run。
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

// 清洗 marks：只保留真正生效的字段，避免 false/undefined 干扰比较和持久化。
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

// 格式命令会把 run 切碎；归一化时把相邻同样式 run 合并回来，降低后续 layout 成本。
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

// 把 run 内 position 转成 block 内绝对 offset。run id 变化前先保存这个 offset。
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

// 根据 block 内绝对 offset 重新找到 run/offset，通常用于归一化后的 cursor 修复。
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

// 当前归一化策略：只合并相邻同 marks run，不改变 block 顺序和段落语义。
export function normalizeRichTextDocument(document: RichTextDocument) {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({
      ...block,
      runs: mergeAdjacentRuns(block.runs),
    })),
  };
}

// 对 nextDocument 归一化，同时把 cursor 从 sourceDocument 的逻辑 offset 映射回新 document。
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

// 空段落也需要一个 run 来承载光标和后续输入样式。
export function createEmptyRun(sourceRunId: string, marks: RichTextDocument['blocks'][number]['runs'][number]['marks']) {
  return {
    id: createRunId(sourceRunId),
    text: '',
    marks,
  };
}

// 保证 block 至少有一个 run，避免删除/粘贴后出现无法定位光标的空 block。
export function ensureRuns(
  block: RichTextDocument['blocks'][number],
  fallbackRun: RichTextDocument['blocks'][number]['runs'][number],
) {
  return block.runs.length > 0 ? block.runs : [{ ...fallbackRun, id: createRunId(fallbackRun.id), text: '' }];
}

// 克隆 run 时重新生成 id 并清洗 marks，主要服务内部富文本粘贴。
export function cloneRun(run: RichTextRun, text = run.text): RichTextRun {
  return {
    ...run,
    id: createRunId(run.id),
    text,
    marks: cleanMarks(run.marks),
  };
}
