import type { RichTextAlign, RichTextDocument, RichTextMarks } from '../richTypes';
import { isRichTextTextBlockType } from './richTextBlocks';

// rich-canvas-word v1 草稿持久化。
//
// 当前阶段先使用 localStorage，后续接后端 API 时可以保留这个保存包结构：
// - schemaVersion 用于未来模型升级。
// - savedAt 用于 UI 展示和冲突判断。
// - document 保存真正的 RichTextDocument。

const richCanvasWordDraftKey = 'rich-canvas-word:v1:draft';
const richCanvasWordSchemaVersion = 1;

export type RichCanvasWordSavedState = {
  schemaVersion: typeof richCanvasWordSchemaVersion;
  document: RichTextDocument;
  savedAt: string;
};

type SaveDraftResult =
  | {
      ok: true;
      savedAt: string;
    }
  | {
      ok: false;
      error: unknown;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isRichTextAlign(value: unknown): value is RichTextAlign {
  return value === 'left' || value === 'center' || value === 'right';
}

function isRichTextMarks(value: unknown): value is RichTextMarks {
  return isRecord(value);
}

function isRichTextRun(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string' && isRichTextMarks(value.marks);
}

function isRichTextDocument(value: unknown): value is RichTextDocument {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.blocks)) {
    return false;
  }

  return value.blocks.every((block) => {
    if (!isRecord(block) || typeof block.id !== 'string' || typeof block.type !== 'string') {
      return false;
    }

    if (isRichTextTextBlockType(block.type)) {
      return isRichTextAlign(block.align) && Array.isArray(block.runs) && block.runs.every(isRichTextRun);
    }

    if (block.type === 'table') {
      return (
        Array.isArray(block.rows) &&
        block.rows.every(
          (row) =>
            isRecord(row) &&
            typeof row.id === 'string' &&
            Array.isArray(row.cells) &&
            row.cells.every(
              (cell) =>
                isRecord(cell) &&
                typeof cell.id === 'string' &&
                (cell.align === undefined || isRichTextAlign(cell.align)) &&
                Array.isArray(cell.runs) &&
                cell.runs.every(isRichTextRun),
            ),
        )
      );
    }

    return false;
  });
}

function isSavedState(value: unknown): value is RichCanvasWordSavedState {
  return (
    isRecord(value) &&
    value.schemaVersion === richCanvasWordSchemaVersion &&
    typeof value.savedAt === 'string' &&
    isRichTextDocument(value.document)
  );
}

export function loadRichCanvasWordDraft(): RichCanvasWordSavedState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(richCanvasWordDraftKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return isSavedState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRichCanvasWordDraft(document: RichTextDocument): SaveDraftResult {
  if (typeof window === 'undefined') {
    return { ok: false, error: new Error('localStorage is unavailable') };
  }

  const savedAt = new Date().toISOString();
  const payload: RichCanvasWordSavedState = {
    schemaVersion: richCanvasWordSchemaVersion,
    document,
    savedAt,
  };

  try {
    window.localStorage.setItem(richCanvasWordDraftKey, JSON.stringify(payload));
    return { ok: true, savedAt };
  } catch (error) {
    return { ok: false, error };
  }
}

export function clearRichCanvasWordDraft() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(richCanvasWordDraftKey);
}
