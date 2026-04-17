import { CompositionEvent, FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  MedicalRecordDocument,
  canvasWordLayout,
  createMedicalRecordDocument,
  documentToPlainText,
} from './medicalRecordDocument';
import {
  drawLayoutLine,
  findCursorLine,
  fitIndexInLine,
  layoutCanvasText,
  measureLinePrefix,
  sourceCursorForVisualOffset,
  visualOffsetForSourceCursor,
} from './canvasTextLayout';
import { deleteBefore, deleteRange, insertText, replaceRange } from './textEditing';
import { createSelectionRects, normalizeSelection } from './textSelection';
import type { PatientInfo } from '../data/vitals';
import type { LayoutLine } from './canvasTextLayout';
import type { TextSelection } from './textSelection';

type CanvasWordRecordProps = {
  patient: PatientInfo;
};

type ContextMenuState = {
  x: number;
  y: number;
};

type CursorHitMode = 'caret' | 'selection';

type HistoryState = {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
};

type HistorySnapshot = {
  text: string;
  cursor: number;
};

const minCanvasHeight = canvasWordLayout.pageHeight;
const toastDuration = 1600;
const maxHistorySize = 100;

const clampCursor = (value: number, textLength: number) => Math.max(0, Math.min(value, textLength));

export function CanvasWordRecord({ patient }: CanvasWordRecordProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const targetXRef = useRef<number | null>(null);
  const composingRef = useRef(false);
  const draggingSelectionRef = useRef(false);
  const document = useMemo<MedicalRecordDocument>(() => createMedicalRecordDocument(patient), [patient]);
  const [text, setText] = useState(() => documentToPlainText(document));
  const [cursor, setCursor] = useState(0);
  const [layout, setLayout] = useState<{ lines: LayoutLine[]; pages: number }>({ lines: [], pages: 1 });
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [toast, setToast] = useState('');
  // Plain-text history is enough for the current editor; rich text will need document-level snapshots.
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [loadedAt, setLoadedAt] = useState(document.updatedAt);

  // The hidden textarea is only an IME anchor; Canvas remains the visual source of truth.
  const syncInputPosition = (nextLayout = layout, nextCursor = cursor) => {
    const editor = editorRef.current;
    const canvas = canvasRef.current;
    const input = inputRef.current;
    const context = canvas?.getContext('2d');
    const cursorLine = findCursorLine(nextLayout.lines, nextCursor);

    if (!editor || !canvas || !input || !context || !cursorLine) {
      return;
    }

    const cursorOffset = visualOffsetForSourceCursor(cursorLine, nextCursor);
    const canvasRect = canvas.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const cursorX = cursorLine.x + measureLinePrefix(context, cursorLine, cursorOffset);
    const cursorY = cursorLine.y - canvasWordLayout.lineHeight + 7;

    input.style.left = `${canvasRect.left - editorRect.left + cursorX}px`;
    input.style.top = `${canvasRect.top - editorRect.top + cursorY}px`;
  };

  const getCanvasHit = (event: MouseEvent<HTMLCanvasElement>, anchor?: number, mode: CursorHitMode = 'caret') => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || layout.lines.length === 0) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const line =
      layout.lines.find((item) => y >= item.y - canvasWordLayout.lineHeight && y <= item.y + 8) ??
      layout.lines.reduce((closest, item) => (Math.abs(item.y - y) < Math.abs(closest.y - y) ? item : closest));

    const textLength = Array.from(line.text).length;
    const textWidth = measureLinePrefix(context, line, textLength);
    const contentWidth = canvasWordLayout.pageWidth - canvasWordLayout.marginX * 2;

    // Drag selection snaps near visual line edges, matching the way word processors select whole line tails.
    if (mode === 'selection') {
      const textRight = line.x + textWidth;
      const nearLineEnd = line.x + measureLinePrefix(context, line, Math.max(0, textLength - 2));
      const lineEndZone = line.x + contentWidth * 0.7;
      const lineStartZone = line.x + contentWidth * 0.3;

      if (anchor !== undefined && anchor < line.start && x >= lineEndZone) {
        return { cursor: line.end, lineIndex: line.lineIndex, offset: textLength };
      }

      if (anchor !== undefined && anchor > line.end && x <= lineStartZone) {
        return { cursor: line.start, lineIndex: line.lineIndex, offset: 0 };
      }

      if (x >= nearLineEnd || x >= textRight - 2) {
        return { cursor: line.end, lineIndex: line.lineIndex, offset: textLength };
      }

      if (x <= line.x) {
        return { cursor: line.start, lineIndex: line.lineIndex, offset: 0 };
      }
    }

    if (anchor !== undefined && anchor < line.start && y > line.y - canvasWordLayout.lineHeight / 2) {
      return { cursor: line.end, lineIndex: line.lineIndex, offset: textLength };
    }

    if (anchor !== undefined && anchor > line.end && y < line.y - canvasWordLayout.lineHeight / 2) {
      return { cursor: line.start, lineIndex: line.lineIndex, offset: 0 };
    }

    if (anchor !== undefined && x >= line.x + textWidth - 2) {
      return { cursor: line.end, lineIndex: line.lineIndex, offset: textLength };
    }

    const cursor = fitIndexInLine(context, line, x);
    return { cursor, lineIndex: line.lineIndex, offset: visualOffsetForSourceCursor(line, cursor) };
  };

  const getCursorFromCanvasPoint = (event: MouseEvent<HTMLCanvasElement>, anchor?: number, mode: CursorHitMode = 'caret') => {
    return getCanvasHit(event, anchor, mode)?.cursor ?? null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    // Measure first, then size the bitmap backing store to keep text crisp on high-DPI screens.
    const measureLayout = layoutCanvasText(context, text);
    const cssWidth = canvasWordLayout.pageWidth;
    const cssHeight = Math.max(minCanvasHeight, measureLayout.pages * canvasWordLayout.pageHeight + (measureLayout.pages - 1) * canvasWordLayout.pageGap);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.fillStyle = '#e6edf2';
    context.fillRect(0, 0, cssWidth, cssHeight);

    for (let page = 0; page < measureLayout.pages; page += 1) {
      const pageTop = page * (canvasWordLayout.pageHeight + canvasWordLayout.pageGap);
      context.fillStyle = '#ffffff';
      context.shadowColor = 'rgba(25, 39, 68, 0.16)';
      context.shadowBlur = 18;
      context.shadowOffsetY = 8;
      context.fillRect(0, pageTop, canvasWordLayout.pageWidth, canvasWordLayout.pageHeight);
      context.shadowColor = 'transparent';
      context.strokeStyle = '#d7deeb';
      context.strokeRect(0.5, pageTop + 0.5, canvasWordLayout.pageWidth - 1, canvasWordLayout.pageHeight - 1);
      context.fillStyle = '#8a97aa';
      context.font = '12px "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText(`第 ${page + 1} 页`, canvasWordLayout.pageWidth / 2, pageTop + canvasWordLayout.pageHeight - 28);
    }

    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';

    const activeRange = normalizeSelection(selection);
    if (activeRange) {
      context.fillStyle = 'rgba(79, 142, 247, 0.26)';
      createSelectionRects(context, measureLayout.lines, selection!).forEach((rect) => {
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      });
    }

    measureLayout.lines.forEach((line) => {
      context.fillStyle = line.start === 0 ? '#172033' : '#263248';
      drawLayoutLine(context, line);
    });

    const cursorLine = findCursorLine(measureLayout.lines, cursor);
    if (cursorLine && !activeRange) {
      const cursorOffset = visualOffsetForSourceCursor(cursorLine, cursor);
      const cursorX = cursorLine.x + measureLinePrefix(context, cursorLine, cursorOffset);
      context.strokeStyle = '#d64545';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(cursorX, cursorLine.y - canvasWordLayout.lineHeight + 7);
      context.lineTo(cursorX, cursorLine.y + 5);
      context.stroke();
    }

    setLayout(measureLayout);
    syncInputPosition(measureLayout, cursor);
  }, [cursor, selection, text]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const handleScroll = () => syncInputPosition();
    scroller.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  });

  useEffect(() => {
    const stopDragging = () => {
      draggingSelectionRef.current = false;
      setSelection((current) => (normalizeSelection(current) ? current : null));
    };

    window.addEventListener('mouseup', stopDragging);
    return () => window.removeEventListener('mouseup', stopDragging);
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(''), toastDuration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const focusInput = () => {
    syncInputPosition();
    inputRef.current?.focus({ preventScroll: true });
  };

  const getSelectedText = () => {
    const range = normalizeSelection(selection);
    return range ? text.slice(range.start, range.end) : '';
  };

  const writeClipboard = async (value: string) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // Clipboard permissions can be denied by the embedded browser; keep editor state unchanged.
    }
  };

  const readClipboard = async () => {
    try {
      return (await navigator.clipboard?.readText?.()) ?? '';
    } catch {
      return '';
    }
  };

  const deleteSelection = () => {
    const range = normalizeSelection(selection);
    if (!range) {
      return false;
    }

    commitTextChange(deleteRange(text, range.start, range.end), range.start);
    return true;
  };

  const restoreHistorySnapshot = (snapshot: HistorySnapshot) => {
    setText(snapshot.text);
    setCursor(clampCursor(snapshot.cursor, snapshot.text.length));
    setSelection(null);
    targetXRef.current = null;
    resetInputValue();
  };

  const commitTextChange = (nextText: string, nextCursor: number) => {
    if (nextText === text) {
      setCursor(clampCursor(nextCursor, nextText.length));
      setSelection(null);
      targetXRef.current = null;
      return;
    }

    setHistory((current) => ({
      past: [...current.past, { text, cursor }].slice(-maxHistorySize),
      future: [],
    }));
    setText(nextText);
    setCursor(clampCursor(nextCursor, nextText.length));
    setSelection(null);
    targetXRef.current = null;
  };

  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous) {
      return;
    }

    setHistory({
      past: history.past.slice(0, -1),
      future: [{ text, cursor }, ...history.future].slice(0, maxHistorySize),
    });
    restoreHistorySnapshot(previous);
  };

  const redo = () => {
    const next = history.future[0];
    if (!next) {
      return;
    }

    setHistory({
      past: [...history.past, { text, cursor }].slice(-maxHistorySize),
      future: history.future.slice(1),
    });
    restoreHistorySnapshot(next);
  };

  const undoFromMenu = () => {
    undo();
    setContextMenu(null);
    focusInput();
  };

  const redoFromMenu = () => {
    redo();
    setContextMenu(null);
    focusInput();
  };

  const replaceSelectionOrInsert = (value: string) => {
    const range = normalizeSelection(selection);
    if (range) {
      commitTextChange(replaceRange(text, range.start, range.end, value), range.start + value.length);
    } else {
      commitTextChange(insertText(text, cursor, value), cursor + value.length);
    }
  };

  const commitInput = (value: string) => {
    if (!value) {
      return;
    }

    replaceSelectionOrInsert(value);
  };

  const resetInputValue = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const moveVertical = (direction: -1 | 1) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const currentLine = findCursorLine(layout.lines, cursor);
    if (!context || !currentLine) {
      return;
    }

    const offset = visualOffsetForSourceCursor(currentLine, cursor);
    const currentX = currentLine.x + measureLinePrefix(context, currentLine, offset);
    // Keep the intended x position while moving across lines of different lengths.
    const targetX = targetXRef.current ?? currentX;
    targetXRef.current = targetX;

    const nextLine = layout.lines[currentLine.lineIndex + direction];
    if (!nextLine) {
      return;
    }

    setCursor(fitIndexInLine(context, nextLine, targetX));
    setSelection(null);
  };

  const moveToCurrentLineBoundary = (boundary: 'start' | 'end') => {
    const currentLine = findCursorLine(layout.lines, cursor);
    if (!currentLine) {
      return;
    }

    const offset = boundary === 'start' ? 0 : Array.from(currentLine.text).length;
    setCursor(sourceCursorForVisualOffset(currentLine, offset));
    setSelection(null);
    targetXRef.current = null;
  };

  const selectAllText = () => {
    setSelection({ anchor: 0, focus: text.length });
    setCursor(text.length);
    targetXRef.current = null;
  };

  const copySelection = async () => {
    await writeClipboard(getSelectedText());
    setToast('已复制');
    setContextMenu(null);
    focusInput();
  };

  const cutSelection = async () => {
    const value = getSelectedText();
    if (!value) {
      return;
    }

    await writeClipboard(value);
    setToast('已复制');
    deleteSelection();
    setContextMenu(null);
    focusInput();
  };

  const pasteClipboard = async () => {
    const value = await readClipboard();
    if (value) {
      replaceSelectionOrInsert(value);
    }
    setContextMenu(null);
    focusInput();
  };

  const deleteSelectionFromMenu = () => {
    deleteSelection();
    setContextMenu(null);
    focusInput();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const shortcut = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (shortcut && key === 'c') {
      event.preventDefault();
      void copySelection();
      return;
    }

    if (shortcut && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if (shortcut && key === 'a') {
      event.preventDefault();
      selectAllText();
      return;
    }

    if (shortcut && event.key === 'ArrowLeft') {
      event.preventDefault();
      moveToCurrentLineBoundary('start');
      return;
    }

    if (shortcut && event.key === 'ArrowRight') {
      event.preventDefault();
      moveToCurrentLineBoundary('end');
      return;
    }

    if (shortcut && event.key === 'ArrowUp') {
      event.preventDefault();
      moveVertical(-1);
      return;
    }

    if (shortcut && event.key === 'ArrowDown') {
      event.preventDefault();
      moveVertical(1);
      return;
    }

    if (shortcut && key === 'x') {
      event.preventDefault();
      void cutSelection();
      return;
    }

    if (shortcut && key === 'v') {
      event.preventDefault();
      void pasteClipboard();
      return;
    }

    if (event.key === 'Escape') {
      setContextMenu(null);
      setSelection(null);
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.nativeEvent.isComposing || composingRef.current) {
      return;
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      targetXRef.current = null;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (deleteSelection()) {
        return;
      }
      commitTextChange(deleteBefore(text, cursor), Math.max(0, cursor - 1));
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      if (deleteSelection()) {
        return;
      }
      commitTextChange(deleteRange(text, cursor, Math.min(text.length, cursor + 1)), cursor);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      replaceSelectionOrInsert('\n');
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setCursor((current) => Math.max(0, current - 1));
      setSelection(null);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setCursor((current) => Math.min(text.length, current + 1));
      setSelection(null);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveVertical(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveVertical(1);
      return;
    }
  };

  const handleInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) {
      return;
    }

    const value = event.currentTarget.value;
    commitInput(value);
    event.currentTarget.value = '';
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false;
    commitInput(event.data || event.currentTarget.value);
    event.currentTarget.value = '';
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return;
    }

    const hit = getCanvasHit(event);
    if (!hit) {
      return;
    }

    event.preventDefault();
    setContextMenu(null);
    draggingSelectionRef.current = true;
    setCursor(hit.cursor);
    setSelection({
      anchor: hit.cursor,
      focus: hit.cursor,
      anchorLineIndex: hit.lineIndex,
      anchorOffset: hit.offset,
      focusLineIndex: hit.lineIndex,
      focusOffset: hit.offset,
    });
    targetXRef.current = null;
    focusInput();
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!draggingSelectionRef.current || event.buttons !== 1) {
      return;
    }

    const hit = getCanvasHit(event, selection?.anchor, 'selection');
    if (!hit) {
      return;
    }

    setCursor(hit.cursor);
    setSelection((current) => (current ? { ...current, focus: hit.cursor, focusLineIndex: hit.lineIndex, focusOffset: hit.offset } : null));
  };

  const handleMouseUp = () => {
    draggingSelectionRef.current = false;
    setSelection((current) => (normalizeSelection(current) ? current : null));
  };

  const handleContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const nextCursor = getCursorFromCanvasPoint(event);
    const range = normalizeSelection(selection);

    if (!range && nextCursor !== null) {
      setCursor(nextCursor);
    }

    setContextMenu({ x: event.clientX, y: event.clientY });
    focusInput();
  };

  const loadDocument = () => {
    const nextDocument = createMedicalRecordDocument(patient);
    setText(documentToPlainText(nextDocument));
    setCursor(0);
    setSelection(null);
    setHistory({ past: [], future: [] });
    setLoadedAt(nextDocument.updatedAt);
    resetInputValue();
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    focusInput();
  };

  return (
    <section className="emr-panel" aria-label="电子病历">
      <div className="emr-toolbar">
        <div>
          <p className="eyebrow">Canvas Word Record</p>
          <h2>{document.title}</h2>
          <p className="subtitle">
            原生 Canvas 文本绘制 · 自动换行 · 光标编辑 · 分页预览 · 最近加载 {loadedAt}
          </p>
        </div>
        <div className="emr-actions">
          <span>{layout.pages} 页</span>
          <button className="btn btn-secondary" type="button" onClick={loadDocument}>
            加载病历文档
          </button>
        </div>
      </div>
      <div className="emr-editor" ref={editorRef} onClick={focusInput}>
        {toast ? <div className="emr-toast">{toast}</div> : null}
        <textarea
          ref={inputRef}
          className="emr-ime-input"
          aria-label="电子病历输入代理"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onCompositionEnd={handleCompositionEnd}
          onCompositionStart={handleCompositionStart}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
        <div className="emr-ruler">A4 基础版，点击文档定位光标，支持中文输入法、方向键和 Backspace。</div>
        <div className="emr-scroller" ref={scrollerRef}>
          <canvas
            ref={canvasRef}
            onContextMenu={handleContextMenu}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            aria-label="电子病历画布编辑器"
          />
        </div>
        {contextMenu ? (
          <div
            className="emr-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={undoFromMenu} disabled={history.past.length === 0}>
              撤销 <span>Ctrl/Cmd+Z</span>
            </button>
            <button type="button" onClick={redoFromMenu} disabled={history.future.length === 0}>
              重做 <span>Ctrl/Cmd+Shift+Z</span>
            </button>
            <button type="button" onClick={() => void copySelection()} disabled={!normalizeSelection(selection)}>
              复制 <span>Ctrl/Cmd+C</span>
            </button>
            <button type="button" onClick={() => void cutSelection()} disabled={!normalizeSelection(selection)}>
              剪切 <span>Ctrl/Cmd+X</span>
            </button>
            <button type="button" onClick={() => void pasteClipboard()}>
              粘贴 <span>Ctrl/Cmd+V</span>
            </button>
            <button type="button" onClick={deleteSelectionFromMenu} disabled={!normalizeSelection(selection)}>
              删除 <span>Del/Backspace</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
