# Rich Canvas Word v1 详细计划

## 目标

本文档记录 `rich-canvas-word` v1 的设计计划。

v1 的目标是在不改动 `canvas-word-basic` v0 的前提下，新建一个通用富文本 Canvas Word 编辑器。

v1 不是电子病历专用编辑器。它应先成为一个通用的 Canvas 富文本编辑器，再由后续 `medical-record` 业务包装层接入患者字段、病历模板、常用短语等业务能力。

核心目标：

- 保持 `canvas-word-basic` 作为 v0 基础版冻结和可回归对照。
- 新建 `src/lib/rich-canvas-word/`。
- 使用 block + run 富文本文档模型。
- 正文区域使用 Canvas 绘制。
- 工具栏也使用 Canvas 绘制。
- 继续使用隐藏或半隐藏 `textarea` 处理键盘输入、中文 IME 和剪贴板相关事件。
- 优先跑通富文本模型、Canvas 排版、Canvas 工具栏、输入法和选区这条主链路。

## 非目标

v1 暂不追求完整 Word 能力。

v1 不包含：

- 表格。
- 图片。
- 图形。
- 真正 Word 意义上的浮动文本框。
- 批注。
- 页眉页脚。
- 打印。
- PDF 导出。
- 医疗业务字段。
- 病历结构模板。
- 常用病历短语。
- 医疗符号面板。
- 结构化质控。

这些能力应分别放到 v2 或 `medical-record` 业务包装层。

## 和 v0 的关系

`canvas-word-basic` 是 v0 基础版，应保持稳定。

v1 不应直接在 `CanvasWordRecord.tsx` 上继续加功能，也不应直接 import v0 主组件作为富文本基础。

原因是 v0 的核心模型是纯文本：

```ts
type PlainEditorState = {
  text: string;
  cursor: number;
  selection: {
    anchor: number;
    focus: number;
  } | null;
};
```

v1 的核心模型会变成富文本文档：

```ts
type RichEditorState = {
  document: RichTextDocument;
  selection: RichTextSelection | null;
  activeMarks: RichTextMarks;
};
```

两者的编辑、排版、选区、历史栈和工具栏状态都不同。

如果 v1 直接复用 `CanvasWordRecord`，短期看似节省代码，长期会被 v0 的纯文本索引模型限制。

更合适的方式是：

- v1 不复用 v0 主组件。
- v1 从 `RichTextDocument` 模型出发重新组织组件、hooks、layout、editing 和 toolbar。
- v1 参考 v0 已踩过的经验。

可以参考的 v0 经验：

- IME 输入代理。
- Canvas DPR 绘制。
- 页面背景、纸张、分页和光标绘制。
- 中文自动换行。
- 标点避头规则。
- 空格断点保护。
- 鼠标拖拽选区事件组织。
- Clipboard API 读写封装。
- past/future 撤销重做历史栈。

## Canvas 工具栏原则

v1 的工具栏也使用 Canvas 绘制。

这里的含义是：

- 工具栏视觉内容由 Canvas 绘制。
- 工具栏按钮、分组、hover、pressed、active、disabled 状态由 Canvas 绘制。
- 工具栏鼠标事件由 `<canvas>` 接收。
- 工具栏通过 hit test 把鼠标坐标转换为按钮命令。

但这不表示整个编辑器完全没有 DOM。

浏览器中的中文输入法、键盘事件、剪贴板和焦点仍然需要 DOM 元素配合。因此 v1 仍然保留一个 `textarea` 作为输入代理。

推荐结构：

```txt
RichCanvasWordRecord
  RichCanvasToolbar
    toolbar canvas

  RichCanvasWordSurface
    document canvas
    textarea IME/input proxy
```

工具栏和正文建议使用两个独立 canvas。

原因：

- 工具栏固定在编辑器上方。
- 正文区域需要滚动、分页和缩放。
- 工具栏不应跟随正文滚动。
- 工具栏 hit test 比正文 hit test 更简单。
- 后续可以独立重绘工具栏和正文，降低复杂度。

## 推荐目录结构

```txt
src/lib/rich-canvas-word/
  RichCanvasWordRecord.tsx
  richTypes.ts

  components/
    RichCanvasWordSurface.tsx
    RichCanvasToolbar.tsx
    RichCanvasContextMenu.tsx

  document/
    richTextDocument.ts
    richTextNormalizer.ts
    richTextPosition.ts
    richTextSerialization.ts

  editing/
    richTextEditing.ts
    richTextSelection.ts
    richTextClipboard.ts
    richTextHistory.ts
    richTextCommands.ts

  layout/
    richTextLayout.ts
    richTextRenderer.ts
    richToolbarLayout.ts
    richToolbarRenderer.ts

  hooks/
    useRichCanvasWordEditor.ts
    useRichCanvasWordKeyboard.ts
    useRichCanvasWordMouseSelection.ts
    useRichImeAnchor.ts
    useRichCanvasToolbar.ts

  toolbar/
    toolbarConfig.ts
    toolbarCommands.ts
    toolbarTypes.ts
```

职责说明：

- `RichCanvasWordRecord.tsx`
  - v1 容器组件。
  - 组装 toolbar、surface、editor hook、layout、renderer 和 IME hook。
  - 不直接实现复杂编辑命令。
- `richTypes.ts`
  - v1 跨模块公共类型。
- `components/RichCanvasWordSurface.tsx`
  - 正文编辑区。
  - 渲染正文 canvas、IME textarea、scroller 和必要外壳。
- `components/RichCanvasToolbar.tsx`
  - Canvas 工具栏组件。
  - 绑定 toolbar canvas refs 和鼠标事件。
- `components/RichCanvasContextMenu.tsx`
  - 富文本右键菜单。
  - v1 可以暂缓实现，必要时先用 DOM 菜单，后续再 Canvas 化。
- `document/richTextDocument.ts`
  - 富文本文档结构和默认示例文档。
- `document/richTextNormalizer.ts`
  - 合并相邻同样式 run，删除空 run，保证文档结构稳定。
- `document/richTextPosition.ts`
  - position 比较、移动、边界查找、block/run 定位。
- `document/richTextSerialization.ts`
  - 富文本和纯文本、剪贴板文本之间的转换。
- `editing/richTextEditing.ts`
  - 插入、删除、替换等基础编辑函数。
- `editing/richTextSelection.ts`
  - 选区归一化、跨 block/run 范围计算。
- `editing/richTextClipboard.ts`
  - 剪贴板读写封装。
- `editing/richTextHistory.ts`
  - 富文本撤销重做历史栈。
- `editing/richTextCommands.ts`
  - 通用编辑命令聚合。
- `layout/richTextLayout.ts`
  - block/run 排版、自动换行、分页、position 到坐标映射。
- `layout/richTextRenderer.ts`
  - 正文 Canvas 绘制。
- `layout/richToolbarLayout.ts`
  - 工具栏按钮布局。
- `layout/richToolbarRenderer.ts`
  - 工具栏 Canvas 绘制。
- `hooks/useRichCanvasWordEditor.ts`
  - 管理 document、selection、activeMarks、history、toast 和编辑命令。
- `hooks/useRichCanvasWordKeyboard.ts`
  - 处理快捷键、方向键、删除、换行。
- `hooks/useRichCanvasWordMouseSelection.ts`
  - 处理正文 canvas 点击、拖选和右键。
- `hooks/useRichImeAnchor.ts`
  - 处理隐藏 textarea 定位、composition 状态和输入提交。
- `hooks/useRichCanvasToolbar.ts`
  - 处理工具栏 hover、pressed、点击 hit test 和命令触发。
- `toolbar/toolbarConfig.ts`
  - 工具栏按钮配置。
- `toolbar/toolbarCommands.ts`
  - 工具栏命令到编辑器命令的映射。
- `toolbar/toolbarTypes.ts`
  - 工具栏 item、command、layout 状态类型。

## 富文本文档模型

v1 使用 block + run 模型。

建议初始类型：

```ts
type RichTextDocument = {
  blocks: RichTextBlock[];
};

type RichTextBlock = {
  id: string;
  type: 'paragraph' | 'heading';
  align: 'left' | 'center' | 'right';
  runs: RichTextRun[];
};

type RichTextRun = {
  id: string;
  text: string;
  marks: RichTextMarks;
};

type RichTextMarks = {
  bold?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
};
```

`block` 表示段落级结构。

`run` 表示一段连续拥有相同样式的文本。

`marks` 表示 run 上的字符级样式。

例如：

