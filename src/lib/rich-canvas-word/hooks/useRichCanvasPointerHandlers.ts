import { MouseEvent, RefObject, useRef } from 'react';
import { isSameRichTextPosition } from '../editing/richTextEditing';
import { hitTestRichTableCell, hitTestRichTextPosition } from '../layout/richTextLayout';
import type { RichTableCellSelection, RichTableSelection, RichTextLayoutResult, RichTextPosition, RichTextSelection } from '../richTypes';

// Canvas 鼠标事件桥接。
// 这里负责把 DOM mouse event 转成 rich text position，并维护拖拽选区的 anchor。

type UseRichCanvasPointerHandlersOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  focusInput: () => void;
  latestCursorRef: RefObject<RichTextPosition | null>;
  latestSelectionRef: RefObject<RichTextSelection | null>;
  layout: RichTextLayoutResult | null;
  onCursorChange: (position: RichTextPosition) => void;
  onSelectionChange: (selection: RichTextSelection | null) => void;
  onTableCellSelectionChange: (selection: RichTableCellSelection | null) => void;
  onTableSelectionChange: (selection: RichTableSelection | null) => void;
  zoom: number;
};

export function useRichCanvasPointerHandlers({
  canvasRef,
  focusInput,
  latestCursorRef,
  latestSelectionRef,
  layout,
  onCursorChange,
  onSelectionChange,
  onTableCellSelectionChange,
  onTableSelectionChange,
  zoom,
}: UseRichCanvasPointerHandlersOptions) {
  const dragAnchorRef = useRef<RichTextPosition | null>(null);
  const tableDragAnchorRef = useRef<RichTableCellSelection | null>(null);

  // DOM 坐标需要转换成 renderer 使用的逻辑坐标。
  // zoom 和 DPR 都可能改变 canvas 的 CSS 尺寸与实际绘制坐标关系。
  const getLogicalPointFromMouseEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) {
      return null;
    }

    // 鼠标坐标要映射到 renderer 使用的逻辑坐标系，否则 DPR/缩放下 hit test 会偏。
    const rect = canvas.getBoundingClientRect();
    const scaleX = Number.parseFloat(canvas.style.width || `${rect.width}`) / rect.width / zoom;
    const scaleY = Number.parseFloat(canvas.style.height || `${rect.height}`) / rect.height / zoom;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return { x, y };
  };

  const hitTestFromMouseEvent = (event: MouseEvent<HTMLCanvasElement>, preciseTableTextPosition = false) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getLogicalPointFromMouseEvent(event);
    if (!canvas || !context || !layout || !point) {
      return null;
    }

    const tableCellSelection = hitTestRichTableCell(context, layout, point.x, point.y, preciseTableTextPosition);
    if (tableCellSelection) {
      return { position: null, tableCellSelection };
    }

    const { x, y } = point;
    return hitTestRichTextPosition(context, layout, x, y);
  };

  const commitTableCellSelection = (tableCellSelection: RichTableCellSelection) => {
    dragAnchorRef.current = null;
    tableDragAnchorRef.current = null;
    latestSelectionRef.current = null;
    onSelectionChange(null);
    onTableSelectionChange(null);
    onTableCellSelectionChange(tableCellSelection);
    window.requestAnimationFrame(focusInput);
  };

  // 鼠标按下时定位光标，同时记录拖拽选区 anchor。
  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    const precisePosition = hitTestFromMouseEvent(event, true);
    if (precisePosition && 'tableCellSelection' in precisePosition) {
      tableDragAnchorRef.current = precisePosition.tableCellSelection;
    }

    const position = hitTestFromMouseEvent(event);
    if (position && 'tableCellSelection' in position) {
      dragAnchorRef.current = null;
      latestSelectionRef.current = null;
      onSelectionChange(null);
      onTableSelectionChange(null);
      onTableCellSelectionChange(position.tableCellSelection);
      window.requestAnimationFrame(focusInput);
      return;
    }

    if (position) {
      dragAnchorRef.current = position;
      latestCursorRef.current = position;
      latestSelectionRef.current = null;
      onCursorChange(position);
      onSelectionChange(null);
      onTableCellSelectionChange(null);
      onTableSelectionChange(null);
      window.requestAnimationFrame(focusInput);
    }
  };

  // 单击表格单元格默认落到单元格末尾；双击才做单元格内字符级命中。
  const handleDoubleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const position = hitTestFromMouseEvent(event, true);
    if (position && 'tableCellSelection' in position) {
      commitTableCellSelection(position.tableCellSelection);
      return;
    }

    if (position) {
      dragAnchorRef.current = position;
      latestCursorRef.current = position;
      latestSelectionRef.current = null;
      onCursorChange(position);
      onSelectionChange(null);
      onTableCellSelectionChange(null);
      onTableSelectionChange(null);
      window.requestAnimationFrame(focusInput);
    }
  };

  // 拖拽时实时更新 focus；anchor 不变。
  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const tableAnchor = tableDragAnchorRef.current;
    if (tableAnchor) {
      const position = hitTestFromMouseEvent(event, true);
      if (!position || !('tableCellSelection' in position)) {
        return;
      }

      const focus = position.tableCellSelection;
      onTableCellSelectionChange(focus);
      if (focus.tableBlockId !== tableAnchor.tableBlockId) {
        onTableSelectionChange(null);
        return;
      }

      if (focus.cellId === tableAnchor.cellId) {
        const anchorOffset = tableAnchor.offset ?? 0;
        const focusOffset = focus.offset ?? 0;
        const hasTextSelection = tableAnchor.runId && focus.runId && (tableAnchor.runId !== focus.runId || anchorOffset !== focusOffset);
        onTableSelectionChange(
          hasTextSelection
            ? {
                type: 'text',
                tableBlockId: tableAnchor.tableBlockId,
                cellId: tableAnchor.cellId,
                rowIndex: tableAnchor.rowIndex,
                cellIndex: tableAnchor.cellIndex,
                anchor: tableAnchor,
                focus,
              }
            : null,
        );
        return;
      }

      onTableSelectionChange({
        type: 'cells',
        tableBlockId: tableAnchor.tableBlockId,
        anchor: tableAnchor,
        focus,
      });
      return;
    }

    const anchor = dragAnchorRef.current;
    if (!anchor) {
      return;
    }

    const position = hitTestFromMouseEvent(event);
    if (!position) {
      return;
    }

    if ('tableCellSelection' in position) {
      return;
    }

    onCursorChange(position);
    const nextSelection = isSameRichTextPosition(anchor, position) ? null : { anchor, focus: position };
    latestCursorRef.current = position;
    latestSelectionRef.current = nextSelection;
    onSelectionChange(nextSelection);
  };

  const stopDragging = () => {
    dragAnchorRef.current = null;
    tableDragAnchorRef.current = null;
  };

  return {
    handleDoubleClick,
    handleMouseDown,
    handleMouseMove,
    stopDragging,
  };
}
