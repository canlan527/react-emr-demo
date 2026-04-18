# Canvas Word 版本路线与富文本计划

## 目标

本文档记录 Canvas Word 编辑器从当前基础版，到通用富文本 Word，再到电子病历业务编辑器的演进路线。

核心原则：

- 保留当前基础版能力，不用富文本改造直接覆盖现有实现。
- 先建设通用 Word 能力，再封装电子病历业务能力。
- 按能力边界小步迁移文件，避免一次性大重构导致编辑器不可用。
- 让目录结构、组件命名和版本路线保持一致，方便后续开发者或 AI 继续接手。

## 当前前提

当前电子病历编辑器已经具备：

- Canvas 文本绘制。
- 自动换行。
- 分页。
- 中文输入法。
- 光标移动。
- 鼠标选区。
- 复制、剪切、粘贴、删除。
- 撤销、重做。
- 右键菜单。
- 加载病历文档。

当前主要限制：

- 编辑态核心仍是纯文本字符串。
- 文档结构会先通过 `documentToPlainText()` 转成纯文本。
- 标题和正文已有不同绘制样式，但还不是完整富文本模型。
- 选区仍基于文本索引和可视位置的组合模型。

## 版本分层

### v0：canvas-word-basic 基础版

v0 对应当前已经实现的 Canvas Word 编辑器。

能力范围：

- 纯文本编辑模型。
- Canvas 文本绘制。
- 自动换行。
- 分页预览。
- 中文输入法。
- 光标定位和方向键移动。
- 鼠标选区。
- 复制、剪切、粘贴、删除。
- 撤销、重做。
- 右键菜单。
- 加载病历文档。

v0 的价值是提供稳定可用的基础编辑器。后续富文本能力不应该直接破坏或替换 v0，而应在 v0 的基础能力之上分层增强。

### v1：rich-canvas-word 通用富文本版

v1 是带通用工具栏的 Canvas Word 版本。

v1 目标是成为一个通用的富文本 Word 编辑器，而不是电子病历专用编辑器。

能力范围：

- 固定在编辑器上方的通用工具栏。
- block + run 富文本文档模型。
- 加粗。
- 下划线。
- 字体颜色。
- 背景高亮色。
- 字号。
- 清除格式。
- 左对齐。
- 居中。
- 右对齐。
- 撤销、重做。
- 复制、剪切、粘贴、删除、全选。
- 通用文本插入能力。
- 页面缩放入口。

v1 不直接包含：

- 患者字段。
- 病历结构模板。
- 常用病历短语。
- 医疗符号面板。
- 诊断、床号、住院号等业务概念。
- 表格。
- 图片。
- 图形。
- 批注。
- 文本框。
- 浮动对象。
- 打印。
- PDF 导出。
- 页眉页脚。

这些业务能力应放在 `medical-record` 包装层；复杂对象能力应放在 v2。

### v2：rich-canvas-word Web Word 增强版

v2 在 v1 富文本模型稳定后继续扩展，目标是更完整的 Web Word 能力。

候选能力：

- 表格。
- 图片。
- 图形。
- 文本框。
- 批注。
- 查找替换。
- 本地缓存。
- 本地持久化。
- 打印。
- 导出 PDF。
- 页眉页脚。
- 多级列表。
- 行距和段落间距。
- 首行缩进和悬挂缩进。
- 单页视图。
- 连续页视图。
- 适合宽度。

v2 仍然保持通用 Word 定位，不直接耦合电子病历业务。

### 文本框边界

真正 Word 意义上的文本框应放在 v2。

原因是文本框不是普通 run，而更接近浮动对象或绘图对象。它通常需要支持：

- 页面内定位。
- 拖拽移动。
- 调整大小。
- 边框和背景样式。
- 层级关系。
- 对象选中状态。
- 框内文本编辑。
- 框内独立光标和选区。
- 复制粘贴对象。
- 移动、缩放、编辑内容进入撤销重做。
- 保存和重新加载对象结构。
- Canvas 对象命中测试。

未来可以考虑的对象模型：

```ts
type DrawingObject = TextBoxObject | ImageObject | ShapeObject;

type TextBoxObject = {
  id: string;
  type: 'textBox';
  x: number;
  y: number;
  width: number;
  height: number;
  content: RichTextDocument;
  style: TextBoxStyle;
};
```

