import { RefObject, useEffect, useRef, useState } from 'react';
import { deleteRichTextSelection, insertTextAtRichPosition } from '../editing/richTextEditing';
import { insertTextInSelectedTableCell } from '../editing/richTextTableCommands';
import { getRichCursorRect } from '../layout/richTextLayout';
import { renderRichTextDocument } from '../layout/richTextRenderer';
import type {
  RichLayoutTableCell,
  RichTableCellSelection,
  RichTableSelection,
  RichTextDocument,
  RichTextLayoutResult,
  RichTextPosition,
  RichTextSearchMatch,
  RichTextSelection,
} from '../richTypes';

type UseRichCanvasRenderingInput = {
  compositionText: string;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  focusRequest: number;
  hideCursor: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  scrollerRef?: RefObject<HTMLDivElement | null>;
  searchActiveIndex: number;
  searchMatches: RichTextSearchMatch[];
  selection: RichTextSelection | null;
  tableCellSelection: RichTableCellSelection | null;
  tableSelection: RichTableSelection | null;
  zoom: number;
};

const tableCellInputPaddingX = 18;
const tableCellInputPaddingY = 12;

function getFontSizeFromCanvasFont(font: string) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 14;
}

function findSelectedTableCell(layout: RichTextLayoutResult, selection: RichTableCellSelection | null) {
  if (!selection) {
    return null;
  }

  return (
    layout.tables
      .find((table) => table.blockId === selection.tableBlockId && table.rowIndex === selection.rowIndex)
      ?.cells.find((cell) => cell.id === selection.cellId) ?? null
  );
}

function getTableCellInputRect(
  context: CanvasRenderingContext2D,
  cell: RichLayoutTableCell | null,
  selection: RichTableCellSelection | null,
) {
  if (!cell) {
    return null;
  }

  const selectedFragment =
    selection?.runId && selection.offset !== undefined
      ? cell.fragments.find(
          (fragment) =>
            fragment.runId === selection.runId &&
            selection.offset !== undefined &&
            selection.offset >= fragment.startOffset &&
            selection.offset <= fragment.endOffset,
        )
      : null;
  if (selectedFragment && selection?.offset !== undefined) {
    context.font = selectedFragment.font;
    const fontSize = getFontSizeFromCanvasFont(selectedFragment.font);
    let currentOffset = selectedFragment.startOffset;
    let prefix = '';

    for (const char of Array.from(selectedFragment.text)) {
      const nextOffset = currentOffset + char.length;
      if (nextOffset > selection.offset) {
        break;
      }

      prefix += char;
      currentOffset = nextOffset;
    }

    return {
      x: selectedFragment.x + context.measureText(prefix).width,
      y: selectedFragment.baseline - fontSize,
      height: Math.max(28, fontSize + 10),
    };
  }

  const lastFragment = cell.fragments[cell.fragments.length - 1];
  if (!lastFragment) {
    return {
      x: cell.x + tableCellInputPaddingX,
      y: cell.y + tableCellInputPaddingY,
      height: 28,
    };
  }

  context.font = lastFragment.font;
  const fontSize = getFontSizeFromCanvasFont(lastFragment.font);
  return {
    x: lastFragment.x + context.measureText(lastFragment.text).width,
    y: lastFragment.baseline - fontSize,
    height: Math.max(28, fontSize + 10),
  };
}

// 正文渲染和 IME 锚点 hook。
//
// 它拥有 canvas ref、textarea ref 和最新 layout：
// - document/cursor/selection/zoom 变化时重绘 canvas。
// - compositionText 存在时生成临时 preview document，用于中文输入过程中的内联预览。
// - layout 更新后根据 cursor rect 定位透明 textarea，让系统 IME 候选框跟随光标。
export function useRichCanvasRendering({
  compositionText,
  cursor,
  document,
  focusRequest,
  hideCursor,
  inputRef: externalInputRef,
  placeholder,
  scrollerRef,
  searchActiveIndex,
  searchMatches,
  selection,
  tableCellSelection,
  tableSelection,
  zoom,
}: UseRichCanvasRenderingInput) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ownedInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = externalInputRef ?? ownedInputRef;
  const [layout, setLayout] = useState<RichTextLayoutResult | null>(null);

  // textarea 是输入代理，聚焦它等于让 Canvas 编辑器进入可输入状态。
  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    // composition 期间不直接提交 document，而是先绘制预览。
    // 如果有选区，预览时先删除选区再插入 compositionText，和最终提交语义保持一致。
    const selectionPreview = compositionText && selection ? deleteRichTextSelection(document, selection) : null;
    const tableCellPreview =
      compositionText && tableCellSelection
        ? insertTextInSelectedTableCell(document, tableCellSelection, compositionText)
        : null;
    const textPreview =
      compositionText && !tableCellPreview
        ? insertTextAtRichPosition(selectionPreview?.document ?? document, selectionPreview?.cursor ?? cursor, compositionText)
        : null;
    const previewDocument = tableCellPreview?.document ?? textPreview?.document ?? document;
    const previewCursor = textPreview?.cursor ?? cursor;
    const nextLayout = renderRichTextDocument({
      canvas: canvasRef.current,
      cursor: hideCursor && !selection ? null : previewCursor,
      document: previewDocument,
      placeholder,
      searchActiveIndex,
      searchMatches,
      selection: compositionText ? null : selection,
      tableCellSelection,
      tableSelection,
      zoom,
    });
    if (nextLayout) {
      setLayout(nextLayout);
    }
  }, [compositionText, cursor, document, hideCursor, placeholder, searchActiveIndex, searchMatches, selection, tableCellSelection, tableSelection, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const input = inputRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !input || !layout) {
      return;
    }

    const cursorRect = getRichCursorRect(context, layout, cursor);
    const tableCellRect = getTableCellInputRect(context, findSelectedTableCell(layout, tableCellSelection), tableCellSelection);
    const inputRect = tableCellRect ?? cursorRect;
    if (!inputRect) {
      return;
    }

    input.style.left = `${canvas.offsetLeft + inputRect.x * zoom}px`;
    input.style.top = `${canvas.offsetTop + inputRect.y * zoom}px`;
    input.style.height = `${Math.max(28, inputRect.height * zoom)}px`;
  }, [cursor, layout, tableCellSelection, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef?.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !layout || !scroller) {
      return;
    }

    const cursorRect = getRichCursorRect(context, layout, cursor);
    const tableCellRect = getTableCellInputRect(context, findSelectedTableCell(layout, tableCellSelection), tableCellSelection);
    const inputRect = tableCellRect ?? cursorRect;
    if (!inputRect) {
      return;
    }

    const caretTop = canvas.offsetTop + inputRect.y * zoom;
    const caretBottom = caretTop + inputRect.height * zoom;
    const visibleTop = scroller.scrollTop;
    const visibleBottom = visibleTop + scroller.clientHeight;
    const margin = 40;

    if (caretBottom + margin > visibleBottom) {
      scroller.scrollTop = caretBottom + margin - scroller.clientHeight;
      return;
    }

    if (caretTop - margin < visibleTop) {
      scroller.scrollTop = Math.max(0, caretTop - margin);
    }
  }, [cursor, layout, scrollerRef, tableCellSelection, zoom]);

  useEffect(() => {
    if (focusRequest > 0) {
      window.requestAnimationFrame(focusInput);
    }
  }, [focusRequest]);

  return {
    canvasRef,
    focusInput,
    inputRef,
    layout,
  };
}
