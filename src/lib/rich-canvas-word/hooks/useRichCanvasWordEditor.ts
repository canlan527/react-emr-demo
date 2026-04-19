import { useEffect, useState } from 'react';
import { sampleRichTextDocument } from '../document/richTextDocument';
import { useRichCanvasClipboardCommands } from './useRichCanvasClipboardCommands';
import { useRichCanvasFormatCommands } from './useRichCanvasFormatCommands';
import { useRichCanvasHistory } from './useRichCanvasHistory';
import { useRichCanvasTextCommands } from './useRichCanvasTextCommands';
import type {
  RichTextClipboardSlice,
  RichTextDocument,
  RichTextMarks,
  RichTextPosition,
  RichTextSelection,
  ToolbarCommand,
} from '../richTypes';

const toastDuration = 1600;
const zoomLevels = [0.75, 1, 1.25, 1.5];

function getInitialRichTextPosition(document: RichTextDocument): RichTextPosition | null {
  const firstBlock = document.blocks[0];
  const firstRun = firstBlock?.runs[0];
  if (!firstBlock || !firstRun) {
    return null;
  }

  return {
    blockId: firstBlock.id,
    runId: firstRun.id,
    offset: 0,
  };
}

// Central editor state and command hook for rich-canvas-word v1.
// The presentational Record component should only wire toolbar + surface together.
export function useRichCanvasWordEditor() {
  const [document, setDocument] = useState<RichTextDocument>(sampleRichTextDocument);
  const [cursor, setCursor] = useState<RichTextPosition | null>(() => getInitialRichTextPosition(sampleRichTextDocument));
  const [selection, setSelection] = useState<RichTextSelection | null>(null);
  const [activeMarks, setActiveMarks] = useState<RichTextMarks>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const [richClipboard, setRichClipboard] = useState<RichTextClipboardSlice | null>(null);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(''), toastDuration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const { canRedo, canUndo, commitEdit, redo, undo } = useRichCanvasHistory({
    activeMarks,
    cursor,
    document,
    selection,
    setActiveMarks,
    setCursor,
    setDocument,
    setSelection,
    setToast,
  });

  const { applyAlignCommand, applyFormatCommand, toolbarItems } = useRichCanvasFormatCommands({
    activeMarks,
    canRedo,
    canUndo,
    commitEdit,
    cursor,
    document,
    selection,
    setActiveMarks,
    setToast,
    zoom,
  });

  const handleToolbarCommand = (command: ToolbarCommand) => {
    setFocusRequest((value) => value + 1);

    if (command === 'undo') {
      undo();
      return;
    }

    if (command === 'redo') {
      redo();
      return;
    }

    if (command === 'alignLeft' || command === 'alignCenter' || command === 'alignRight') {
      applyAlignCommand(command === 'alignLeft' ? 'left' : command === 'alignCenter' ? 'center' : 'right');
      return;
    }

    if (command === 'zoom') {
      setZoom((current) => {
        const currentIndex = zoomLevels.findIndex((item) => item === current);
        const nextZoom = zoomLevels[(currentIndex + 1) % zoomLevels.length] ?? 1;
        setToast(`缩放 ${Math.round(nextZoom * 100)}%`);
        return nextZoom;
      });
      return;
    }

    applyFormatCommand(command);
  };

  const { deleteAfter, deleteBefore, insertText, splitBlock } = useRichCanvasTextCommands({
    activeMarks,
    commitEdit,
    cursor,
    document,
    getInitialPosition: getInitialRichTextPosition,
    selection,
  });

  const { copySelection, cutSelection, pasteClipboard } = useRichCanvasClipboardCommands({
    commitEdit,
    cursor,
    document,
    getInitialPosition: getInitialRichTextPosition,
    insertText,
    richClipboard,
    selection,
    setRichClipboard,
    setToast,
  });

  const cancelSelection = () => {
    if (!selection) {
      return;
    }

    setSelection(null);
    setToast('已取消选择');
  };

  return {
    cursor,
    document,
    focusRequest,
    selection,
    toast,
    toolbarItems,
    zoom,
    cancelSelection,
    copySelection,
    cutSelection,
    deleteAfter,
    deleteBefore,
    handleToolbarCommand,
    insertText,
    pasteClipboard,
    redo,
    setCursor,
    setSelection,
    splitBlock,
    applyFormatCommand,
    undo,
  };
}
