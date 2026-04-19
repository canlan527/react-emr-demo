import type { ToolbarItem } from '../richTypes';

// 工具栏配置只描述“有哪些按钮”和默认展示文本。
// active/disabled 状态会在 RichCanvasWordRecord 中根据 editor state 动态派生。
export const richToolbarItems: ToolbarItem[] = [
  { id: 'save', type: 'button', command: 'save', label: 'Save' },
  { id: 'reset-document', type: 'button', command: 'resetDocument', label: 'Reset' },
  { id: 'sep-save', type: 'separator' },
  { id: 'undo', type: 'button', command: 'undo', label: 'Undo', disabled: true },
  { id: 'redo', type: 'button', command: 'redo', label: 'Redo' },
  { id: 'sep-history', type: 'separator' },
  { id: 'bold', type: 'button', command: 'bold', label: 'B', active: true },
  { id: 'underline', type: 'button', command: 'underline', label: 'U' },
  { id: 'font-size', type: 'button', command: 'fontSize', label: '16' },
  { id: 'text-color', type: 'button', command: 'textColor', label: 'A' },
  { id: 'highlight', type: 'button', command: 'backgroundColor', label: 'H' },
  { id: 'clear', type: 'button', command: 'clearFormat', label: 'Clear' },
  { id: 'sep-align', type: 'separator' },
  { id: 'align-left', type: 'button', command: 'alignLeft', label: 'Left', active: true },
  { id: 'align-center', type: 'button', command: 'alignCenter', label: 'Center' },
  { id: 'align-right', type: 'button', command: 'alignRight', label: 'Right' },
  { id: 'sep-zoom', type: 'separator' },
  { id: 'zoom', type: 'button', command: 'zoom', label: '100%' },
];
