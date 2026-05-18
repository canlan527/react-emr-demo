import type { RichTextDocument } from '../richTypes';
import { getRichTextBlockPlainText } from './richTextBlocks';

export type RichCanvasWordExportState = {
  schemaVersion: 1;
  exportedAt: string;
  document: RichTextDocument;
};

export function serializeRichTextDocumentToPlainText(document: RichTextDocument) {
  return document.blocks.map(getRichTextBlockPlainText).join('\n');
}

export function serializeRichTextDocumentToJson(document: RichTextDocument) {
  const payload: RichCanvasWordExportState = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    document,
  };

  return JSON.stringify(payload, null, 2);
}
