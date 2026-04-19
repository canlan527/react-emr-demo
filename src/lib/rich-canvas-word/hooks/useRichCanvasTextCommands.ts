import {
  deleteAfterRichTextPosition,
  deleteBeforeRichTextPosition,
  deleteRichTextSelection,
  insertTextAtRichPosition,
  splitBlockAtRichTextPosition,
} from '../editing/richTextEditing';
import type { RichTextDocument, RichTextMarks, RichTextPosition, RichTextSelection } from '../richTypes';

// 文本级编辑命令 hook。
// 它连接 React 当前状态和 editing 纯函数，负责把 result 提交给 history。

type UseRichCanvasTextCommandsOptions = {
  activeMarks: RichTextMarks;
  commitEdit: (nextDocument: RichTextDocument, nextCursor: RichTextPosition | null, nextSelection?: RichTextSelection | null) => void;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  getInitialPosition: (document: RichTextDocument) => RichTextPosition | null;
  selection: RichTextSelection | null;
};

export function useRichCanvasTextCommands({
  activeMarks,
  commitEdit,
  cursor,
  document,
  getInitialPosition,
  selection,
}: UseRichCanvasTextCommandsOptions) {
  // 普通输入：若有选区，先删除选区，再在删除后的位置插入文本。
  // activeMarks 代表“后续输入格式”，只有存在有效样式时才覆盖插入 run 的 marks。
  const insertText = (
    value: string,
    cursorOverride: RichTextPosition | null = cursor,
    selectionOverride: RichTextSelection | null = selection,
  ) => {
    const base = selectionOverride
      ? deleteRichTextSelection(document, selectionOverride)
      : { document, cursor: cursorOverride ?? getInitialPosition(document) };
    const hasActiveMarks = Object.values(activeMarks).some((item) => item !== undefined && item !== false);
    const result = insertTextAtRichPosition(base.document, base.cursor, value, hasActiveMarks ? activeMarks : undefined);
    commitEdit(result.document, result.cursor);
  };

  // Backspace：有选区时删除选区；无选区时交给 block command 处理字符或段落合并。
  const deleteBefore = (cursorOverride: RichTextPosition | null = cursor, selectionOverride: RichTextSelection | null = selection) => {
    if (selectionOverride) {
      const result = deleteRichTextSelection(document, selectionOverride);
      commitEdit(result.document, result.cursor);
      return;
    }

    const result = deleteBeforeRichTextPosition(document, cursorOverride);
    commitEdit(result.document, result.cursor);
  };

  // Delete：有选区时删除选区；无选区时删除后一个字符或合并下一段。
  const deleteAfter = (cursorOverride: RichTextPosition | null = cursor, selectionOverride: RichTextSelection | null = selection) => {
    if (selectionOverride) {
      const result = deleteRichTextSelection(document, selectionOverride);
      commitEdit(result.document, result.cursor);
      return;
    }

    const result = deleteAfterRichTextPosition(document, cursorOverride);
    commitEdit(result.document, result.cursor);
  };

  // Enter：若有选区，先删除选区，再把当前 block 按光标拆开。
  const splitBlock = (cursorOverride: RichTextPosition | null = cursor, selectionOverride: RichTextSelection | null = selection) => {
    const base = selectionOverride
      ? deleteRichTextSelection(document, selectionOverride)
      : { document, cursor: cursorOverride ?? getInitialPosition(document) };
    const result = splitBlockAtRichTextPosition(base.document, base.cursor);
    commitEdit(result.document, result.cursor);
  };

  return {
    deleteAfter,
    deleteBefore,
    insertText,
    splitBlock,
  };
}
