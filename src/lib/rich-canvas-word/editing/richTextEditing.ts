import type { RichTextDocument, RichTextMarks, RichTextPosition } from '../richTypes';
import { clampOffset } from './richTextPosition';
import {
  cleanMarks,
  createRunId,
  normalizeDocumentAndCursor,
  type RichTextEditResult,
} from './richTextNormalization';

export { compareRichTextPositions, getRichDocumentBoundaryPositions, isSameRichTextPosition } from './richTextPosition';
export { deleteRichTextSelection, extractRichTextSelectionPlainText, normalizeRichTextSelection } from './richTextSelection';
export {
  applyRichTextAlignToSelection,
  applyRichTextMarksToSelection,
  clearCurrentRichTextFormatting,
  getRichTextAlignAtPosition,
  getRichTextMarksAtPosition,
} from './richTextFormatCommands';
export {
  deleteAfterRichTextPosition,
  deleteBeforeRichTextPosition,
  splitBlockAtRichTextPosition,
} from './richTextBlockCommands';
export {
  extractRichTextSelectionSlice,
  insertRichTextSliceAtPosition,
  richTextSliceToPlainText,
  type RichTextPasteResult,
} from './richTextClipboardSlice';

// 富文本编辑纯函数集合。
//
// 这个文件只处理 document/position/selection 的数据变换，不直接访问 DOM、
// Canvas 或 React state。容器组件负责把这些结果提交到 history。
//
// 当前编辑模型的核心约束：
// - RichTextPosition 用 blockId + runId + offset 定位。
// - 格式命令会拆分 run，因此后续需要归一化并重定位 cursor/selection。
// - 删除、回车、粘贴等操作都应该返回新的 document 和新的 cursor。

export function insertTextAtRichPosition(
  document: RichTextDocument,
  position: RichTextPosition | null,
  value: string,
  marksOverride?: RichTextMarks,
): RichTextEditResult {
  // marksOverride 只在无选区且 activeMarks 生效时传入。
  // 它会把插入文本切成独立 run，避免意外污染原 run 的已有文字样式。
  const fallbackBlock = document.blocks[0];
  const fallbackRun = fallbackBlock?.runs[0];
  const targetRunId = position?.runId ?? fallbackRun?.id;

  if (!value || !targetRunId) {
    return {
      document,
      cursor:
        position ??
        ({
          blockId: fallbackBlock?.id ?? '',
          runId: fallbackRun?.id ?? '',
          offset: 0,
        } satisfies RichTextPosition),
    };
  }

  let nextCursor: RichTextPosition | null = null;

  const blocks = document.blocks.map((block) => ({
    ...block,
    runs: block.runs.flatMap((run) => {
      if (run.id !== targetRunId) {
        return [run];
      }

      const offset = clampOffset(position?.offset ?? 0, run.text);
      const nextMarks = marksOverride ? { ...run.marks, ...marksOverride } : run.marks;
      nextCursor = {
        blockId: block.id,
        runId: marksOverride ? createRunId(run.id) : run.id,
        offset: marksOverride ? value.length : offset + value.length,
      };

      if (!marksOverride) {
        return [
          {
            ...run,
            text: `${run.text.slice(0, offset)}${value}${run.text.slice(offset)}`,
          },
        ];
      }

      const insertedRunId = nextCursor.runId;
      return [
        offset > 0 ? { ...run, id: createRunId(run.id), text: run.text.slice(0, offset) } : null,
        { ...run, id: insertedRunId, text: value, marks: cleanMarks(nextMarks) },
        offset < run.text.length ? { ...run, id: createRunId(run.id), text: run.text.slice(offset) } : null,
      ].filter((item): item is RichTextDocument['blocks'][number]['runs'][number] => Boolean(item));
    }),
  }));

  const fallbackCursor =
    position ??
    ({
      blockId: fallbackBlock?.id ?? '',
      runId: fallbackRun?.id ?? '',
      offset: 0,
    } satisfies RichTextPosition);

  const nextDocument = { ...document, blocks };
  return normalizeDocumentAndCursor(nextDocument, nextDocument, nextCursor ?? fallbackCursor);
}
