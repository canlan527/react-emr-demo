# 已知问题与后续计划

## 已修复的重要问题

Canvas Word 编辑器的选区高亮边界曾长期不稳定，核心原因之一是宽度测量没有使用每一行真实字体。

已修复方向：

- `LayoutLine` 增加 `font` 字段。
- 标题行和正文行分别记录真实字体。
- `measureLinePrefix` 和 `drawLayoutLine` 使用 `line.font`。
- 高亮绘制不再受页脚页码字体或上一次 `ctx.font` 状态影响。

曾经的用户反馈现象：

- 鼠标拖拽选区时，复制出来的文字可能是正确的，但蓝色高亮背景宽度不一致。
- 向前划选和向后划选表现不同。
- 高亮可能盖住半个字。
- 高亮可能在行尾多出很多宽度。
- 高亮可能超出文本范围。
- 单行选择和跨行选择的边界表现不一致。

## 根因分析

系统里同时存在三套概念：

1. 原文字符索引。
2. Canvas 可视字符偏移。
3. 鼠标实际 x 坐标。

另外还有一个非常重要的测量因素：

4. 当前行真实字体。

过去多轮修复尝试在这些概念之间来回转换：

- 先尝试用原文索引推高亮。
- 后尝试用 `sourceIndexes` 推高亮。
- 再尝试用鼠标 x 直接推高亮。
- 又尝试用可视 offset 吸附。
- 最后确认必须按每一行真实字体测量。

这些局部修补让逻辑较复杂。当前核心高亮宽度问题已通过逐行字体测量缓解，但长期仍建议模型化重构。

## 推荐重构方案

如果后续新增复杂富文本能力，不建议继续在现有 `TextSelection` 上打补丁。

建议新增统一 Caret 模型：

```ts
type CaretPosition = {
  lineIndex: number;
  visualOffset: number;
  sourceOffset: number;
  x: number;
  y: number;
};

type EditorSelection = {
  anchor: CaretPosition;
  focus: CaretPosition;
};
```

### 原则

- 鼠标命中只返回 `CaretPosition`。
- 光标绘制只使用 `CaretPosition.x/y`。
- 选区复制只使用 `sourceOffset`。
- 选区背景只使用 `lineIndex + visualOffset`。
- 不允许在绘制时重新从 source 推 visual，也不允许直接用鼠标 x 画背景。

## 推荐实现步骤

### Step 1: 新建 caret 模块

建议文件：

- `src/lib/caretModel.ts`

提供：

- `hitTestCaret(point, layout)`
- `sourceOffsetToCaret(sourceOffset, layout)`
- `caretToPoint(caret, layout)`

### Step 2: 重写 selection 模块

建议文件：

- `src/lib/selectionModel.ts`

提供：

- `normalizeEditorSelection`
- `selectionToSourceRange`
- `selectionToRects`

### Step 3: 改造 CanvasWordRecord

将当前：

- `selection: TextSelection`

替换为：

- `selection: EditorSelection`

将当前：

- `cursor: number`

替换或补充为：

- `caret: CaretPosition`

### Step 4: 保留复制语义

复制/剪切/删除仍以 source range 为准。

### Step 5: 视觉验收用例

至少测试：

- 单行从左到右选择标题。
- 单行从右到左选择标题。
- 从“性别”前选到“48岁”后。
- 从“体温”后向前选到“发热”后。
- 从“术后”向前选到“胸闷”后。
- 跨空行选择。
- 中英文混排。
- 标点避头后选择。

## 其他可继续事项

### 编辑器能力

- 保存文档。
- 本地持久化。
- 打印。
- PDF 导出。
- 富文本样式。
- Shift+方向键扩展选区。
- Home/End 行首行尾。

### 文档模型

当前结构化文档最终被转成纯文本。

后续可以恢复 block 级编辑：

- 标题块。
- 字段块。
- 段落块。
- 表格块。

### UI

- 当前右键菜单和 toast 是自研轻量组件。
- 若后续项目 UI 复杂度提高，可以考虑引入 Ant Design。

## 当前构建状态

最近一次验证命令：

```bash
pnpm run build
```

构建通过。
