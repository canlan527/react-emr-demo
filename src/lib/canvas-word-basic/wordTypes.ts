/**
 * Canvas Word 的共享类型定义。
 *
 * 职责：
 * - 放置多个 canvas-word-basic 模块共同使用的类型。
 * - 避免主组件、hooks 和展示组件之间重复定义状态结构。
 */
import type { PatientInfo } from '../../data/vitals';

export type CanvasWordRecordProps = {
  patient: PatientInfo;
};

export type ContextMenuState = {
  x: number;
  y: number;
};

export type CursorHitMode = 'caret' | 'selection';

export type HistoryState = {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
};

export type HistorySnapshot = {
  text: string;
  cursor: number;
};