```txt
患者姓名：张三，诊断：肺部感染。
```

可以表达为：

```ts
[
  { text: '患者姓名：', marks: { bold: true } },
  { text: '张三', marks: { color: '#2563eb' } },
  { text: '，诊断：', marks: { bold: true } },
  { text: '肺部感染', marks: { color: '#dc2626' } },
  { text: '。', marks: {} },
]
```

## Position 和 Selection 模型

v0 使用纯文本索引。

v1 建议使用 block/run/offset 位置。

```ts
type RichTextPosition = {
  blockId: string;
  runId: string;
  offset: number;
};

type RichTextSelection = {
  anchor: RichTextPosition;
  focus: RichTextPosition;
};
```

后续如果需要更高性能，可以把 `blockIndex`、`runIndex` 作为 layout 阶段的派生数据，但核心状态不建议依赖数组下标。

原因：

- block 和 run 未来会拆分、合并、插入、删除。
- 使用 id 更适合长期维护。
- layout 层可以把 id 转换为快速查找索引。

需要支持的基础能力：

- 比较两个 position 的先后顺序。
- 归一化 selection 的 start/end。
- 根据 position 找到 block、run 和 offset。
- 从 position 向左/右移动一个字符。
- 把 layout hit test 结果转换为 RichTextPosition。
- 把 RichTextPosition 转换为 Canvas 光标坐标。

## Active Marks

`activeMarks` 用于处理无选区时的工具栏操作。

规则：

- 无选区时点击加粗、颜色、字号等按钮，不立即修改已有文本。
- 编辑器记录新的 `activeMarks`。
- 后续输入的文字使用 `activeMarks`。
- 光标移动到已有文字中时，工具栏应显示光标所在 run 的 marks。

有选区时：

- 工具栏命令直接应用到选区范围。
- 如果选区跨 run，需要拆分 run。
- 应用后合并相邻同样式 run。
- 操作进入历史栈。

## 富文本排版设计

v1 排版不再面向纯字符串，而是面向 block + run。

排版产物需要记录：

- 每个视觉行属于哪个 block。
- 每个视觉行包含哪些 run fragment。
- 每个 fragment 的文本、marks、source position 范围。
- 每个 fragment 的 x、y、width。
- 行高。
- 页码。
- 光标 position 到 x/y 的映射。

建议布局类型：

```ts
type RichLayoutLine = {
  blockId: string;
  fragments: RichLayoutFragment[];
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  lineIndex: number;
};

type RichLayoutFragment = {
  blockId: string;
  runId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  marks: RichTextMarks;
  x: number;
  y: number;
  width: number;
};
```

排版原则：

- 每个 run 根据 marks 生成真实 canvas font。
- 使用 `ctx.measureText()` 测量字符或字符片段。
- 同一视觉行可以包含多个 run fragment。
- 同一视觉行可以包含不同字号。
- 行高取当前视觉行内最大字号对应的行高。
- 自动换行应迁移 v0 的中文换行、避头标点和空格断点保护经验。

## 正文 Canvas Renderer

`richTextRenderer.ts` 负责正文绘制。

它应该绘制：

- 编辑器背景。
- 页面白纸。
- 页面阴影或边界。
- 页码。
- 选区高亮。
- run 文本。
- 下划线。
- 背景高亮色。
- 光标。

renderer 不应直接修改 React state。

renderer 输入建议：

```ts
type RenderRichTextInput = {
  canvas: HTMLCanvasElement | null;
  document: RichTextDocument;
  selection: RichTextSelection | null;
  cursor: RichTextPosition;
  zoom: number;
};
```

renderer 输出建议：

```ts
type RenderRichTextResult = {
  layout: RichTextLayoutResult;
};
```

## Canvas 工具栏设计

工具栏配置建议：

```ts
type ToolbarItem = {
  id: string;
  command: ToolbarCommand;
  label: string;
  type: 'button' | 'select' | 'color' | 'separator';
};

type ToolbarCommand =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'underline'
  | 'textColor'
  | 'backgroundColor'
  | 'fontSize'
  | 'clearFormat'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'delete'
  | 'selectAll'
  | 'zoom';
```

工具栏布局产物：

```ts
type ToolbarItemLayout = {
  id: string;
  command: ToolbarCommand;
  x: number;
  y: number;
  width: number;
  height: number;
  disabled: boolean;
  active: boolean;
};
```

工具栏交互：

- `mousemove` 更新 hover item。
- `mousedown` 更新 pressed item。
- `mouseup` 命中同一 item 时触发命令。
- `mouseleave` 清理 hover/pressed。
- 点击后重新 focus 正文输入代理。

v1 初期可以先实现按钮型工具栏。

字号、颜色和背景色可以先用固定几个按钮或简化弹层；复杂下拉和调色板可以放到 v1 后期。

## IME 输入代理设计

v1 仍然需要 `textarea` 作为输入代理。

原则：

- 平时 textarea 不显示，避免和 Canvas 正文形成双份文字。
- composition 期间临时显示拼音预编辑串。
- 预编辑串位置跟随 Canvas 光标。
- 预编辑串字号、字体和行高应跟随当前 position 的 marks。
- composition end 后提交最终文本到 rich document。
- 提交后清空 textarea value。

v0 已发现并修复过两个 IME 问题：

- 预编辑串完全不可见。
- 预编辑串字号明显大于当前正文。

v1 必须把这两个问题作为固定回归项。

## v1 分阶段实现计划

### 阶段 1：搭建 rich-canvas-word 壳子

目标：

- 新建 `src/lib/rich-canvas-word/`。
- 新建 `RichCanvasWordRecord.tsx`。
- 新建 `RichCanvasToolbar.tsx`。
- 新建 `RichCanvasWordSurface.tsx`。
- 工具栏 canvas 能绘制静态按钮。
- 正文 canvas 能绘制静态 rich document。
- 不接入真实编辑能力。
- 不影响 `canvas-word-basic`。

阶段 1 的最小文件集：

```txt
src/lib/rich-canvas-word/
  RichCanvasWordRecord.tsx
  richTypes.ts

  components/
    RichCanvasToolbar.tsx
    RichCanvasWordSurface.tsx

  document/
    richTextDocument.ts

  layout/
    richTextLayout.ts
    richTextRenderer.ts
    richToolbarLayout.ts
    richToolbarRenderer.ts

  toolbar/
    toolbarConfig.ts
```

阶段 1 暂不创建 `editing/` 和 `hooks/`。这些目录等进入真实编辑、IME、选区和历史栈阶段后再补。

临时入口：

```txt
/rich-canvas-word
```

该入口只用于 v1 开发验证，不替换 `/medical-record` 的 v0 页面。

第一版工具栏按钮：

```txt
Undo | Redo | B | U | 16 | A | H | Clear | Left | Center | Right | 100%
```

阶段 1 只绘制按钮，不执行真实命令。

工具栏至少覆盖：

- normal 状态。
- disabled 状态。
- active 状态。
- 分隔符。
- 简单文字按钮。
- 类 select 按钮，例如 `16` 和 `100%`。

第一版静态 rich document 应覆盖：

- heading。
- paragraph。
- 同一段内多个 run。
- 加粗。
- 下划线。
- 文字色。
- 背景高亮色。
- 字号差异。
- 左对齐。
- 居中。
- 右对齐。

验收：

- v0 页面仍正常。
- `/rich-canvas-word` 可以打开。
- 工具栏 canvas 非空。
- 正文 canvas 非空。
- 工具栏至少绘制 Undo、Redo、B、U、16、A、H、Clear、Left、Center、Right、100%。
- 正文内容由 Canvas 绘制，不使用 DOM 文本模拟。
- 正文能画出 heading 和多个 paragraph。
- 同一段里能画出不同 run 样式。
- `pnpm run build` 通过。

当前进展：

- 已新增 `src/lib/rich-canvas-word/`。
- 已新增 `/rich-canvas-word` 临时入口。
- 已新增 `RichCanvasWordRecord.tsx`、`RichCanvasToolbar.tsx`、`RichCanvasWordSurface.tsx`。
- 已新增 `richTypes.ts`、`richTextDocument.ts`、`toolbarConfig.ts`。
- 已新增 `richToolbarLayout.ts` 和 `richToolbarRenderer.ts`，可绘制静态 Canvas 工具栏。
- 已新增 `richTextLayout.ts` 和 `richTextRenderer.ts`，可绘制静态富文本文档。
- 已新增 v1 独立样式，使用 `rich-canvas-*` class，避免影响 v0。
- `pnpm run build` 已通过。

