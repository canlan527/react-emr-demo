import { Dispatch, SetStateAction, useState } from 'react';
import type { RichTextDocument, RichTextMarks, RichTextPosition, RichTextSelection } from '../richTypes';

type RichHistorySnapshot = {
  activeMarks: RichTextMarks;
  document: RichTextDocument;
  cursor: RichTextPosition | null;
  selection: RichTextSelection | null;
};

type RichHistoryState = {
  past: RichHistorySnapshot[];
  future: RichHistorySnapshot[];
};

const maxHistorySize = 100;

type UseRichCanvasHistoryOptions = {
  activeMarks: RichTextMarks;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  selection: RichTextSelection | null;
  setActiveMarks: Dispatch<SetStateAction<RichTextMarks>>;
  setCursor: Dispatch<SetStateAction<RichTextPosition | null>>;
  setDocument: Dispatch<SetStateAction<RichTextDocument>>;
  setSelection: Dispatch<SetStateAction<RichTextSelection | null>>;
  setToast: Dispatch<SetStateAction<string>>;
};

export function useRichCanvasHistory({
  activeMarks,
  cursor,
  document,
  selection,
  setActiveMarks,
  setCursor,
  setDocument,
  setSelection,
  setToast,
}: UseRichCanvasHistoryOptions) {
  const [history, setHistory] = useState<RichHistoryState>({ past: [], future: [] });

  const createCurrentSnapshot = (): RichHistorySnapshot => ({
    activeMarks,
    document,
    cursor,
    selection,
  });

  const commitEdit = (
    nextDocument: RichTextDocument,
    nextCursor: RichTextPosition | null,
    nextSelection: RichTextSelection | null = null,
  ) => {
    if (nextDocument !== document) {
      setHistory((current) => ({
        past: [...current.past, createCurrentSnapshot()].slice(-maxHistorySize),
        future: [],
      }));
    }

    setDocument(nextDocument);
    setCursor(nextCursor);
    setSelection(nextSelection);
  };

  const undo = () => {
    const snapshot = history.past[history.past.length - 1];
    if (!snapshot) {
      return;
    }

    setHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [createCurrentSnapshot(), ...current.future].slice(0, maxHistorySize),
    }));
    setDocument(snapshot.document);
    setCursor(snapshot.cursor);
    setSelection(snapshot.selection);
    setActiveMarks(snapshot.activeMarks);
    setToast('已撤销操作');
  };

  const redo = () => {
    const snapshot = history.future[0];
    if (!snapshot) {
      return;
    }

    setHistory((current) => ({
      past: [...current.past, createCurrentSnapshot()].slice(-maxHistorySize),
      future: current.future.slice(1),
    }));
    setDocument(snapshot.document);
    setCursor(snapshot.cursor);
    setSelection(snapshot.selection);
    setActiveMarks(snapshot.activeMarks);
    setToast('已回退');
  };

  return {
    canRedo: history.future.length > 0,
    canUndo: history.past.length > 0,
    commitEdit,
    redo,
    undo,
  };
}
