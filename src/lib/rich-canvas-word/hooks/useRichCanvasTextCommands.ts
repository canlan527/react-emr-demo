import {
  deleteAfterRichTextPosition,
  deleteBeforeRichTextPosition,
  deleteRichTextSelection,
  insertTextAtRichPosition,
  splitBlockAtRichTextPosition,
} from '../editing/richTextEditing';
import type { RichTextDocument, RichTextMarks, RichTextPosition, RichTextSelection } from '../richTypes';

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

  const deleteBefore = (cursorOverride: RichTextPosition | null = cursor, selectionOverride: RichTextSelection | null = selection) => {
    if (selectionOverride) {
      const result = deleteRichTextSelection(document, selectionOverride);
      commitEdit(result.document, result.cursor);
      return;
    }

    const result = deleteBeforeRichTextPosition(document, cursorOverride);
    commitEdit(result.document, result.cursor);
  };

  const deleteAfter = (cursorOverride: RichTextPosition | null = cursor, selectionOverride: RichTextSelection | null = selection) => {
    if (selectionOverride) {
      const result = deleteRichTextSelection(document, selectionOverride);
      commitEdit(result.document, result.cursor);
      return;
    }

    const result = deleteAfterRichTextPosition(document, cursorOverride);
    commitEdit(result.document, result.cursor);
  };

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
