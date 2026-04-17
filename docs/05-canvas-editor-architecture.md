# Canvas Word 编辑器架构

## 目标

构建一个可逐步演进的 Canvas 文本编辑器，模拟基础 Word 文档能力。

## 当前模块

### `CanvasWordRecord.tsx`

职责：

- React 状态管理。
- Canvas 元素生命周期。
- 文档加载。
- 输入法代理。
- 键盘事件。
- 鼠标事件。
- 右键菜单。
- 剪贴板。
- 撤销/重做历史栈。
- Toast。
- 全选和组合方向键快捷键。

当前该文件偏大，后续建议继续拆分。

### `canvasTextLayout.ts`

职责：

- 使用 `ctx.measureText` 测量文本。
- 自动换行。
- 分页。
- 行高计算。
- 标点避头处理。
- 光标命中。
- 可视字符和原文索引映射。

关键类型：

- `LayoutLine`
- `TextLayoutResult`

关键函数：

- `layoutCanvasText`
- `findCursorLine`
- `fitIndexInLine`
- `sourceCursorForVisualOffset`
- `visualOffsetForSourceCursor`
- `measureLinePrefix`
- `drawLayoutLine`

`LayoutLine` 会记录该行真实 `font`。所有宽度测量必须先使用该行字体，避免标题、大字号和正文混排时选区背景宽度漂移。

### `textSelection.ts`

职责：

- 选区归一化。
- 生成选区背景矩形。

当前选区逻辑仍是风险点，详见已知问题文档。

### `textEditing.ts`

职责：

- `insertText`
- `deleteBefore`
- `deleteRange`
- `replaceRange`

## 撤销/重做

当前在 `CanvasWordRecord.tsx` 中维护本地历史栈：

- `past`
- `future`

每次文本内容变化都会通过 `commitTextChange` 提交快照。快照包含：

- `text`
- `cursor`

这样撤销/重做不仅恢复文本，也会恢复光标位置。

当前快捷键：

- Ctrl/Cmd+Z：撤销。
- Ctrl/Cmd+Shift+Z：重做。
- Ctrl+Y：重做，兼容 Windows 常见习惯。

右键菜单也提供撤销和重做入口。加载病历文档会清空历史栈，避免旧文档状态被错误回退。

## 输入法代理

Canvas 本身不能接收中文输入法。

当前做法：

- 在 Canvas 上方放一个透明 `textarea`。
- 通过 `compositionstart` 和 `compositionend` 接收中文输入。
- textarea 只负责 IME，Canvas 负责显示。
- textarea 位置跟随 Canvas 光标。
- textarea 设置 `pointer-events: none`，避免挡住鼠标选区。

## 文本排版

### 自动换行

当前按字符推进，使用 `ctx.measureText(slice).width` 判断是否超过最大宽度。

英文空格优先作为断点。

中文标点只在离行尾较近时作为断点，避免新输入文字整体跳到下一行。

### 标点避头

已实现规则：

- 单个避头标点在行首时，挂到上一行末尾。
- 多个标点在行首时，从上一行移动一个字到当前行。
- 被移动字符的上一行会做轻微字距补偿。

### 字距补偿

当上一行被移动走一个字符后，计算剩余宽度并生成 `letterSpacing`。

绘制时通过 `drawLayoutLine` 按字符逐个绘制。

## 选区模型

当前模型：

- `anchor`
- `focus`
- 可选：
  - `anchorLineIndex`
  - `anchorOffset`
  - `focusLineIndex`
  - `focusOffset`

目标是同时支持：

- 文本复制使用原文索引。
- 高亮绘制使用可视 caret 边界。

当前已修复一类关键问题：高亮测量不再依赖固定字符宽度，也不再依赖上一次 Canvas 的 `ctx.font` 状态；`measureLinePrefix` 会使用 `LayoutLine.font`。

## 当前注意点

选区高亮边界已经过多轮修复，仍建议后续用统一 Caret 模型重构，避免逻辑继续分散。重点回归场景：

- 单行从左到右拖拽。
- 单行从右到左拖拽。
- 行尾短文本。
- 标点避头后改变了可视字符顺序。
- 中英文混排。

## 建议重构方向

### 1. 引入独立 Caret 模型

建议定义：

```ts
type CaretPosition = {
  lineIndex: number;
  visualOffset: number;
  sourceOffset: number;
  x: number;
  y: number;
};
```

鼠标命中、光标绘制、选区绘制都只传递 `CaretPosition`。

### 2. 选区只保存 Caret

建议：

```ts
type EditorSelection = {
  anchor: CaretPosition;
  focus: CaretPosition;
};
```

复制时从 `anchor.sourceOffset` 和 `focus.sourceOffset` 得到原文范围。

绘制时从 `anchor.lineIndex/visualOffset` 和 `focus.lineIndex/visualOffset` 得到背景矩形。

### 3. 将鼠标命中从组件中移出

建议新建：

- `caretHitTesting.ts`

职责：

- point -> CaretPosition
- sourceOffset -> CaretPosition
- CaretPosition -> x/y

### 4. 将渲染从组件中移出

建议新建：

- `canvasRenderer.ts`

职责：

- 画页面。
- 画文本。
- 画选区。
- 画光标。

## 注意

选区相关逻辑已经历多轮修补。当前可用，但如果后续继续新增富文本、表格、不同字号混排，建议按上述 Caret 模型重构。