如果只是插入一个随正文流动的带边框文本块，而不支持自由拖拽、缩放、浮动和独立对象选中，则可以作为 v1 后期的 `boxedText` 或 `calloutBlock` 讨论。但这种能力不应命名为 Word 文本框，以免和 v2 浮动对象混淆。

### medical-record：电子病历业务包装层

`medical-record` 是基于 `rich-canvas-word` 的业务层。

它负责把电子病历专用能力转换为通用 Word 编辑命令。

能力范围：

- 加载电子病历文档。
- 插入当前日期。
- 插入患者字段。
- 插入姓名、性别、年龄、科室、床号、住院号、入院日期、诊断等信息。
- 插入病历结构模板。
- 插入主诉、现病史、既往史、体格检查、初步诊疗计划、病程记录等文本块。
- 插入常用病历短语。
- 插入医疗符号和单位。
- 后续接入保存、结构化字段绑定、病历质控等业务能力。

业务层可以拥有自己的工具栏或业务面板，但底层应调用 `rich-canvas-word` 提供的通用插入、格式化、撤销重做和文档操作能力。

## 推荐目录结构

长期目标结构：

```txt
src/lib/
  medical-record/
    MedicalRecordWordEditor.tsx
    MedicalRecordToolbar.tsx
    medicalRecordDocument.ts
    medicalRecordFields.ts
    medicalRecordTemplates.ts
    medicalRecordPhrases.ts

  canvas-word-basic/
    CanvasWordRecord.tsx
    wordTypes.ts
    components/
      CanvasWordSurface.tsx
      CanvasWordContextMenu.tsx
    hooks/
      useCanvasWordEditor.ts
      useCanvasWordKeyboard.ts
      useCanvasWordMouseSelection.ts
      useImeAnchor.ts
    layout/
      canvasTextLayout.ts
      canvasWordRenderer.ts
    editing/
      textEditing.ts
      textSelection.ts
      wordClipboard.ts
      wordHistory.ts

  rich-canvas-word/
    RichCanvasWordRecord.tsx
    RichCanvasWordToolbar.tsx
    richTextDocument.ts
    richTextEditing.ts
    richTextLayout.ts
    richTextSelection.ts
    richTextRenderer.ts
    toolbarCommands.ts
    toolbarConfig.ts
```

目录职责：

- `canvas-word-basic`：v0 基础编辑器能力，优先保持纯文本编辑器稳定。
- `rich-canvas-word`：v1/v2 通用富文本 Word 能力，不放电子病历业务概念。
- `medical-record`：电子病历业务包装层，负责患者字段、病历模板、常用短语等业务能力。

## 分层说明

### 编辑器内核层

编辑器内核层负责文档数据和编辑行为。

它关心：

- 当前文档内容。
- 当前光标位置。
- 当前选区。
- 插入、删除、替换。
- 加粗、下划线、颜色、字号等格式命令。
- 段落对齐。
- 撤销和重做。
- active marks。
- 命令是否可用。

它不应该直接关心某个字符绘制在 Canvas 的哪个像素坐标。

### Canvas 表现层

Canvas 表现层负责测量、排版、绘制和鼠标命中。

它关心：

- 文档如何分页。
- 文档如何自动换行。
- 每个字符或 run 的绘制坐标。
- 鼠标点击位置对应文档中的哪个位置。
- 选区高亮矩形如何绘制。
- 光标竖线如何绘制。
- 不同字号混排时行高如何计算。
- 页面背景、页码、纸张边框如何绘制。

其中：

- `hit test` 指把 Canvas 上的鼠标坐标转换成文档位置。
- `selection rect` 指选区高亮需要绘制的矩形区域。
- `cursor drawing` 指根据光标位置绘制 Canvas 光标竖线。

### 业务包装层

业务包装层负责把具体业务语义转换成通用 Word 编辑命令。

例如：

- 插入患者姓名，本质上是向当前选区插入一段文本。
- 插入病程记录模板，本质上是插入一个或多个文本块。
- 插入诊断字段，未来可以升级为结构化字段 block。

业务层可以理解患者、诊断、住院号、病历模板等概念；通用 `rich-canvas-word` 不应该理解这些概念。

## 富文本文档模型

当前模型类似：

```ts
type PlainEditorState = {
  text: string;
  cursor: number;
};
```

这种模型适合纯文本，但不适合富文本。

问题包括：

- 无法表达同一段文字中不同字号、颜色、加粗状态。
- 无法表达段落对齐。
- 无法表达插入模板后的结构。
- 撤销/重做只能恢复纯文本，不能恢复样式。
- 复制粘贴只能处理纯文本。