阶段 1 发现并修复的问题：

- 正文 run 出现文字重叠。
  - 原因：Canvas 绘制页码时设置了 `context.textAlign = 'center'`，后续绘制正文 fragment 时没有恢复为 `left`。
  - 修复：正文每个 fragment 绘制前显式设置 `context.textAlign = 'left'`。
  - 补充：同一行不同字号 run 改为使用统一 baseline，减少上下错位。

### 阶段 2：实现 block + run 排版和绘制

目标：

- 实现 `richTextDocument.ts`。
- 实现 `richTextLayout.ts`。
- 实现 `richTextRenderer.ts`。
- 支持同一行内不同 run 样式。
- 支持自动换行和分页。

阶段 2 的排版管线：

```txt
RichTextDocument
  -> block
  -> run
  -> char units
  -> visual lines
  -> run fragments
  -> canvas renderer
```

这里先把每个 run 拆成带有 `blockId`、`runId`、`offset`、`font`、`width`、`height` 的字符单元，再按页面内容宽度组成视觉行。视觉行确定后，再把相邻且属于同一 run 的字符合并回 fragment。

这样做的原因：

- 自动换行应按真实字符宽度判断，而不是按 run 整段搬移。
- 同一视觉行可能包含多个 run。
- 同一视觉行可能包含不同字号。
- 后续光标定位、选区和 hit test 需要 fragment 保留 run 和 offset 信息。
- 可以迁移 v0 中“旧空格断点不要导致整段提前换行”的经验。

验收：

- 同一段文字内可以绘制加粗、下划线、颜色、背景高亮、字号。
- 长中文能自然换行。
- 中英文混排不会因旧空格断点提前整段换行。
- 标点避头规则基本可用。
- 示例文档包含一段长中英文混排文本，用于检查换行和 run fragment 拼接。
- `pnpm run build` 通过。

当前进展：

- `richTextLayout.ts` 已升级为字符单元排版管线。
- `RichLayoutFragment` 已增加 `startOffset`、`endOffset`、`font`。
- `RichLayoutLine` 已增加 `baseline`。
- renderer 已改为直接使用 fragment font 和 line baseline。
- 示例文档已增加长中文 + 英文混排段落，用于观察自动换行。
- 示例文档已增加连续长中文和无空格英文长 token 段落，用于验证没有自然断点时能否按字符换行。
- 空格断点和标点断点已加入保护，避免旧断点导致整段提前换行。
- `pnpm run build` 已通过。

阶段 2 发现并修复的问题：

- 背景高亮只覆盖文字上半部分。
  - 原因：高亮矩形按 `baseline - fragment.height` 计算位置，不适合统一 baseline 和不同字号混排。
  - 修复：高亮矩形改为基于整条 `line.y` 和 `line.height` 绘制，覆盖文字背景主要区域。

阶段 2 剩余建议：

- 手动观察长中文、中英文混排和多 run 拼接是否仍有断行不自然。
- 手动观察连续长中文、无空格英文长 token 是否能自然换行，不应溢出页面或重叠。
- 手动观察不同字号、下划线和背景高亮是否视觉稳定。
- 若没有明显问题，可以进入阶段 3。

### 阶段 3：实现基础输入、光标和选区

目标：

- 实现 `RichTextPosition`。
- 实现 `RichTextSelection`。
- 实现鼠标点击定位光标。
- 实现基础文字插入。
- 实现 Backspace/Delete。
- 实现 Enter 新段落。
- 实现中文 IME。
- 实现基础鼠标拖拽选区。

验收：

- 点击正文可以定位光标。
- 可以输入中文。
- 中文拼音预编辑串可见，字号接近当前 run。
- 候选框跟随 Canvas 光标。
- 输入长文本时当前行先自然填满再换行。
- Backspace/Delete 正常。
- 鼠标拖拽选区正常。
- `pnpm run build` 通过。

### 阶段 3.1：光标 position 和鼠标点击定位

目标：

- 先实现富文本 position 和 Canvas hit test。
- 鼠标点击正文 Canvas 时，把坐标转换为 `RichTextPosition`。
- 根据 `RichTextPosition` 绘制光标。
- 暂不实现输入。
- 暂不实现选区。
- 暂不实现 IME。

新增或调整：

- `RichTextPosition`
  - `blockId`
  - `runId`
  - `offset`
- `hitTestRichTextPosition()`
  - 根据 layout line、fragment 和字符宽度，把 Canvas 坐标转换为 position。
- `getRichCursorRect()`
  - 根据 position 反查 Canvas 光标矩形。
- `renderRichTextDocument()`
  - 接收 cursor，并在正文文本绘制后绘制光标。
- `RichCanvasWordSurface`
  - 监听正文 canvas `mouseDown`。
  - 维护最新 layout。
  - 点击后回传 position。
- `RichCanvasWordRecord`
  - 持有当前 cursor position。

当前进展：

- 已新增 `RichTextPosition` 类型。
- 已新增 `hitTestRichTextPosition()`。
- 已新增 `getRichCursorRect()`。
- 正文 renderer 已支持绘制红色光标。
- `/rich-canvas-word` 点击正文文本时可以更新光标位置。
- `pnpm run build` 已通过。

验收：

- 点击标题、普通段落、加粗 run、下划线 run、颜色 run、高亮 run、不同字号 run，光标能移动到对应位置附近。
- 点击行首，光标应落在该行第一个 fragment 前。
- 点击行尾或行尾空白，光标应落在该行最后一个 fragment 后。
- 点击长中文换行段落，光标应落在点击所在视觉行。
- 点击无空格英文长 token 换行段落，光标应落在点击所在视觉行。
- 不要求输入文字。
- 不要求选区。
- 不要求 IME。
- `pnpm run build` 通过。

### 阶段 3.2：基础键盘光标移动

目标：

- 在阶段 3.1 的 position 和 hit test 基础上，实现最小键盘光标移动。
- 正文 canvas 可获得焦点。
- 点击正文后，键盘方向键可以移动富文本光标。
- 暂不实现输入。
- 暂不实现删除。
- 暂不实现选区。
- 暂不实现 IME。

范围：

- `ArrowLeft`
  - 光标向前移动一个字符。
  - 可以跨 run、跨 block。
- `ArrowRight`
  - 光标向后移动一个字符。
  - 可以跨 run、跨 block。
- `Home`
  - 光标移动到当前视觉行行首。
- `End`
  - 光标移动到当前视觉行行尾。
- `ArrowUp`
  - 按当前光标 x 坐标移动到上一视觉行最接近的位置。
- `ArrowDown`
  - 按当前光标 x 坐标移动到下一视觉行最接近的位置。

新增或调整：

- `moveRichTextPosition()`
  - 根据 `RichTextDocument` 的 block/run 顺序移动 position。
  - 按 Unicode 字符边界移动，避免中文和 emoji 被 UTF-16 code unit 拆坏。
- `getRichLineBoundaryPosition()`
  - 根据当前 layout line 获取行首或行尾 position。
- `RichCanvasWordSurface`
  - canvas 增加 `tabIndex={0}`。
  - 点击正文后 focus canvas。
  - 处理 `ArrowLeft`、`ArrowRight`、`ArrowUp`、`ArrowDown`、`Home`、`End`。

当前进展：

- 已实现左右方向键移动。
- 已实现 Home/End 移动到当前视觉行边界。
- 已实现 ArrowUp/ArrowDown 按当前 x 坐标跨视觉行移动。
- 已让正文 canvas 可聚焦。
- `pnpm run build` 已通过。

阶段 3.2 发现并修复的问题：

- 左右方向键在 run 边界需要多按一次。
  - 原因：前一个 run 的结尾和后一个 run 的开头是同一个视觉光标位置，但移动逻辑把它们当成两个独立步骤。
  - 修复：`ArrowLeft` 跨到前一个 run 时，直接移动到前一个 run 的上一个真实字符边界；`ArrowRight` 跨到下一个 run 时，直接移动到下一个 run 的下一个真实字符边界。
  - 结果：在加粗、颜色、下划线、高亮、字号变化等 run 边界处，左右键不会再出现视觉停顿。

验收：

- 点击正文后按 `ArrowLeft`，光标向左移动一个字符。
- 点击正文后按 `ArrowRight`，光标向右移动一个字符。
- 左右移动可以跨 run，例如从普通文字移动到加粗、颜色、下划线或高亮 run。
- 左右移动可以跨视觉行。
- `ArrowUp` 能移动到上一视觉行的相近 x 位置。
- `ArrowDown` 能移动到下一视觉行的相近 x 位置。
- `Home` 能移动到当前视觉行行首。
- `End` 能移动到当前视觉行行尾。
- 不要求输入文字。
- 不要求选区。
- 不要求 IME。
- `pnpm run build` 通过。

