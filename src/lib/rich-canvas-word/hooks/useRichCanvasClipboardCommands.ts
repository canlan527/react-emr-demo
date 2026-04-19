import { Dispatch, SetStateAction } from 'react';
import {
  deleteRichTextSelection,
  extractRichTextSelectionPlainText,
  extractRichTextSelectionSlice,
  insertRichTextSliceAtPosition,
  richTextSliceToPlainText,
} from '../editing/richTextEditing';
import { parseHtmlToRichTextSlice, readClipboardHtml, writeRichTextClipboard } from '../editing/richTextClipboard';
import type { RichTextClipboardSlice, RichTextDocument, RichTextPosition, RichTextSelection } from '../richTypes';

type UseRichCanvasClipboardCommandsOptions = {
  commitEdit: (nextDocument: RichTextDocument, nextCursor: RichTextPosition | null, nextSelection?: RichTextSelection | null) => void;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  getInitialPosition: (document: RichTextDocument) => RichTextPosition | null;
  insertText: (value: string, cursorOverride?: RichTextPosition | null, selectionOverride?: RichTextSelection | null) => void;
  richClipboard: RichTextClipboardSlice | null;
  selection: RichTextSelection | null;
  setRichClipboard: Dispatch<SetStateAction<RichTextClipboardSlice | null>>;
  setToast: Dispatch<SetStateAction<string>>;
};

export function useRichCanvasClipboardCommands({
  commitEdit,
  cursor,
  document,
  getInitialPosition,
  insertText,
  richClipboard,
  selection,
  setRichClipboard,
  setToast,
}: UseRichCanvasClipboardCommandsOptions) {
  const copySelection = async () => {
    const value = extractRichTextSelectionPlainText(document, selection);
    if (!value) {
      return;
    }

    const slice = extractRichTextSelectionSlice(document, selection);
    setRichClipboard(slice);
    await writeRichTextClipboard(slice, value);
    setToast('已复制到剪切板，包含富文本格式');
  };

  const cutSelection = async () => {
    const value = extractRichTextSelectionPlainText(document, selection);
    if (!value) {
      return;
    }

    const slice = extractRichTextSelectionSlice(document, selection);
    setRichClipboard(slice);
    await writeRichTextClipboard(slice, value);
    const result = deleteRichTextSelection(document, selection);
    commitEdit(result.document, result.cursor);
    setToast('已剪切到剪切板，包含富文本格式');
  };

  const pasteClipboard = async () => {
    const value = await navigator.clipboard.readText();
    const html = await readClipboardHtml();
    if (!value && !html) {
      return;
    }

    const richClipboardText = richTextSliceToPlainText(richClipboard);
    if (richClipboard && value === richClipboardText) {
      const base = selection ? deleteRichTextSelection(document, selection) : { document, cursor: cursor ?? getInitialPosition(document) };
      const result = insertRichTextSliceAtPosition(base.document, base.cursor, richClipboard);
      if (result) {
        commitEdit(result.document, result.cursor, result.selection);
        setToast('已粘贴富文本格式');
        return;
      }
    }

    const externalSlice = parseHtmlToRichTextSlice(html);
    if (externalSlice) {
      const base = selection ? deleteRichTextSelection(document, selection) : { document, cursor: cursor ?? getInitialPosition(document) };
      const result = insertRichTextSliceAtPosition(base.document, base.cursor, externalSlice);
      if (result) {
        commitEdit(result.document, result.cursor, result.selection);
        setToast('已粘贴外部富文本格式');
        return;
      }
    }

    if (!value) {
      return;
    }

    insertText(value);
    setToast('已粘贴到文档');
  };

  return {
    copySelection,
    cutSelection,
    pasteClipboard,
  };
}
