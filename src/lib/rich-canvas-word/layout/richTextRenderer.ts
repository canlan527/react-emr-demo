import { getRichCursorRect, getRichSelectionRects, layoutRichTextDocument, richCanvasWordLayout } from './richTextLayout';
import { getRichTextBlockPlainText, isRichTextTableBlock } from '../document/richTextBlocks';
import { normalizeRichTextSelection } from '../editing/richTextEditing';
import type {
  RichLayoutTableCell,
  RichLayoutTableTextFragment,
  RichTableCellSelection,
  RichTableSelection,
  RichTextDocument,
  RichTextPosition,
  RichTextSearchMatch,
  RichTextSelection,
} from '../richTypes';

// 正文 Canvas renderer。
//
// renderer 的职责是“根据 document + selection + cursor 画出当前画面”，
// 并把最新 layout 返回给 React 层。它不直接修改 editor state。
type RenderRichTextInput = {
  canvas: HTMLCanvasElement | null;
  document: RichTextDocument;
  cursor: RichTextPosition | null;
  placeholder?: string;
  selection: RichTextSelection | null;
  searchActiveIndex?: number;
  searchMatches?: RichTextSearchMatch[];
  zoom: number;
  tableCellSelection?: RichTableCellSelection | null;
  tableSelection?: RichTableSelection | null;
};

const tableCellCaretPaddingX = 18;
const tableCellCaretPaddingY = 12;

function getFontSizeFromCanvasFont(font: string) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 14;
}