### 阶段 3.3：基础文本输入

目标：

- 在当前 `RichTextPosition` 处插入普通键盘字符。
- 插入后更新 `RichTextDocument`。
- 插入后移动 cursor 到新文本之后。
- 暂不实现中文 IME。
- 暂不实现 Backspace/Delete。
- 暂不实现 Enter 新段落。
- 暂不实现选区替换。

范围：

- 处理 `event.key.length === 1` 的普通字符。
- 跳过 `metaKey`、`ctrlKey`、`altKey` 组合键。
- 当前版本直接插入到 cursor 所在 run。
- 新插入文本沿用所在 run 的 marks。

新增或调整：

- `editing/richTextEditing.ts`
  - 新增 `insertTextAtRichPosition()`。
  - 返回新的 document 和新的 cursor。
- `RichCanvasWordRecord`
  - document 从静态常量升级为 React state。
  - 提供 `insertText()` 命令。
- `RichCanvasWordSurface`
  - 普通字符按键转发给 `onInsertText()`。

当前进展：

- 已支持普通英文、数字、标点等单字符输入。
- 插入后会重排 rich document。
- 插入后光标会移动到插入内容之后。
- `pnpm run build` 已通过。

验收：

- 点击正文某个位置后，输入英文字母或数字，文本插入到对应 run。
- 插入后光标跟随到新字符之后。
- 在加粗、颜色、下划线、高亮等 run 内输入时，新字符沿用该 run 样式。
- 输入较长普通字符后能触发布局重排和自动换行。
- 暂不要求中文输入法。
- 暂不要求 Backspace/Delete。
- 暂不要求 Enter。
- 暂不要求选区替换。
- `pnpm run build` 通过。

### 阶段 3.4：Backspace/Delete 删除能力

目标：

- 补齐最小编辑闭环：能输入，也能删除。
- `Backspace` 删除光标前一个字符。
- `Delete` 删除光标后一个字符。
- 支持同 run 内删除。
- 支持跨 run 删除。
- 删除后更新 document 和 cursor。

范围：

- 单字符删除。
- 按 Unicode 字符边界删除，避免中文和 emoji 被 UTF-16 code unit 拆坏。
- 光标在 run 开头按 `Backspace` 时，删除前一个 run 的末尾字符。
- 光标在 run 末尾按 `Delete` 时，删除后一个 run 的开头字符。

暂不处理：

- 选区删除。
- Enter 新段落。
- 中文 IME。
- 撤销重做。
- 合并 run。
- 删除空 block。

新增或调整：

- `editing/richTextEditing.ts`
  - 新增 `deleteBeforeRichTextPosition()`。
  - 新增 `deleteAfterRichTextPosition()`。
- `RichCanvasWordRecord`
  - 新增 `deleteBefore()`。
  - 新增 `deleteAfter()`。
- `RichCanvasWordSurface`
  - 接入 `Backspace`。
  - 接入 `Delete`。

当前进展：

- 已支持 Backspace 单字符删除。
- 已支持 Delete 单字符删除。
- 已支持在 run 边界跨 run 删除。
- `pnpm run build` 已通过。

阶段 3.4 语义确认：

- Delete 跨 run 时，光标应保持在原始逻辑位置。
  - 如果下一个 run 处于下一视觉行，那一行通常是自动换行产生的软换行，并不是 document 中真实存在的换行符。
  - Delete 的语义是删除光标后的一个字符或后续结构，而不是把光标移动到被删除字符所在 run。
  - 删除后应通过 layout reflow 让后续内容在有空间时前移。
  - 真正的硬换行或段落合并语义，会在后续 Enter/段落模型阶段单独处理。

验收：

- 在普通 run 中输入后，按 Backspace 能删除刚输入的字符。
- 在普通 run 中按 Delete 能删除光标后的字符。
- 在加粗、颜色、下划线、高亮、大字号 run 中删除后，样式绘制仍正常。
- 光标在 run 开头按 Backspace，可以删除前一个 run 的末尾字符。
- 光标在 run 末尾按 Delete，可以删除后一个 run 的开头字符。
- 删除后光标位置合理。
- 暂不要求选区删除。
- 暂不要求中文 IME。
- 暂不要求撤销重做。
- `pnpm run build` 通过。

### 阶段 3.5：Enter 拆分 block

目标：

- 实现真正的硬换行语义。
- 按 `Enter` 时，把当前 block 按 cursor 位置拆成两个 block。
- cursor 前的内容留在原 block。
- cursor 后的内容移动到新 block。
- 新 block 继承原 block 的 `type` 和 `align`。
- Enter 后 cursor 移动到新 block 第一个 run 的开头。

语义边界：

- 自动换行是视觉软换行，不进入 document。
- Enter 是文档硬换行，会改变 block 结构。
- 当前阶段只拆分 block，不做段落合并。

暂不处理：

- Shift+Enter 软换行。
- 标题回车变正文。
- 空 block 清理。
- Backspace 在段首合并上一段。
- Delete 在段尾合并下一段。
- 选区。
- 中文 IME。
- 撤销重做。

新增或调整：

- `editing/richTextEditing.ts`
  - 新增 `splitBlockAtRichTextPosition()`。
- `RichCanvasWordRecord`
  - 新增 `splitBlock()`。
- `RichCanvasWordSurface`
  - 接入 `Enter`。

当前进展：

- 已支持 Enter 按 cursor 拆分当前 block。
- 已支持后半段内容移动到新 block。
- 已支持 cursor 移动到新 block 开头。
- `pnpm run build` 已通过。

阶段 3.5 发现并修复的问题：

- 在空白行连续按 Enter 后，光标消失。
  - 原因：空 block 的 layout 生成了一个 synthetic runId，例如 `${block.id}-empty`，但 cursor 指向的是 document 中真实存在的空 run。
  - 修复：空行 fragment 改为使用 block 内真实 empty run 的 id 和 marks。
  - 结果：空白行连续 Enter 后，cursor 仍能找到对应 fragment 并绘制。
- 在两个不同样式 run 的边界按 Enter 后，光标消失。
  - 原因：当前 run 在拆分后的后半段为空字符串，但后面还有另一个有内容的 run；cursor 被放到这个空 run 上，而 layout 只为有内容的 run 生成 fragment。
  - 修复：拆分 block 后，如果新 block 第一个 run 是空的，cursor 优先落到新 block 第一个有内容的 run 开头；如果新 block 本身为空白行，才落到 empty run。
  - 结果：在 run 边界按 Enter 后，光标能显示在新行开头。
- 在空格前按 Enter 后，光标消失。
  - 原因：layout 为了避免自动换行后的行首空格，会跳过视觉行开头空白；当 Enter 后新 block 恰好以空格开头时，cursor 指向这个合法位置，但 layout 没有生成对应 fragment。
  - 修复：保留 block 起始行的空格 fragment，只在自动换行产生的后续行跳过前导空格。
  - 结果：在 `包含 加粗` 这类空格前按 Enter 后，光标仍能显示。

验收：

- 在普通段落中间按 Enter，当前段落被拆成上下两个 block。
- 上半段保留在原 block。
- 下半段移动到新 block。
- 光标移动到新 block 开头。
- 在加粗、颜色、下划线、高亮 run 中间按 Enter，run 的前后文本被正确分配到两个 block。
- 新 block 保留原 block 的对齐方式。
- 暂不要求段落合并。
- 暂不要求中文 IME。
- 暂不要求撤销重做。
- `pnpm run build` 通过。

### 阶段 3.6：段落边界删除与 block 合并

目标：

- 补齐 Enter 拆分 block 之后的反向操作。
- Backspace 在 block 开头时，合并到上一 block。
- Delete 在 block 末尾时，合并下一 block。
- 合并后保留留下来的 block 的段落属性。
- 合并后 cursor 落在合并点。

语义：

- Backspace 在段首：
  - 当前 block 合并到上一 block 后面。
  - 保留上一 block 的 `type` 和 `align`。
  - cursor 移动到原上一 block 的末尾。
- Delete 在段尾：
  - 下一 block 合并到当前 block 后面。
  - 保留当前 block 的 `type` 和 `align`。
  - cursor 保持在原当前 block 的末尾。

暂不处理：

