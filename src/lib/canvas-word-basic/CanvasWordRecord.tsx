/**
 * v0 Canvas Word 的容器组件。
 *
 * 职责：
 * - 组装病历文档、标题栏和 Canvas Word Surface。
 * - 持有 DOM refs、layout、右键菜单位置和加载时间等容器级状态。
 * - 协调 renderer、editor hook、keyboard hook、mouse selection hook 和 IME hook。
 *
 * 不直接负责：
 * - 具体 Canvas 绘制，见 layout/canvasWordRenderer.ts。
 * - 文本编辑命令和历史栈，见 hooks/useCanvasWordEditor.ts。
 * - 键盘分发，见 hooks/useCanvasWordKeyboard.ts。
 * - 鼠标选区事件，见 hooks/useCanvasWordMouseSelection.ts。
 * - IME 输入代理，见 hooks/useImeAnchor.ts。
 */
import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  MedicalRecordDocument,
  canvasWordLayout,
  createMedicalRecordDocument,
  documentToPlainText,
} from '../medical-record/medicalRecordDocument';
import {
  findCursorLine,
  fitIndexInLine,
  measureLinePrefix,
  sourceCursorForVisualOffset,
  visualOffsetForSourceCursor,
} from './layout/canvasTextLayout';
import { CanvasWordSurface } from './components/CanvasWordSurface';
import { renderCanvasWord } from './layout/canvasWordRenderer';
import { normalizeSelection } from './editing/textSelection';
import { useImeAnchor } from './hooks/useImeAnchor';
import { useCanvasWordEditor } from './hooks/useCanvasWordEditor';
import { useCanvasWordKeyboard } from './hooks/useCanvasWordKeyboard';
import { useCanvasWordMouseSelection } from './hooks/useCanvasWordMouseSelection';
import type { LayoutLine } from './layout/canvasTextLayout';
import type { CanvasWordRecordProps, ContextMenuState, CursorHitMode } from './wordTypes';

const toastDuration = 1600;