v1 建议升级为 block + run：

```ts
type RichTextDocument = {
  blocks: DocumentBlock[];
};

type DocumentBlock = {
  id: string;
  type: 'heading' | 'paragraph' | 'fieldGroup';
  align: 'left' | 'center' | 'right';
  indent?: number;
  runs: TextRun[];
};

type TextRun = {
  id: string;
  text: string;
  marks: TextMarks;
};

type TextMarks = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
};
```

`DocumentBlock` 负责段落类型、对齐、缩进和段落级间距。

`TextRun` 负责连续文本。

`TextMarks` 负责字符级样式。

### run 是什么

这里的 `run` 不是 `run()` 函数，也不是“运行”的意思。

在富文本编辑器里，`run` 指一段连续拥有相同样式的文字。

可以把它理解为：

- 样式片段。
- 连续样式文本。
- 文本片段。
- 富文本片段。

例如这句话：

```txt
患者今日精神可，生命体征平稳。
```

如果整句话都是同一个字号、同一个颜色、没有加粗，那么它可以是一个 `run`：

```ts
{
  text: '患者今日精神可，生命体征平稳。',
  marks: {
    fontSize: 16,
    color: '#222222'
  }
}
```

如果其中“生命体征平稳”被加粗了，那么这句话就不能再用一个 `run` 表达，而要拆成多个 `run`：

```ts
[
  {
    text: '患者今日精神可，',
    marks: {
      fontSize: 16,
      color: '#222222'
    }
  },
  {
    text: '生命体征平稳',
    marks: {
      fontSize: 16,
      color: '#222222',
      bold: true
    }
  },
  {
    text: '。',
    marks: {
      fontSize: 16,
      color: '#222222'
    }
  }
]
```

对应关系可以理解为：

```txt
文档 document
  段落 block
    文字片段 run
      样式 marks
```

也就是：

- `block` 是段落。
- `run` 是段落里一小段样式连续的文字。
- `marks` 是这段文字上的样式。

### 为什么需要 run

富文本里，同一个段落内部可能出现不同样式。

例如：

```txt
患者姓名：张三，诊断：肺部感染。
```

可能需要表达：

- `患者姓名：` 加粗。
- `张三` 蓝色。
- `诊断：` 加粗。
- `肺部感染` 红色。
- 句号普通。

这时段落内就需要多个 `run`：

```ts
[
  { text: '患者姓名：', marks: { bold: true } },
  { text: '张三', marks: { color: '#2563eb' } },
  { text: '，诊断：', marks: { bold: true } },
  { text: '肺部感染', marks: { color: '#dc2626' } },
  { text: '。', marks: {} }
]
```

Canvas 绘制时，也会按 `run` 来画：

1. 设置加粗字体，画 `患者姓名：`。
2. 设置蓝色，画 `张三`。
3. 设置加粗字体，画 `，诊断：`。
4. 设置红色，画 `肺部感染`。
5. 恢复普通样式，画 `。`。

这也是为什么富文本后，排版需要按 `run` 测量。每个 `run` 的样式可能不同，Canvas 的 `ctx.font`、`ctx.fillStyle` 都可能不一样，文字宽度也会变化。

如果后续觉得 `TextRun` 对项目维护者不够直观，代码实现阶段可以考虑命名为 `TextSpan`。`run` 是编辑器和排版领域的常见术语，但 `span` 更接近“一段文字”的直觉。

## 选区与富文本操作

### 无选区

当没有选区时：

- 点击加粗、颜色、字号等按钮，不立即修改已有文字。
- 编辑器记录一个 `activeMarks`。
- 后续输入的文字使用 `activeMarks`。
- 光标位于已有文本中时，工具栏展示光标所在 run 的样式。

### 有选区

当有选区时：

- 工具栏操作直接应用到选区范围。
- 如果选区跨越多个 run，需要拆分 run。
- 操作完成后选区保留，便于继续应用其它格式。
- 操作进入撤销/重做历史栈。

### 跨段选区

跨段选区需要支持：

- 对所有涉及的 run 应用字符样式。
- 对所有涉及的 block 应用段落样式。
- 复制时输出纯文本。

二期可考虑复制富文本格式。

## Canvas 排版影响

富文本后，排版不再是一个纯字符串。

新的排版需要按 run 测量：

- 每个 run 根据 `TextMarks` 生成真实 canvas font。
- 使用 `ctx.measureText()` 计算字符宽度。
- 同一视觉行可能包含多个 run。
- 同一视觉行可能包含多种字号。
- 行高应取该行所有 run 中最大字号对应的行高。