- 选区删除。
- 合并相邻同 marks run。
- 删除空 block 清理策略。
- 标题回车变正文。
- Shift+Enter 软换行。
- 撤销重做。

新增或调整：

- `editing/richTextEditing.ts`
  - `deleteBeforeRichTextPosition()` 增加段首合并上一 block。
  - `deleteAfterRichTextPosition()` 增加段尾合并下一 block。

当前进展：

- 已支持 Backspace 在 block 开头合并上一 block。
- 已支持 Delete 在 block 末尾合并下一 block。
- 已处理空 block 合并时 cursor 可能指向不可见 run 的问题，优先选择可见合并点。
- `pnpm run build` 已通过。

阶段 3.6 发现并修复的问题：

- 连续空白行使用 Delete 只能删除一条，后续空白行无法继续删除。
  - 原因：空 block 合并时把多个 empty run 堆进同一个 block，cursor 停在第一个 empty run 后不再满足“段尾”判断。
  - 修复：block 合并时归一化空 run。
  - 空 block 与空 block 合并，只保留一个 empty run。
  - 空 block 与非空 block 合并，丢弃占位 empty run，只保留真实内容 run。
  - 结果：连续空白行可以继续用 Delete 或 Backspace 合并删除。

验收：

- 在第二个 block 开头按 Backspace，两个 block 合并。
- 合并后保留上一 block 的对齐方式。
- 光标位于原上一 block 的末尾。
- 在第一个 block 末尾按 Delete，下一 block 合并到当前 block。
- 合并后保留当前 block 的对齐方式。
- 光标位于原当前 block 的末尾。
- 对空白行按 Backspace 或 Delete，光标不消失。
- 暂不要求 run 自动合并。
- 暂不要求撤销重做。
- `pnpm run build` 通过。

### 阶段 3.7：中文 IME 输入代理

目标：

- 支持中文输入法。
- 输入法候选框跟随 rich cursor。
- composition 期间显示拼音预编辑串。
- composition end 后把最终中文插入 rich document。
- 插入后清空 textarea。

实现原则：

- 浏览器中文输入法需要 DOM 输入元素承载，所以 v1 仍然保留 textarea 作为输入代理。
- 正文视觉仍由 Canvas 绘制。
- 点击正文 canvas 后，焦点转到隐藏 textarea。
- textarea 根据 `getRichCursorRect()` 定位到当前 rich cursor。
- composition 期间 textarea 临时可见，避免拼音预编辑串不可见。

新增或调整：

- `RichCanvasWordSurface`
  - 新增 `textarea.rich-canvas-ime-input`。
  - 键盘事件从 canvas 转移到 textarea。
  - 新增 `compositionstart`、`compositionend`、`input` 处理。
  - 点击 canvas 后 focus textarea。
- `src/styles/index.scss`
  - 新增 `.rich-canvas-ime-input`。
  - 新增 `.rich-canvas-ime-input.is-composing`。

当前进展：

- 已支持 textarea 输入代理。
- 已支持普通 input 事件提交文本。
- 已支持中文 composition end 后提交最终文本。
- 已支持 composition 期间显示拼音预编辑串。
- 已支持 textarea 跟随 rich cursor 位置。
- `pnpm run build` 已通过。

阶段 3.7 发现并修复的问题：

- 中文输入代理 textarea 总是出现在页面左上角，没有跟随 Canvas 光标。
  - 原因：`getRichCursorRect()` 返回的是 Canvas 内部坐标，但 textarea 是定位在 scroller 内部的绝对定位元素。
  - 修复：同步 textarea 位置时加上 `canvas.offsetLeft` 和 `canvas.offsetTop`。
  - 结果：textarea 位置从 Canvas 内部坐标转换为 scroller 内部坐标，输入法候选框可以跟随光标。
- 拼音预编辑串和 Canvas 原文字重叠。
  - 原因：textarea 定位在光标矩形顶部，预编辑串会压在当前行文字上。
  - 早期修复：textarea 的 top 改为光标矩形底部，避免重叠。
  - 后续修正：这不是正确编辑器语义。真正的 IME 预编辑应当以内联方式占位，让后续文字临时后移。
  - 当前修复：composition 期间根据 `compositionText` 生成一份临时 preview document，Canvas 渲染这份 preview document；textarea 自身保持透明，只作为 IME 和候选框锚点。
  - 结果：拼音预编辑串在 Canvas 正文中以内联方式显示，后续文字会随预编辑串后移。

验收：

- 点击正文后可以继续使用方向键、Backspace、Delete、Enter。
- 中文输入法候选框跟随当前 Canvas 光标。
- 中文拼音预编辑串可见。
- composition end 后中文写入 rich document。
- 输入后 textarea 内容被清空，不重复提交。
- 在空白行、run 边界、不同样式 run 中输入中文，光标不消失。
- 暂不要求选区替换。
- 暂不要求撤销重做。
- `pnpm run build` 通过。

### 阶段 3.8：基础选区能力

目标：

- 支持 `RichTextSelection`。
- 支持鼠标拖拽选择正文。
- 支持 Canvas 绘制选区高亮。
- 支持 Shift + 方向键扩展选区。
- 有选区时输入文本，替换选区。
- 有选区时 Backspace/Delete 删除选区。
- 支持全选、复制、剪切、粘贴快捷键。

实现原则：

- 选区状态放在 `RichCanvasWordRecord` 容器层，和 `document`、`cursor` 同级。
- `RichCanvasWordSurface` 负责鼠标拖拽、Shift 方向键和快捷键协调。
- `richTextEditing.ts` 提供选区归一化、范围删除和纯文本提取等纯函数。
- `richTextRenderer.ts` 在绘制文字之前先绘制选区高亮。
- composition 期间不绘制旧选区，而是先删除选区生成临时 preview document，再插入 `compositionText` 做 Canvas 内联预览。

当前进展：

- 已新增 `RichTextSelection` 类型。
- 已支持鼠标拖拽选区。
- 已支持选区高亮绘制。
- 已支持方向键无 Shift 时折叠选区。
- 已支持 Shift + 左右/上下/Home/End 扩展选区。
- 已支持有选区时输入、中文 composition、Backspace、Delete、Enter 先替换或删除选区。
- 已支持 `Ctrl/Cmd + A` 全选。
- 已支持 `Ctrl/Cmd + C` 复制选区纯文本。
- 已支持 `Ctrl/Cmd + X` 剪切选区纯文本。
- 已支持 `Ctrl/Cmd + V` 粘贴纯文本。
- `pnpm run build` 已通过。

验收：

- 鼠标从左到右拖拽，选区高亮跟随鼠标变化。
- 鼠标从右到左拖拽，选区范围仍能正确归一化。
- 选区可以跨 run、跨视觉行、跨 block。
- 有选区时输入普通字符，选区被替换为新字符。
- 有选区时输入中文，composition 预编辑串以内联方式替换选区预览。
- 有选区时按 Backspace 或 Delete，选区被删除。
- 有选区时按 Enter，选区先删除，再拆分 block。
- `Ctrl/Cmd + A` 可以全选全文。
- `Ctrl/Cmd + C`、`Ctrl/Cmd + X`、`Ctrl/Cmd + V` 可用。
- 方向键移动光标时，非 Shift 操作应清空选区。
- Shift + 方向键可以扩展或收缩选区。
- 暂不要求富文本剪贴板格式，当前只处理纯文本。
- 暂不要求撤销重做。
- `pnpm run build` 通过。

### 阶段 3.9：编辑历史与基础快捷键提示

目标：

- 建立富文本编辑历史栈。
- 支持撤销和重做。
- 接入 `Ctrl/Cmd + Z`、`Ctrl/Cmd + Shift + Z`、`Ctrl/Cmd + Y`。
- 支持 `Esc` 取消当前选区。
- 为复制、剪切、粘贴、撤销、重做、取消选区提供短暂 toast 提示。

实现原则：

- 历史栈放在 `RichCanvasWordRecord` 容器层，和 `document`、`cursor`、`selection` 同级。
- 每次真实修改 `document` 的编辑命令都通过统一 `commitEdit()` 进入历史栈。
- 只移动光标、只改变选区不进入历史栈。
- 撤销和重做恢复完整快照：`document`、`cursor`、`selection`。
- `RichCanvasWordSurface` 只负责识别快捷键并触发回调，不直接修改 history。
- toast 由容器层管理，surface 只负责展示。

当前进展：

