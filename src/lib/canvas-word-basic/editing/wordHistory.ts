/**
 * 纯文本历史栈工具函数。
 *
 * 职责：
 * - 维护 past/future 撤销重做栈。
 * - 生成 undo/redo 后的新 history 和需要恢复的 snapshot。
 * - 控制历史栈最大长度。
 *
 * 不直接负责：
 * - React state 更新。
 * - 恢复 text/cursor/selection。
 */
import type { HistorySnapshot, HistoryState } from '../wordTypes';

export function pushHistorySnapshot(history: HistoryState, snapshot: HistorySnapshot, maxSize: number): HistoryState {
  return {
    past: [...history.past, snapshot].slice(-maxSize),
    future: [],
  };
}

export function createUndoHistory(
  history: HistoryState,
  current: HistorySnapshot,
  maxSize: number,
): { history: HistoryState; snapshot: HistorySnapshot | null } {
  const snapshot = history.past.at(-1) ?? null;
  if (!snapshot) {
    return { history, snapshot: null };
  }

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, maxSize),
    },
    snapshot,
  };
}

export function createRedoHistory(
  history: HistoryState,
  current: HistorySnapshot,
  maxSize: number,
): { history: HistoryState; snapshot: HistorySnapshot | null } {
  const snapshot = history.future[0] ?? null;
  if (!snapshot) {
    return { history, snapshot: null };
  }

  return {
    history: {
      past: [...history.past, current].slice(-maxSize),
      future: history.future.slice(1),
    },
    snapshot,
  };
}
