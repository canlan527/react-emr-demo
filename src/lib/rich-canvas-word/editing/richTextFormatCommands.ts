import type { RichTextAlign, RichTextDocument, RichTextMarks, RichTextPosition, RichTextSelection } from '../richTypes';
import { clampOffset, compareRichTextPositions, findBlockAndRun } from './richTextPosition';
import {
  cleanMarks,
  createRunId,
  ensureRuns,
  getBlockOffsetForPosition,
  getPositionAtBlockOffset,
  normalizeRichTextDocument,
  type RichTextEditResult,
} from './richTextNormalization';
import { normalizeRichTextSelection } from './richTextSelection';

// 格式命令负责 run marks 和 block align，不处理键盘/工具栏状态。
// React hook 会根据用户动作调用这里的纯函数，然后把结果提交到 history。

// 读取当前位置的有效 marks。标题 block 默认带 heading 样式，再叠加 run marks。
export function getRichTextMarksAtPosition(document: RichTextDocument, position: RichTextPosition | null): RichTextMarks {
  const { block, run } = findBlockAndRun(document, position);
  if (!run) {
    return {};
  }

  return {
    ...(block?.type === 'heading' ? { bold: true, fontSize: 26 } : {}),
    ...run.marks,
  };
}

// 段落对齐是 block 级属性，因此只需要找到 position 所在 block。
export function getRichTextAlignAtPosition(document: RichTextDocument, position: RichTextPosition | null): RichTextAlign {
  const { block } = findBlockAndRun(document, position);
  return block?.align ?? 'left';
}

// 对选区应用 run 级格式：
// 先按选区边界拆 run，只更新中间被选中的片段，再归一化并修复 selection/cursor。
export function applyRichTextMarksToSelection(
  document: RichTextDocument,
  selection: RichTextSelection | null,
  updater: (marks: RichTextMarks) => RichTextMarks,
) {
  // 对选区应用格式：先按选区边界拆分 run，只修改被选中的中间片段，
  // 再归一化相邻 run，并把 selection/cursor 映射回新 document。
  const range = normalizeRichTextSelection(document, selection);
  if (!range) {
    return null;
  }

  let nextSelectionStart: RichTextPosition | null = null;
  let nextSelectionEnd: RichTextPosition | null = null;

  const blocks = document.blocks.map((block) => {
    const runs = block.runs.flatMap((run) => {
      const runStart = { blockId: block.id, runId: run.id, offset: 0 };
      const runEnd = { blockId: block.id, runId: run.id, offset: run.text.length };
      const startsBeforeRangeEnd = compareRichTextPositions(document, runStart, range.end) < 0;
      const endsAfterRangeStart = compareRichTextPositions(document, runEnd, range.start) > 0;

      if (!startsBeforeRangeEnd || !endsAfterRangeStart) {
        return [run];
      }

      const startOffset = run.id === range.start.runId ? clampOffset(range.start.offset, run.text) : 0;
      const endOffset = run.id === range.end.runId ? clampOffset(range.end.offset, run.text) : run.text.length;
      const selectedText = run.text.slice(startOffset, endOffset);
      const selectedRun = {
        ...run,
        id: createRunId(run.id),
        text: selectedText,
        marks: cleanMarks(updater(run.marks)),
      };

      if (!nextSelectionStart) {
        nextSelectionStart = { blockId: block.id, runId: selectedRun.id, offset: 0 };
      }

      nextSelectionEnd = { blockId: block.id, runId: selectedRun.id, offset: selectedText.length };

      return [
        startOffset > 0 ? { ...run, id: createRunId(run.id), text: run.text.slice(0, startOffset) } : null,
        selectedRun,
        endOffset < run.text.length ? { ...run, id: createRunId(run.id), text: run.text.slice(endOffset) } : null,
      ].filter((item): item is RichTextDocument['blocks'][number]['runs'][number] => Boolean(item));
    });

    return { ...block, runs: ensureRuns({ ...block, runs }, block.runs[0]) };
  });

  const nextDocument = { ...document, blocks };
  const normalizedDocument = normalizeRichTextDocument(nextDocument);
  const startOffset = getBlockOffsetForPosition(nextDocument, nextSelectionStart);
  const endOffset = getBlockOffsetForPosition(nextDocument, nextSelectionEnd);
  const normalizedStart = startOffset
    ? getPositionAtBlockOffset(normalizedDocument, startOffset.blockId, startOffset.offset)
    : null;
  const normalizedEnd = endOffset ? getPositionAtBlockOffset(normalizedDocument, endOffset.blockId, endOffset.offset) : null;

  return {
    document: normalizedDocument,
    selection:
      normalizedStart && normalizedEnd
        ? {
            anchor: normalizedStart,
            focus: normalizedEnd,
          }
        : null,
    cursor: normalizedEnd,
  };
}

// 对齐是 block 级格式。选区跨过哪些 block，就修改哪些 block；无选区时只改 cursor 所在 block。
export function applyRichTextAlignToSelection(
  document: RichTextDocument,
  selection: RichTextSelection | null,
  cursor: RichTextPosition | null,
  align: RichTextAlign,
) {
  // 段落对齐是 block 级样式。选区跨过哪些 block，就修改哪些 block；
  // 无选区时只修改 cursor 所在 block。
  const range = normalizeRichTextSelection(document, selection);
  const blocks = document.blocks.map((block) => {
    const shouldAlign = range
      ? compareRichTextPositions(document, { blockId: block.id, runId: block.runs[0]?.id ?? '', offset: 0 }, range.end) <= 0 &&
        compareRichTextPositions(
          document,
          {
            blockId: block.id,
            runId: block.runs[block.runs.length - 1]?.id ?? '',
            offset: block.runs[block.runs.length - 1]?.text.length ?? 0,
          },
          range.start,
        ) >= 0
      : block.id === cursor?.blockId;

    return shouldAlign ? { ...block, align } : block;
  });

  return { ...document, blocks };
}

// 清除当前空 run 的格式。用于“回车后想恢复默认纯文本”的场景。
// 只处理空 run，避免用户误把已有文本样式清空。
export function clearCurrentRichTextFormatting(
  document: RichTextDocument,
  position: RichTextPosition | null,
): RichTextEditResult | null {
  const { block, run } = findBlockAndRun(document, position);
  if (!block || !run || run.text.length > 0) {
    return null;
  }

  const blocks = document.blocks.map((item) =>
    item.id === block.id
      ? {
          ...item,
          type: 'paragraph' as const,
          align: 'left' as const,
          runs: item.runs.map((currentRun) => (currentRun.id === run.id ? { ...currentRun, marks: {} } : currentRun)),
        }
      : item,
  );

  return {
    document: { ...document, blocks },
    cursor: { blockId: block.id, runId: run.id, offset: 0 },
  };
}