- 已新增富文本 history state。
- 已把输入、删除、Enter 拆分、剪切、粘贴纳入历史记录。
- 已支持 `Ctrl/Cmd + Z` 撤销。
- 已支持 `Ctrl/Cmd + Shift + Z` 和 `Ctrl/Cmd + Y` 重做。
- 已支持 `Esc` 取消选区。
- 已支持 toast：
  - `已复制到剪切板`
  - `已剪切到剪切板`
  - `已粘贴到文档`
  - `已撤销操作`
  - `已回退`
  - `已取消选择`
- `pnpm run build` 已通过。

验收：

- 输入文字后 `Ctrl/Cmd + Z` 能撤销。
- 撤销后 `Ctrl/Cmd + Shift + Z` 或 `Ctrl/Cmd + Y` 能重做。
- 删除、粘贴、Enter 拆分 block 后也能撤销和重做。
- 有选区时按 `Esc`，选区取消并提示 `已取消选择`。
- 复制成功后提示 `已复制到剪切板`。
- 剪切成功后提示 `已剪切到剪切板`，且内容进入历史栈。
- 粘贴成功后提示 `已粘贴到文档`，且内容进入历史栈。
- 撤销成功后提示 `已撤销操作`。
- 重做成功后提示 `已回退`。
- 暂不要求 `Ctrl/Cmd + B`、`Ctrl/Cmd + U`，这两个等阶段 4 格式命令接入。
- `pnpm run build` 通过。

### 阶段 4：实现工具栏命令

目标：

- 工具栏按钮不再只是静态绘制。
- 支持命令：
  - 加粗。
  - 下划线。
  - 字体颜色。
  - 背景高亮色。
  - 字号。
  - 清除格式。
  - 左对齐。
  - 居中。
  - 右对齐。

规则：

- 有选区时，命令应用到选区。
- 无选区时，命令更新 `activeMarks` 或当前 block 对齐状态。
- 命令执行后合并相邻同样式 run。
- 命令进入历史栈。

当前进展：

- 工具栏已支持鼠标 hover、pressed、disabled 和 active 状态绘制。
- 工具栏已支持点击命令：
  - Undo。
  - Redo。
  - 加粗。
  - 下划线。
  - 字体颜色。
  - 背景高亮色。
  - 字号。
  - 清除格式。
  - 左对齐。
  - 居中。
  - 右对齐。
- 已支持 `Ctrl/Cmd + B` 加粗。
- 已支持 `Ctrl/Cmd + U` 下划线。
- 有选区时，格式命令会拆分 run 并应用到选区。
- 无选区时，格式命令会更新 `activeMarks`，影响后续输入。
- 对齐命令会修改当前 block 或选区跨过的 block。
- 格式命令和对齐命令已进入历史栈。
- 工具栏点击后会重新 focus 正文输入代理，保证可以继续键盘输入。
- 工具栏操作已增加更具体的 toast 提示，例如加粗、下划线、颜色、高亮、字号、清除格式和段落对齐。
- `pnpm run build` 已通过。

### 阶段 4.1：run 归一化与工具栏状态稳定

目标：

- 格式操作后合并相邻同样式 run，避免文档结构越来越碎。
- run 合并后，cursor 和 selection 仍能定位到新的 run。
- 选区状态下，工具栏 active 状态优先反映选区起点样式。

当前进展：

- 已新增 run marks 清理和相邻同样式 run 合并。
- 已新增 block 内字符偏移重定位逻辑。
- 格式命令和带 `activeMarks` 的输入会在更新 document 后归一化 run。
- 归一化后 cursor 会映射到合并后的 run。
- 归一化后 selection 的 anchor/focus 会映射到合并后的 run。
- `Clear` 后续输入格式不再保留无意义的 false/undefined marks。
- 工具栏 active 状态在有选区时按选区起点判断；无选区时按光标位置叠加 `activeMarks` 判断。
- `pnpm run build` 已通过。

### 阶段 4.2：工具栏交互细节和文档更新

目标：

- 工具栏点击后焦点回到正文输入代理。
- Toast 文案能反映具体格式命令。
- 文档记录阶段 4、4.1 和 4.2 的真实实现状态。

当前进展：

- 已新增 `focusRequest` 信号，工具栏命令执行后正文 textarea 会重新获得焦点。
- 已细化格式命令 toast 文案：
  - 加粗/取消加粗。
  - 下划线/取消下划线。
  - 放大/恢复字号。
  - 设置/恢复文字颜色。
  - 设置/移除高亮。
  - 清除格式。
  - 左对齐、居中对齐、右对齐。
- 已更新本文档和 `docs/README.md` 的当前状态。

验收：

- 加粗、下划线、颜色、背景色、字号可以影响后续输入。
- 有选区时可以修改已有文字样式。
- 对齐命令可以修改 block。
- 工具栏 active 状态能反映当前光标或选区起点。
- 工具栏点击后焦点回到正文输入代理。
- `pnpm run build` 通过。

### 阶段 5：富文本剪贴板与编辑体验补齐

目标：

- 内部富文本复制、剪切、粘贴。
- 系统剪贴板 `text/html` 导出。
- 页面缩放入口。
- 工具栏更复杂的颜色、字号选择。

### 阶段 5.1：内部富文本剪贴板

目标：

- 复制选区时保留 block/run/marks 结构。
- 剪切选区时保留 block/run/marks 结构，并删除原选区。
- 粘贴回当前 rich editor 时保留文字格式。
- 如果系统剪贴板内容不是当前内部富文本片段对应的纯文本，则继续按普通纯文本粘贴。

实现原则：

- 新增 `RichTextClipboardSlice`，结构为选区范围内的 blocks。
- 复制/剪切时同时写入系统剪贴板纯文本和组件内存里的 rich slice。
- 粘贴时读取系统剪贴板纯文本：
  - 如果它和内部 rich slice 的纯文本一致，使用 rich slice 粘贴。
  - 否则按外部纯文本粘贴。
- 粘贴 rich slice 时重新生成 block/run id，避免和当前 document 冲突。
- rich slice 粘贴后进入历史栈。

当前进展：

- 已新增 `RichTextClipboardSlice` 类型。
- 已新增 `extractRichTextSelectionSlice()`，可以从当前选区提取保留 marks 的富文本片段。
- 已新增 `richTextSliceToPlainText()`，用于和系统剪贴板文本比对。
- 已新增 `insertRichTextSliceAtPosition()`，可以把富文本片段插入到当前 cursor。
- 已支持复制选区后再粘贴回当前 rich editor 时保留格式。
- 已支持剪切选区后再粘贴回当前 rich editor 时保留格式。
- 粘贴外部文本时仍走纯文本路径。
- `pnpm run build` 已通过。

阶段 5.1 期间发现并修复的问题：

- 光标偶发消失。
  - 现象：在标题末尾、标题右侧空白、正文 run 中间反复点击时，某次点击后光标突然不显示。
  - 根因：轻微鼠标移动会生成 anchor/focus 相同的 collapsed selection；renderer 只要看到 selection 对象就隐藏光标，但空选区又不会绘制高亮。
  - 修复：renderer 先归一化 selection，只有真实非空选区才隐藏光标；Surface 在鼠标拖动和 Shift 扩展选区时不再保存空选区。
  - 补充：`getRichCursorRect()` 增加同 run 最近 fragment 吸附，避免 position 落在软换行或 fragment 边界时返回 null。
- 行尾回车继承上一 run 样式。
  - 现象：在带颜色、下划线、居中或右对齐的行尾按 Enter，新空行仍继承上一行样式，用户难以回到默认纯文本。
  - 修复：行尾/段尾 Enter 生成空新段落时，默认使用 `paragraph + left + 空 marks`；段落中间 Enter 仍保留后半段原格式。
  - 补充：无选区时点击 Clear，如果当前 cursor 位于空 run，会将当前空段落恢复为默认纯文本和左对齐。

### 阶段 5.2：系统剪贴板 HTML 导出

目标：

- 复制/剪切时同时写入 `text/plain` 和 `text/html`。
- 粘贴到外部富文本编辑器时尽量保留基础格式。
- 不支持 `ClipboardItem` 或 `navigator.clipboard.write()` 时继续 fallback 到纯文本。

实现原则：

- 内部 rich slice 仍然是当前编辑器保格式粘贴的权威数据。
- 系统剪贴板 HTML 是对外互操作格式，不作为当前编辑器重新解析的来源。
- HTML 序列化只覆盖 v1 当前支持的基础样式：
  - block 对齐。
  - heading/paragraph。
  - 加粗。
  - 下划线。
  - 字体颜色。
  - 背景高亮色。
  - 字号。
  - 字体族。