建议新增或重构：

- `richTextDocument.ts`
- `richTextEditing.ts`
- `richTextLayout.ts`
- `richTextSelection.ts`
- `richTextRenderer.ts`
- `toolbarCommands.ts`

## 撤销/重做影响

当前历史栈保存：

- `text`
- `cursor`

富文本后建议保存：

- `document`
- `selection`
- `activeMarks`

建议结构：

```ts
type RichHistorySnapshot = {
  document: RichTextDocument;
  selection: EditorSelection | null;
  activeMarks: TextMarks;
};
```

历史栈仍保持：

- `past`
- `future`

加载文档时清空历史栈。

每次工具栏命令都应该进入历史栈。

## 工具栏状态

工具栏按钮需要根据当前光标或选区更新状态。

v1 简化规则：

- 无选区时，显示光标所在 run 的样式。
- 有选区时，显示选区起点所在 run 的样式。
- 如果选区内样式不一致，暂不显示混合态。

v2 增强规则：

- 支持混合态。
- 支持半选态。
- 支持多段落对齐状态判断。

## 当前代码拆分步骤

迁移前文件：

```txt
src/lib/CanvasWordRecord.tsx
src/lib/textEditing.ts
src/lib/canvasTextLayout.ts
src/lib/medicalRecordDocument.ts
src/lib/textSelection.ts
```

建议小步迁移，不做一次性大重构。

### 第一步：按能力边界移动文件

目标结构：

```txt
src/lib/
  canvas-word-basic/
    CanvasWordRecord.tsx
    wordTypes.ts
    layout/
      canvasTextLayout.ts
    editing/
      textEditing.ts
      textSelection.ts

  medical-record/
    medicalRecordDocument.ts
```

这一阶段只调整目录和 import，不改变功能。

验收标准：

- `/medical-record` 页面仍然可以打开。
- Canvas 文档仍然可以绘制。
- 中文输入、选区、复制粘贴、撤销重做仍然可用。

### 第二步：抽出基础组件和类型

在 `canvas-word-basic` 内逐步拆出：

```txt
wordTypes.ts
components/CanvasWordSurface.tsx
components/CanvasWordContextMenu.tsx
hooks/useCanvasWordEditor.ts
hooks/useCanvasWordKeyboard.ts
hooks/useCanvasWordMouseSelection.ts
hooks/useImeAnchor.ts
layout/canvasWordRenderer.ts
editing/wordClipboard.ts
editing/wordHistory.ts
```

建议顺序：

1. 先抽 `wordTypes.ts`，放置 `HistoryState`、`HistorySnapshot`、`CursorHitMode` 等类型。
2. 再抽 `components/CanvasWordContextMenu.tsx`，把右键菜单 JSX 和按钮状态从主组件中移出。
3. 再抽 `editing/wordHistory.ts`，沉淀撤销/重做的纯函数。
4. 再抽 `editing/wordClipboard.ts` 和 `hooks/useCanvasWordEditor.ts`，沉淀剪贴板、插入、删除、替换、全选等编辑命令。
5. 再抽 `layout/canvasWordRenderer.ts`，把 Canvas 全量绘制从主组件中移出。
6. 再抽 `components/CanvasWordSurface.tsx`，承载 canvas、textarea、toast、右键菜单和 DOM 事件绑定。
7. 最后抽 `hooks/useCanvasWordKeyboard.ts`、`hooks/useCanvasWordMouseSelection.ts`、`hooks/useImeAnchor.ts`，把键盘、鼠标选区和中文输入代理继续拆开。

这一阶段的目标是降低 `CanvasWordRecord.tsx` 的复杂度，但仍保持 v0 行为不变。

### 第三步：新增 rich-canvas-word 目录

目标结构：

```txt
src/lib/
  rich-canvas-word/
    RichCanvasWordRecord.tsx
    RichCanvasWordToolbar.tsx
    richTextDocument.ts
    richTextEditing.ts
    richTextLayout.ts
    richTextSelection.ts
    richTextRenderer.ts
    toolbarCommands.ts
    toolbarConfig.ts
```

建议先实现模型和命令，再实现完整 UI：

