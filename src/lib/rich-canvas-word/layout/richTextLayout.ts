// 富文本 Canvas 排版聚合出口。
//
// 具体职责已拆到：
// - richTextLineBreaking：document -> visual lines 的排版、换行、分页和对齐。
// - richTextHitTesting：鼠标坐标 -> RichTextPosition。
// - richTextCaret：方向键移动、行边界、光标矩形和选区矩形。
//
// 保留这个 barrel 文件是为了让现有组件继续从 richTextLayout 导入，
// 降低重构期间的调用方改动面。

export { createRichFont, layoutRichTextDocument, richCanvasWordLayout } from './richTextLineBreaking';
export { hitTestRichTextPosition } from './richTextHitTesting';
export {
  getRichCursorRect,
  getRichLineBoundaryPosition,
  getRichSelectionRects,
  moveRichTextPosition,
  moveRichTextPositionVertically,
} from './richTextCaret';