当前进展：

- 已新增 `editing/richTextClipboard.ts`。
- 已新增 `serializeRichTextSliceToHtml()`。
- 已新增 `writeRichTextClipboard()`。
- 复制/剪切时优先使用 `ClipboardItem` 写入：
  - `text/html`
  - `text/plain`
- 浏览器或权限不支持富文本写入时，回退到 `navigator.clipboard.writeText()`。
- `pnpm run build` 已通过。

### 阶段 5.3：系统剪贴板 HTML 读取和解析

目标：

- 从系统剪贴板读取 `text/html`。
- 将外部富文本 HTML 解析为当前 `RichTextClipboardSlice`。
- 粘贴到当前 rich editor 时尽量还原基础格式。
- 解析失败或剪贴板没有 HTML 时继续 fallback 到纯文本。

实现原则：

- 解析器保持保守，只支持当前 v1 能表达的结构和样式。
- 支持的 block：
  - `h1` ~ `h6`。
  - `p`。
  - `div`。
  - `li`。
- 支持的 inline 样式：
  - `strong` / `b` / `font-weight`。
  - `u` / `text-decoration: underline`。
  - `color`。
  - `background-color`。
  - `font-size`。
  - `font-family`。
- 系统 HTML 解析结果只作为粘贴输入，不替代内部 rich slice 的优先级。

当前进展：

- 已新增 `parseHtmlToRichTextSlice()`。
- 已新增 `readClipboardHtml()`。
- 粘贴流程已调整为：
  - 如果系统纯文本和内部 rich slice 匹配，优先粘贴内部 rich slice。
  - 否则尝试读取并解析系统 `text/html`。
  - HTML 可解析时，按 rich slice 粘贴并保留格式。
- HTML 不存在或解析失败时，继续按纯文本粘贴。
- `pnpm run build` 已通过。

### 阶段 5.4：页面缩放入口

目标：

- 让工具栏中的缩放按钮从占位状态变为可用。
- 支持固定缩放档位。
- 缩放只影响显示比例，不改变 document 中的字号、marks、block 或 run。
- 缩放后鼠标 hit test、光标、选区和 IME 输入代理仍然对齐。

实现原则：

- layout 仍使用未缩放的 A4 逻辑坐标。
- renderer 通过 CSS width/height 调整 Canvas 显示尺寸。
- 鼠标命中时根据 zoom 把屏幕坐标反算回未缩放的逻辑坐标。
- IME textarea 使用 cursor rect 的逻辑坐标乘以 zoom 后定位。

当前进展：

- 已新增缩放状态 `zoom`。
- 工具栏缩放按钮会动态显示当前缩放百分比。
- 点击缩放按钮会在以下档位循环：
  - 75%
  - 100%
  - 125%
  - 150%
- 正文 Canvas 显示尺寸会随 zoom 变化。
- 正文 Canvas 真实绘制缓冲区会同时乘以 `zoom * devicePixelRatio`，避免只靠 CSS 放大导致文字模糊。
- 鼠标点击定位已按 zoom 反算坐标。
- IME 输入代理位置和高度已按 zoom 同步。
- `pnpm run build` 已通过。

### 阶段 5.5：字号和颜色配置增强

目标：

- 将固定字号、固定文字颜色、固定高亮色升级为配置化档位。
- 字号新增 `12`。
- 文字颜色扩展为更多常用颜色。
- 高亮色使用更适合背景的浅色配置。
- 当前阶段仍保持 Canvas 工具栏点击循环切换，不引入复杂弹层。

当前进展：

- 已新增 `toolbar/formatOptions.ts`。
- 字号档位：
  - 12
  - 14
  - 16
  - 18
  - 22
  - 26
- 文字颜色档位：
  - 默认。
  - 红色。
  - 橙色。
  - 黄色。
  - 绿色。
  - 青色。
  - 蓝色。
  - 藏蓝色。
  - 紫色。
  - 紫罗兰色。
  - 褐色。
  - 红褐色。
  - 灰色。
  - 白色。
- 高亮色档位：
  - 无高亮。
  - 黄色。
  - 绿色。
  - 青色。
  - 蓝色。
  - 紫罗兰色。
  - 橙色。
  - 粉色。
  - 灰色。
- 字号按钮会显示当前字号。
- 文字颜色和高亮按钮底部色条会显示当前颜色。
- 有选区时，循环命令应用到选区。
- 无选区时，循环命令更新后续输入格式。
- `pnpm run build` 已通过。

### 阶段 5.6：结构优化总览

背景：

- 阶段 4、5 的富文本能力陆续完成后，`rich-canvas-word` 的核心文件开始变长。
- 为了后续继续开发保存、查找替换、业务包装层，先进行一轮“不改用户可见行为”的结构拆分。
- 本轮优化遵循兼容原则：尽量保留原公开导入入口，通过 barrel/re-export 降低调用方改动面。

优化结果：

- React 容器层：
  - `RichCanvasWordRecord.tsx` 收敛为薄容器。
  - `RichCanvasWordSurface.tsx` 从约 369 行收敛到约 149 行。
  - `useRichCanvasWordEditor.ts` 从约 507 行收敛到约 163 行。
- 编辑命令层：
  - `richTextEditing.ts` 从大编辑文件收敛到约 111 行。
  - 拆出 position、normalization、selection、format commands、block commands、clipboard slice 等模块。
- 排版定位层：
  - `richTextLayout.ts` 从约 648 行收敛到约 19 行兼容出口。
  - 拆出 line breaking、hit testing、caret 几何三块。
- 事件桥接层：
  - Surface 内的 pointer、keyboard、composition/IME 事件拆成独立 hook。
- 状态命令层：
  - editor hook 内的 history、format、clipboard、text commands 拆成独立 hook。

已新增/调整的主要文件：

- `hooks/useRichCanvasRendering.ts`
- `hooks/useRichCanvasPointerHandlers.ts`
- `hooks/useRichCanvasKeyboardHandlers.ts`
- `hooks/useRichCanvasCompositionHandlers.ts`
- `hooks/useRichCanvasHistory.ts`
- `hooks/useRichCanvasFormatCommands.ts`
- `hooks/useRichCanvasClipboardCommands.ts`
- `hooks/useRichCanvasTextCommands.ts`
- `editing/richTextPosition.ts`
- `editing/richTextNormalization.ts`
- `editing/richTextSelection.ts`
- `editing/richTextFormatCommands.ts`
- `editing/richTextBlockCommands.ts`
- `editing/richTextClipboardSlice.ts`
- `layout/richTextLineBreaking.ts`
- `layout/richTextHitTesting.ts`
- `layout/richTextCaret.ts`

验证：

- 每个拆分阶段均通过 `pnpm run build`。
- 当前优化主要是结构移动和职责拆分，不主动改变富文本编辑语义。

### 阶段 5.6a：rich-canvas-word 结构拆分第一批

目标：

- 在继续新增保存、查找、业务包装层之前，先降低 v1 关键文件复杂度。
- 优先拆低风险的 React 容器和渲染副作用，不改变用户可见行为。

当前进展：

- 已新增 `hooks/useRichCanvasWordEditor.ts`。
  - 承载 document、cursor、selection、activeMarks、history、toast、zoom 等 editor state。
  - 承载工具栏状态派生和所有编辑命令。
  - 承载复制、剪切、粘贴、撤销、重做、格式命令、对齐命令和缩放命令。
- `RichCanvasWordRecord.tsx` 已从 535 行左右收敛为薄容器组件。
  - 只负责标题、toolbar、surface 的组装。
- 已新增 `hooks/useRichCanvasRendering.ts`。
  - 承载正文 Canvas 渲染 effect。
  - 承载 IME textarea 锚点定位。
  - 承载工具栏点击后的 focus 回流。
- `RichCanvasWordSurface.tsx` 已移出渲染和 IME 锚点相关 effect，保留 DOM 事件桥接。
- 已新增 `editing/richTextPosition.ts`。
  - 承载 offset clamp、run 查找、位置比较、文档边界位置等低层定位 helper。
  - `richTextEditing.ts` 继续 re-export 原有公开入口，避免上层调用方感知路径变化。
- 已新增 `editing/richTextNormalization.ts`。
  - 承载 block/run id 生成、marks 清洗、相邻 run 合并、归一化后 cursor 重定位等逻辑。
  - 后续格式命令、粘贴命令可以共享同一套归一化语义。
- 已新增 `editing/richTextSelection.ts`。
  - 承载选区归一化、选区纯文本提取、选区删除。
  - 删除跨 block 选区时仍保持“end block 剩余内容接到 start block 后面”的段落合并语义。