1. 定义 `RichTextDocument`、`DocumentBlock`、`TextRun`、`TextMarks`。
2. 实现从当前纯文本或病历文档生成富文本文档。
3. 实现富文本到纯文本的映射，用于复制和过渡。
4. 实现富文本编辑命令。
5. 实现富文本 layout。
6. 实现富文本 renderer。
7. 接入通用工具栏命令。
8. 最后完善工具栏 UI。

### 第四步：新增 medical-record 业务包装层

在 `medical-record` 内逐步增加：

```txt
MedicalRecordWordEditor.tsx
MedicalRecordToolbar.tsx
medicalRecordFields.ts
medicalRecordTemplates.ts
medicalRecordPhrases.ts
```

这一层只负责电子病历业务语义。

建议规则：

- `medicalRecordFields.ts` 维护患者字段插入配置。
- `medicalRecordTemplates.ts` 维护主诉、现病史、既往史、体格检查等结构模板。
- `medicalRecordPhrases.ts` 维护常用病历短语。
- `MedicalRecordWordEditor.tsx` 组合 `RichCanvasWordRecord` 和业务工具栏。
- `MedicalRecordToolbar.tsx` 把业务操作转换成通用 Word 插入命令。

## 验收标准

v1 验收：

- v0 基础版仍然可用。
- 工具栏在通用 rich-canvas-word 编辑器中可见。
- 选中文本后，可以应用加粗、下划线、字体颜色、背景高亮、字号。
- 无选区时，设置样式后继续输入，新文字使用该样式。
- 左对齐、居中、右对齐能作用于当前段落或选区段落。
- 所有工具栏操作支持撤销/重做。
- 中文输入法仍能正常输入。
- 选区高亮仍与文字位置一致。
- Canvas 分页和自动换行仍正常。

v2 验收：

- 表格、图片、图形、文本框、批注等对象能力不破坏 v1 富文本编辑。
- 对象选中、移动、缩放、编辑、删除有明确交互策略。
- 复杂富文本复制粘贴有明确策略。
- 文档模型可以保存和重新加载。

medical-record 验收：

- 能基于 rich-canvas-word 插入当前日期、患者字段、病历模板、常用短语、医疗单位。
- 业务插入命令支持替换当前选区或插入到光标位置。
- 业务插入命令进入撤销/重做历史栈。
- 业务层不反向污染通用 rich-canvas-word 模块。

## 风险点

- 富文本会显著增加排版复杂度。
- 多字号混排会影响行高和光标命中。
- run 拆分和合并容易产生边界 bug。
- 标点避头逻辑需要适配跨 run 文本。
- 选区模型如果继续临时扩展，维护成本会升高。
- 撤销/重做从纯文本升级为文档快照后，需要控制快照大小。
- 文本框、图片、图形等对象能力会引入新的命中测试、层级、拖拽和序列化复杂度。

## 边界约束

后续开发应尽量遵守：

- `canvas-word-basic` 不引入富文本业务复杂度，优先保持 v0 稳定。
- `rich-canvas-word` 不依赖患者、诊断、床号、住院号等电子病历业务概念。
- `medical-record` 可以依赖 `rich-canvas-word`，但不要把业务逻辑反向放回通用 Word 层。
- 富文本工具栏按钮应尽量调用命令层，不直接在组件里操作文档结构。
- Canvas 绘制、hit test、selection rect、cursor drawing 尽量集中在表现层。
- 撤销/重做应覆盖所有会改变文档或样式的命令。
- 每次结构性迁移后，都要回归中文输入、选区、复制粘贴、撤销重做和分页绘制。

## 建议实施顺序

1. 按能力边界迁移当前 v0 文件到 `canvas-word-basic` 和 `medical-record` 目录。
2. 抽出 v0 的类型、右键菜单、历史和编辑命令。
3. 保持 `CanvasWordRecord` 作为基础版可用。
4. 新增 `rich-canvas-word` 目录。
5. 定义 v1 富文本文档模型。
6. 实现富文本到纯文本的映射，保证复制和旧逻辑可过渡。
7. 重构 layout，让视觉行可以包含多个 run。
8. 重构 selection，让选区可以定位到 block/run/offset。
9. 重构 render，按 run 绘制文本样式。
10. 接入 toolbar command，但先不用复杂 UI。
11. 实现真实通用工具栏 UI。
12. 更新撤销/重做历史快照。
13. 做中文输入、选区、复制粘贴、撤销重做回归。
14. v1 稳定后，再进入 v2 对象能力，包括表格、图片、图形、文本框和批注。
15. 最后在 `medical-record` 层封装电子病历字段、模板、短语和医疗单位等业务能力。
