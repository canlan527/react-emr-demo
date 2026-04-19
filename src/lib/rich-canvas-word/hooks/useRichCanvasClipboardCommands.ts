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

// 剪贴板命令 hook。
//
// 这里负责“选择哪种粘贴来源”：
// 1. 内部 richClipboard 与 text/plain 匹配时，优先粘贴内部 slice。
// 2. 否则尝试解析系统 text/html。
// 3. 最后降级为 text/plain 普通文本粘贴。

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
  // 复制：同时保存内部 slice，并写入系统 text/html + text/plain。
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

  // 剪切：复制逻辑之后删除选区，并把删除结果提交进 history。
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

  // 粘贴：优先保留富文本格式；无法解析时保证纯文本可用。
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