function getTableCellCaretRect(
  context: CanvasRenderingContext2D,
  cell: RichLayoutTableCell,
  selection: RichTableCellSelection | null | undefined,
) {
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
      x: cell.x + tableCellCaretPaddingX,
      y: cell.y + tableCellCaretPaddingY,
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

function findSelectedTableCell(layout: ReturnType<typeof layoutRichTextDocument>, selection: RichTableCellSelection | null | undefined) {
  if (!selection) {
    return null;
  }

  return (
    layout.tables
      .find((table) => table.blockId === selection.tableBlockId && table.rowIndex === selection.rowIndex)
      ?.cells.find((cell) => cell.id === selection.cellId) ?? null
  );
}

function isTableCellInRange(tableBlockId: string, rowIndex: number, cell: RichLayoutTableCell, selection: RichTableSelection | null | undefined) {
  if (!selection || selection.type !== 'cells' || selection.tableBlockId !== tableBlockId) {
    return false;
  }

  const rowStart = Math.min(selection.anchor.rowIndex, selection.focus.rowIndex);
  const rowEnd = Math.max(selection.anchor.rowIndex, selection.focus.rowIndex);
  const cellStart = Math.min(selection.anchor.cellIndex, selection.focus.cellIndex);
  const cellEnd = Math.max(selection.anchor.cellIndex, selection.focus.cellIndex);

  return rowIndex >= rowStart && rowIndex <= rowEnd && cell.cellIndex >= cellStart && cell.cellIndex <= cellEnd;
}

function getFragmentSelectedOffsets(fragment: RichLayoutTableTextFragment, selection: RichTableSelection | null | undefined) {
  if (!selection || selection.type !== 'text' || selection.anchor.runId !== fragment.runId || selection.focus.runId !== fragment.runId) {
    return null;
  }

  const startOffset = Math.min(selection.anchor.offset ?? 0, selection.focus.offset ?? 0);
  const endOffset = Math.max(selection.anchor.offset ?? 0, selection.focus.offset ?? 0);
  const selectedStart = Math.max(fragment.startOffset, startOffset);
  const selectedEnd = Math.min(fragment.endOffset, endOffset);

  return selectedStart < selectedEnd ? { start: selectedStart, end: selectedEnd } : null;
}

function measureTableFragmentPrefix(context: CanvasRenderingContext2D, fragment: RichLayoutTableTextFragment, offset: number) {
  context.font = fragment.font;
  const targetOffset = Math.max(fragment.startOffset, Math.min(offset, fragment.endOffset));
  let currentOffset = fragment.startOffset;
  let prefix = '';

  for (const char of Array.from(fragment.text)) {
    const nextOffset = currentOffset + char.length;
    if (nextOffset > targetOffset) {
      break;
    }

    prefix += char;
    currentOffset = nextOffset;
  }

  return context.measureText(prefix).width;
}

export function renderRichTextDocument({
  canvas,
  document,
  cursor,
  placeholder,
  selection,
  searchActiveIndex = -1,
  searchMatches = [],
  tableCellSelection,
  tableSelection,
  zoom,
}: RenderRichTextInput) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const layout = layoutRichTextDocument(context, document);
  const dpr = window.devicePixelRatio || 1;
  const { pageWidth, pageHeight, pageGap } = richCanvasWordLayout;

  // Canvas 不能只靠 CSS 放大，否则浏览器会拉伸已有位图导致文字发糊。
  // 真实绘制缓冲区同时乘以 zoom，绘制时再用 dpr * zoom 映射回逻辑坐标。
  canvas.width = Math.floor(pageWidth * zoom * dpr);
  canvas.height = Math.floor(layout.height * zoom * dpr);
  canvas.style.width = `${pageWidth * zoom}px`;
  canvas.style.height = `${layout.height * zoom}px`;

  context.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
  context.clearRect(0, 0, pageWidth, layout.height);

  context.fillStyle = '#e6edf2';
  context.fillRect(0, 0, pageWidth, layout.height);

  // 页面背景和纸张先画，后续选区、文字、光标都叠在纸张上。
  for (let page = 0; page < layout.pages; page += 1) {
    const pageY = page * (pageHeight + pageGap);
    context.fillStyle = '#ffffff';
    context.shadowColor = 'rgba(15, 23, 42, 0.14)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 5;
    context.fillRect(0, pageY, pageWidth, pageHeight);
    context.shadowColor = 'transparent';
    context.strokeStyle = '#d9e2ea';
    context.strokeRect(0.5, pageY + 0.5, pageWidth - 1, pageHeight - 1);

    context.fillStyle = '#94a3b8';
    context.font = '12px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(`${page + 1}`, pageWidth / 2, pageY + pageHeight - 28);
  }

  // 选区必须在文字之前绘制，避免高亮盖住文字。
  const activeSelection = normalizeRichTextSelection(document, selection);
  const hasDocumentText = document.blocks.some((block) => getRichTextBlockPlainText(block).length > 0 || isRichTextTableBlock(block));

  if (!hasDocumentText && placeholder) {
    context.fillStyle = '#94a3b8';
    context.font = '16px Inter, Arial, sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(placeholder, richCanvasWordLayout.marginX, richCanvasWordLayout.marginY + 20);
  }

  searchMatches.forEach((match, index) => {
    getRichSelectionRects(context, layout, document, match.selection).forEach((rect) => {
      const isActive = index === searchActiveIndex;
      context.fillStyle = isActive ? 'rgba(245, 158, 11, 0.42)' : 'rgba(250, 204, 21, 0.28)';
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      if (isActive) {
        context.strokeStyle = 'rgba(180, 83, 9, 0.78)';
        context.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(1, rect.width - 1), Math.max(1, rect.height - 1));
      }
    });
  });

  getRichSelectionRects(context, layout, document, selection).forEach((rect) => {
    context.fillStyle = 'rgba(37, 99, 235, 0.2)';
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  });

  layout.tables.forEach((table) => {
    table.cells.forEach((cell) => {
      context.fillStyle = '#ffffff';
      context.fillRect(cell.x, cell.y, cell.width, cell.height);
      context.strokeStyle = '#94a3b8';
      context.lineWidth = 1;
      context.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.width, cell.height);

      if (tableCellSelection?.cellId === cell.id && tableCellSelection.tableBlockId === table.blockId) {
        context.fillStyle = 'rgba(37, 99, 235, 0.08)';
        context.fillRect(cell.x + 1, cell.y + 1, Math.max(0, cell.width - 2), Math.max(0, cell.height - 2));
        context.strokeStyle = '#2563eb';
        context.lineWidth = 2;
        context.strokeRect(cell.x + 1.5, cell.y + 1.5, Math.max(1, cell.width - 3), Math.max(1, cell.height - 3));
      }

      if (isTableCellInRange(table.blockId, table.rowIndex, cell, tableSelection)) {
        context.fillStyle = 'rgba(37, 99, 235, 0.12)';
        context.fillRect(cell.x + 1, cell.y + 1, Math.max(0, cell.width - 2), Math.max(0, cell.height - 2));
        context.strokeStyle = '#2563eb';
        context.lineWidth = 2;
        context.strokeRect(cell.x + 1.5, cell.y + 1.5, Math.max(1, cell.width - 3), Math.max(1, cell.height - 3));
      }

      cell.fragments.forEach((fragment) => {
        context.font = fragment.font;
        context.textBaseline = 'alphabetic';
        context.textAlign = 'left';

        const selectedOffsets = getFragmentSelectedOffsets(fragment, tableSelection);
        if (selectedOffsets) {
          const selectedX = fragment.x + measureTableFragmentPrefix(context, fragment, selectedOffsets.start);
          const selectedWidth =
            measureTableFragmentPrefix(context, fragment, selectedOffsets.end) -
            measureTableFragmentPrefix(context, fragment, selectedOffsets.start);
          context.fillStyle = 'rgba(37, 99, 235, 0.22)';
          context.fillRect(selectedX, fragment.baseline - 18, selectedWidth, 24);
        }

        context.fillStyle = fragment.marks.color ?? '#243044';
        context.fillText(fragment.text, fragment.x, fragment.baseline);

        if (fragment.marks.underline) {
          const width = context.measureText(fragment.text).width;
          context.strokeStyle = fragment.marks.color ?? '#243044';
          context.beginPath();
          context.moveTo(fragment.x, fragment.baseline + 3);
          context.lineTo(fragment.x + width, fragment.baseline + 3);
          context.stroke();
        }
      });

    });
  });

  layout.lines.forEach((line) => {
    line.fragments.forEach((fragment) => {
      context.font = fragment.font;
      context.textBaseline = 'alphabetic';
      context.textAlign = 'left';

      // 背景高亮按整条视觉行高度绘制，而不是按单个字体 ascent/descent，
      // 这样混合字号时高亮区域更稳定。
      if (fragment.marks.backgroundColor) {
        context.fillStyle = fragment.marks.backgroundColor;
        context.fillRect(fragment.x - 2, line.y + 5, fragment.width + 4, line.height - 10);
      }

      context.fillStyle = fragment.marks.color ?? '#243044';
      context.fillText(fragment.text, fragment.x, line.baseline);

      if (fragment.marks.underline) {
        context.strokeStyle = fragment.marks.color ?? '#243044';
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(fragment.x, line.baseline + 3);
        context.lineTo(fragment.x + fragment.width, line.baseline + 3);
        context.stroke();
      }
    });
  });

  const cursorRect = activeSelection || tableCellSelection ? null : getRichCursorRect(context, layout, cursor);
  if (cursorRect) {
    context.strokeStyle = '#d9534f';
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(cursorRect.x + 0.5, cursorRect.y);
    context.lineTo(cursorRect.x + 0.5, cursorRect.y + cursorRect.height);
    context.stroke();
  }

  const selectedTableCell = findSelectedTableCell(layout, tableCellSelection);
  if (selectedTableCell) {
    const tableCellCaret = getTableCellCaretRect(context, selectedTableCell, tableCellSelection);
    context.strokeStyle = '#d9534f';
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(tableCellCaret.x + 0.5, tableCellCaret.y);
    context.lineTo(tableCellCaret.x + 0.5, tableCellCaret.y + tableCellCaret.height);
    context.stroke();
  }

  return layout;
}
