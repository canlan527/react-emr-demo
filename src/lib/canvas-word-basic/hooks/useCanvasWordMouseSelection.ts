/**
 * Canvas Word 的鼠标选区 hook。
 *
 * 职责：
 * - 处理 canvas mouse down/move/up 和 context menu。
 * - 管理拖拽选区状态。
 * - 调用外部 hit test，把鼠标位置转换为 cursor/selection 更新。
 *
 * 不直接负责：
 * - 具体 hit test 算法。
 * - Canvas 绘制。
 * - 剪贴板或右键菜单命令执行。
 */
import { useEffect, useRef } from 'react';
import { normalizeSelection } from '../editing/textSelection';
import type { MouseEvent } from 'react';
import type { TextSelection } from '../editing/textSelection';
import type { ContextMenuState, CursorHitMode } from '../wordTypes';

type CanvasHit = {
  cursor: number;
  lineIndex: number;
  offset: number;
};

type UseCanvasWordMouseSelectionOptions = {
  selection: TextSelection | null;
  getCanvasHit: (event: MouseEvent<HTMLCanvasElement>, anchor?: number, mode?: CursorHitMode) => CanvasHit | null;
  setCursor: (cursor: number) => void;
  setSelection: (updater: TextSelection | null | ((current: TextSelection | null) => TextSelection | null)) => void;
  setContextMenu: (state: ContextMenuState | null) => void;
  onTransientReset: () => void;
  focusInput: () => void;
};

export function useCanvasWordMouseSelection({
  selection,
  getCanvasHit,
  setCursor,
  setSelection,
  setContextMenu,
  onTransientReset,
  focusInput,
}: UseCanvasWordMouseSelectionOptions) {
  // 鼠标按下拖拽期间持续更新选区。
  const draggingSelectionRef = useRef(false);

  // 鼠标在 Canvas 外释放时也要结束拖选，否则 selection dragging 状态会残留。
  useEffect(() => {
    const stopDragging = () => {
      draggingSelectionRef.current = false;
      setSelection((current) => (normalizeSelection(current) ? current : null));
    };

    window.addEventListener('mouseup', stopDragging);
    return () => window.removeEventListener('mouseup', stopDragging);
  }, [setSelection]);

  // 鼠标左键按下既定位光标，也初始化一个零长度选区，后续 mousemove 再扩展。
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
    onTransientReset();
    focusInput();
  };

  // 拖动过程中持续根据鼠标位置更新 focus；anchor 保持 mouseDown 时的位置。
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

  // 松开鼠标后，如果选区没有实际范围，就把 selection 清掉，回到单光标状态。
  const handleMouseUp = () => {
    draggingSelectionRef.current = false;
    setSelection((current) => (normalizeSelection(current) ? current : null));
  };

  // 右键时没有现有选区就先把光标移动到点击位置；有选区则保留选区用于复制/剪切/删除。
  const handleContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const nextCursor = getCanvasHit(event)?.cursor ?? null;
    const range = normalizeSelection(selection);

    if (!range && nextCursor !== null) {
      setCursor(nextCursor);
    }

    setContextMenu({ x: event.clientX, y: event.clientY });
    focusInput();
  };

  return {
    handleContextMenu,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