// v0 基础 Canvas Word 组件：当前仍是纯文本模型，Canvas 负责所有可见内容。
export function CanvasWordRecord({ patient }: CanvasWordRecordProps) {
  // DOM refs: editor 用于定位隐藏 textarea，canvas 负责绘制，scroller 负责页面滚动。
  const editorRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // 上下方向键移动时保留目标 x，模拟 Word 中跨行移动光标的手感。
  const targetXRef = useRef<number | null>(null);
  const document = useMemo<MedicalRecordDocument>(() => createMedicalRecordDocument(patient), [patient]);
  // layout 是 Canvas 视觉行结果，鼠标命中、光标绘制、选区矩形都依赖它。
  const [layout, setLayout] = useState<{ lines: LayoutLine[]; pages: number }>({ lines: [], pages: 1 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [loadedAt, setLoadedAt] = useState(document.updatedAt);

  // 每次 IME/input 提交后都要清空 textarea，否则下一次 input 会重复提交旧内容。
  const resetInputValue = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // v0 将结构化病历文档转成纯文本后编辑；富文本版本会升级为 document-level state。
  const {
    text,
    cursor,
    selection,
    toast,
    history,
    setCursor,
    setSelection,
    setToast,
    commitInput,
    deleteAfterCursor,
    deleteBeforeCursor,
    pasteClipboard,
    redo,
    replaceSelectionOrInsert,
    resetEditorText,
    selectAllText: selectAllEditorText,
    undo,
    copySelection: copySelectedText,
    cutSelection: cutSelectedText,
  } = useCanvasWordEditor(documentToPlainText(document), {
    onInputReset: resetInputValue,
    onTransientReset: () => {
      targetXRef.current = null;
    },
  });

  const { focusInput, handleCompositionEnd, handleCompositionStart, handleInput, isComposing, syncInputPosition } = useImeAnchor({
    editorRef,
    canvasRef,
    inputRef,
    layout,
    cursor,
    commitInput,
    resetInputValue,
  });

  // 将鼠标事件转换成文档光标位置，并附带视觉行信息供选区使用。
  const getCanvasHit = (event: MouseEvent<HTMLCanvasElement>, anchor?: number, mode: CursorHitMode = 'caret') => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || layout.lines.length === 0) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // 优先命中鼠标所在的行；如果点在行间或页边，退到 y 距离最近的行。
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
      // 拖选跨行时，把行首/行尾一大片区域视为整行边界，避免选区在行尾空白处抖动。
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

    // anchor 表示正在从另一行拖选过来；这些分支让跨行拖选更容易吸附到行首或行尾。
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

  // 核心绘制 effect：任何文本、光标或选区变化，都重新排版并重绘整张 Canvas。
  useEffect(() => {
    const result = renderCanvasWord({ canvas: canvasRef.current, text, cursor, selection });
    if (!result) {
      return;
    }

    setLayout(result.layout);
    syncInputPosition(result.layout, cursor);
  }, [cursor, selection, text]);

  // 滚动或窗口尺寸变化后，Canvas 视觉内容没有变，但隐藏 textarea 的屏幕坐标需要跟着更新。
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

  // 点击页面其它位置或滚动时关闭右键菜单。
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  // toast 是短暂反馈，不进入编辑器状态机。
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(''), toastDuration);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  // Ctrl/Cmd + 左右移动到当前视觉行边界，而不是整个文档边界。
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

  const copySelection = async () => {
    await copySelectedText();
    setContextMenu(null);
    focusInput();
  };

  const cutSelection = async () => {
    await cutSelectedText();
    setContextMenu(null);
    focusInput();
  };

  const pasteClipboardFromMenu = async () => {
    await pasteClipboard();
    setContextMenu(null);
    focusInput();
  };

  const deleteSelectionFromMenu = () => {
    deleteAfterCursor();
    setContextMenu(null);
    focusInput();
  };

  const handleKeyDown = useCanvasWordKeyboard({
    textLength: text.length,
    isComposing,
    onCopy: () => void copySelection(),
    onCut: () => void cutSelection(),
    onPaste: () => void pasteClipboardFromMenu(),
    onUndo: undo,
    onRedo: redo,
    onSelectAll: selectAllEditorText,
    onMoveLineBoundary: moveToCurrentLineBoundary,
    onMoveVertical: moveVertical,
    onResetTargetX: () => {
      targetXRef.current = null;
    },
    onEscape: () => {
      setContextMenu(null);
      setSelection(null);
    },
    onDeleteBefore: deleteBeforeCursor,
    onDeleteAfter: deleteAfterCursor,
    onInsertText: replaceSelectionOrInsert,
    onMoveCursor: setCursor,
    onClearSelection: () => setSelection(null),
  });

  const { handleContextMenu, handleMouseDown, handleMouseMove, handleMouseUp } = useCanvasWordMouseSelection({
    selection,
    getCanvasHit,
    setCursor,
    setSelection,
    setContextMenu,
    onTransientReset: () => {
      targetXRef.current = null;
    },
    focusInput,
  });

  // 重新从 patient 生成示例病历，并清空编辑历史；相当于回到“加载文档”的初始状态。
  const loadDocument = () => {
    const nextDocument = createMedicalRecordDocument(patient);
    resetEditorText(documentToPlainText(nextDocument));
    setLoadedAt(nextDocument.updatedAt);
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
      <CanvasWordSurface
        editorRef={editorRef}
        inputRef={inputRef}
        scrollerRef={scrollerRef}
        canvasRef={canvasRef}
        toast={toast}
        contextMenu={contextMenu}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        hasSelection={Boolean(normalizeSelection(selection))}
        onEditorClick={focusInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCanvasContextMenu={handleContextMenu}
        onCanvasMouseDown={handleMouseDown}
        onCanvasMouseLeave={handleMouseUp}
        onCanvasMouseMove={handleMouseMove}
        onCanvasMouseUp={handleMouseUp}
        onUndo={undoFromMenu}
        onRedo={redoFromMenu}
        onCopy={() => void copySelection()}
        onCut={() => void cutSelection()}
        onPaste={() => void pasteClipboardFromMenu()}
        onDelete={deleteSelectionFromMenu}
      />
    </section>
  );
}
