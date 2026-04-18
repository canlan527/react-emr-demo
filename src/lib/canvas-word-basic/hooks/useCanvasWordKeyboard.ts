/**
 * Canvas Word 的键盘事件分发 hook。
 *
 * 职责：
 * - 处理常见快捷键和编辑键：复制、剪切、粘贴、撤销、重做、全选、删除、换行、方向键。
 * - 在 IME composition 期间跳过普通按键处理，避免提交输入法中间态。
 * - 通过回调调用外部编辑命令，不直接修改编辑器状态。
 *
 * 不直接负责：
 * - 文本编辑实现。
 * - 光标命中和 Canvas 绘制。
 * - 中文输入法 composition 状态本身。
 */
import type { KeyboardEvent } from 'react';

type UseCanvasWordKeyboardOptions = {
  textLength: number;
  isComposing: () => boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onMoveLineBoundary: (boundary: 'start' | 'end') => void;
  onMoveVertical: (direction: -1 | 1) => void;
  onResetTargetX: () => void;
  onEscape: () => void;
  onDeleteBefore: () => void;
  onDeleteAfter: () => void;
  onInsertText: (value: string) => void;
  onMoveCursor: (updater: (cursor: number) => number) => void;
  onClearSelection: () => void;
};

export function useCanvasWordKeyboard({
  textLength,
  isComposing,
  onCopy,
  onCut,
  onPaste,
  onUndo,
  onRedo,
  onSelectAll,
  onMoveLineBoundary,
  onMoveVertical,
  onResetTargetX,
  onEscape,
  onDeleteBefore,
  onDeleteAfter,
  onInsertText,
  onMoveCursor,
  onClearSelection,
}: UseCanvasWordKeyboardOptions) {
  // textarea 只承载键盘事件，真实内容由 Canvas 绘制；这里拦截常见编辑快捷键。
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const shortcut = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (shortcut && key === 'c') {
      event.preventDefault();
      onCopy();
      return;
    }

    if (shortcut && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        onRedo();
      } else {
        onUndo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      onRedo();
      return;
    }

    if (shortcut && key === 'a') {
      event.preventDefault();
      onSelectAll();
      return;
    }

    if (shortcut && event.key === 'ArrowLeft') {
      event.preventDefault();
      onMoveLineBoundary('start');
      return;
    }

    if (shortcut && event.key === 'ArrowRight') {
      event.preventDefault();
      onMoveLineBoundary('end');
      return;
    }

    if (shortcut && event.key === 'ArrowUp') {
      event.preventDefault();
      onMoveVertical(-1);
      return;
    }

    if (shortcut && event.key === 'ArrowDown') {
      event.preventDefault();
      onMoveVertical(1);
      return;
    }

    if (shortcut && key === 'x') {
      event.preventDefault();
      onCut();
      return;
    }

    if (shortcut && key === 'v') {
      event.preventDefault();
      onPaste();
      return;
    }

    if (event.key === 'Escape') {
      onEscape();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.nativeEvent.isComposing || isComposing()) {
      return;
    }

    // 非上下移动会重置目标 x，下一次上下移动从新的光标位置开始。
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      onResetTargetX();
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      onDeleteBefore();
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      onDeleteAfter();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onInsertText('\n');
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onMoveCursor((current) => Math.max(0, current - 1));
      onClearSelection();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onMoveCursor((current) => Math.min(textLength, current + 1));
      onClearSelection();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMoveVertical(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMoveVertical(1);
    }
  };
}