- `editing/richTextEditing.ts` 已从完整编辑大文件收敛为命令聚合层，继续保留插入、回车、删除、粘贴、格式应用等较高层编辑命令。
- `pnpm run build` 已通过。

下一步拆分建议：

- 拆 `richTextLayout.ts`：
  - `richTextLineBreaking.ts`
  - `richTextHitTesting.ts`
  - `richTextCaret.ts`

### 阶段 5.6b：richTextEditing 命令分层

目标：

- 继续降低 `editing/richTextEditing.ts` 的职责密度。
- 保持 `richTextEditing.ts` 作为兼容聚合入口，避免上层 React hook、Surface、layout 一次性大改 import。
- 把“格式、段落、剪贴板片段、普通文本插入”按语义拆开。

当前进展：

- 已新增 `editing/richTextFormatCommands.ts`。
  - 承载当前 marks/align 查询。
  - 承载选区格式应用、段落对齐应用、清除当前空 run 格式。
- 已新增 `editing/richTextBlockCommands.ts`。
  - 承载 Backspace 前删、Delete 后删、Enter 拆分 block。
  - 保留 block 开头/末尾时的跨段合并语义。
- 已新增 `editing/richTextClipboardSlice.ts`。
  - 承载 rich clipboard slice 到 plain text 的转换。
  - 承载选区 rich slice 提取。
  - 承载 rich slice 粘贴插入和粘贴后 cursor 归一化。
- `editing/richTextNormalization.ts` 新增 `ensureRuns` 公共 helper，供格式命令和剪贴板 slice 共享。
- `editing/richTextEditing.ts` 已收敛为普通文本插入命令 + 兼容 re-export 聚合层。
  - 当前体量约 111 行。
  - 外部调用方仍可从 `editing/richTextEditing.ts` 导入旧函数名。
- `pnpm run build` 已通过。

后续拆分建议：

- 视需要把 `insertTextAtRichPosition` 从聚合入口继续移动到 `richTextTextCommands.ts`，让 `richTextEditing.ts` 成为纯 barrel 文件。
- 拆 `RichCanvasWordSurface.tsx` 的 pointer/keyboard/composition 事件桥接。

### 阶段 5.6c：richTextLayout 排版与定位分层

目标：

- 继续降低 `layout/richTextLayout.ts` 的职责密度。
- 将排版换行、鼠标命中、光标/选区几何拆成独立模块。
- 保留 `layout/richTextLayout.ts` 作为兼容聚合出口，避免调用方大面积改 import。

当前进展：

- 已新增 `layout/richTextLineBreaking.ts`。
  - 承载 `richCanvasWordLayout`、`createRichFont`、`layoutRichTextDocument`。
  - 承载 document -> block -> run -> char unit -> visual line -> fragment 的排版链路。
  - 保留分页、段落间距、行高、baseline、对齐、空行 fragment、标点避头和空格断行策略。
- 已新增 `layout/richTextHitTesting.ts`。
  - 承载 `hitTestRichTextPosition`。
  - 保留“先找最接近视觉行，再按 fragment 字符半宽决定 caret 落点”的点击定位语义。
  - 暴露少量内部几何 helper 供 caret 模块复用。
- 已新增 `layout/richTextCaret.ts`。
  - 承载左右/上下方向键移动。
  - 承载行首/行尾定位。
  - 承载光标矩形和选区矩形计算。
  - 保留同 run 最近 fragment fallback，避免软换行或归一化边缘导致光标消失。
- `layout/richTextLayout.ts` 已收敛为 19 行兼容 barrel。
  - 外部调用方仍可从 `layout/richTextLayout.ts` 导入旧函数名。
- `pnpm run build` 已通过。

后续拆分建议：

- 视需要把 `insertTextAtRichPosition` 从 `richTextEditing.ts` 移到 `richTextTextCommands.ts`。

### 阶段 5.6d：RichCanvasWordSurface 事件桥接分层

目标：

- 继续降低 `components/RichCanvasWordSurface.tsx` 的职责密度。
- 把正文 Canvas 的 pointer、keyboard、composition/IME 事件桥接拆成独立 hook。
- 保持 Surface 作为 DOM 组装层，不改变用户可见编辑行为。

当前进展：

- 已新增 `hooks/useRichCanvasPointerHandlers.ts`。
  - 承载 canvas mouse down/move/up/leave。
  - 承载鼠标坐标到 layout 逻辑坐标的缩放映射。
  - 承载点击定位、拖拽选区、点击后 focus 回流。
- 已新增 `hooks/useRichCanvasKeyboardHandlers.ts`。
  - 承载快捷键、方向键、Home/End、Backspace/Delete、Enter。
  - 承载 Shift + 方向键扩展选区。
  - composition 期间继续跳过普通编辑快捷键，避免中文输入过程误触发。
- 已新增 `hooks/useRichCanvasCompositionHandlers.ts`。
  - 承载输入代理 textarea 的 input 和 composition start/update/end。
  - 承载 IME 预览文本状态。
  - composition end 后继续清空 textarea 代理值。
- `hooks/useRichCanvasRendering.ts` 支持外部传入 `inputRef`。
  - Surface 可以先创建 composition 状态，再把 IME 预览文本交给渲染 hook。
  - 保留输入代理锚点定位和 focus request 行为。
- `components/RichCanvasWordSurface.tsx` 已收敛为 149 行左右的组装组件。
  - 负责维护 latest cursor/selection refs。
  - 负责连接 rendering、pointer、keyboard、composition hooks。
  - 负责输出 textarea 和 canvas DOM。
- `pnpm run build` 已通过。

后续拆分建议：

- 视需要把 `insertTextAtRichPosition` 从 `richTextEditing.ts` 移到 `richTextTextCommands.ts`。

### 阶段 5.6e：useRichCanvasWordEditor 命令分层

当前进展：

- 已新增 `hooks/useRichCanvasHistory.ts`，承载 history 栈、commit、undo、redo。
- 已新增 `hooks/useRichCanvasFormatCommands.ts`，承载 toolbar 派生、格式命令、段落对齐命令。
- 已新增 `hooks/useRichCanvasClipboardCommands.ts`，承载 copy/cut/paste 和内部/外部富文本剪贴板分流。
- 已新增 `hooks/useRichCanvasTextCommands.ts`，承载 insert/delete/split 基础编辑动作。
- `hooks/useRichCanvasWordEditor.ts` 已从约 507 行收敛到约 163 行，继续作为 editor 状态聚合 hook。
- `pnpm run build` 已通过。

后续拆分建议：

- 视需要把 `insertTextAtRichPosition` 从 `richTextEditing.ts` 移到 `richTextTextCommands.ts`。

验收：

- 复制回当前 rich editor 时能保留 block/run/marks。
- 复制到外部富文本编辑器时尽量保留基础样式。
- 全选能跨 block。
- 页面缩放后正文和 IME 锚点仍正确。
- 工具栏状态稳定。
- `pnpm run build` 通过。

## v1 回归清单

每个阶段完成后至少检查：

- `pnpm run build` 通过。
- v0 `canvas-word-basic` 页面仍可用。
- v1 页面或入口可打开。
- 正文 canvas 能绘制。
- 工具栏 canvas 能绘制。
- 点击正文可以 focus 输入代理。
- 中文输入法候选框跟随光标。
- 中文拼音预编辑串可见，字号接近当前行。
- composition end 后不残留输入代理文本。
- 长中文输入能自然换行。
- 中英文混排和空格不会导致整段提前换行。
- 标点避头规则正常。
- 鼠标点击定位光标正常。
- 鼠标拖拽选区正常。
- Backspace/Delete 正常。
- Enter 正常。
- 撤销、重做正常。
- 复制、剪切、粘贴正常。
- 工具栏点击后焦点回到正文输入代理。

## 开发建议

v1 开发初期不要急着实现所有按钮。

优先顺序应是：

1. 模型能表达。
2. layout 能排对。
3. renderer 能画对。
4. 光标和 IME 能跟上。
5. 选区能稳定。
6. 工具栏命令再逐步接入。

富文本编辑器的难点不在按钮数量，而在 `document -> layout -> renderer -> hit test -> editing command -> history` 这条链路是否稳定。

只要这条链路稳定，后续增加更多工具栏按钮和业务包装能力就会顺很多。

后续功能规划不再继续追加到本文档，统一参考 `docs/10-rich-canvas-word-next-plan.md`。
