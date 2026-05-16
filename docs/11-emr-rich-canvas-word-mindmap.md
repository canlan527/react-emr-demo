# 电子病历与 Rich Canvas Word 架构思维导图

本文用于快速理解当前项目中电子病历、`canvas-word-basic` 和 `rich-canvas-word` 的整体脉络。它不是替代详细设计文档，而是把模块关系、数据流、编辑链路和后续演进压缩成一张可读的架构地图。

## 总览

```mermaid
mindmap
  root((React EMR Demo))
    应用层
      src/App.tsx
        History API 轻量路由
        顶部导航 top-strip
        左侧病历头 patient-card
        右侧工作区 workspace-content
      路由
        /temperature 体温单
        /overview 病历概览
        /medical-record v0电子病历
        /rich-canvas-word 富文本V1
    业务数据
      src/data/vitals.ts
        patientInfo 患者信息
        VitalRecord 生命体征记录
        createSampleRecords 示例数据
      src/lib/medical-record/medicalRecordDocument.ts
        MedicalRecordDocument
        heading 标题块
        paragraph 段落块
        fieldGroup 字段组块
        documentToPlainText
    图表模块
      TemperatureChart.tsx
        D3 SVG
        体温折线
        脉搏虚线
        血压区间条
        tooltip
    电子病历编辑器
      canvas-word-basic v0
        纯文本模型
        Canvas分页
        中文IME
        选区复制粘贴
        撤销重做
      rich-canvas-word v1
        block run 富文本模型
        Canvas正文
        Canvas工具栏
        格式命令
        草稿保存
        分页滚动跟随
    后续业务包装
      medical-record 业务层
        患者字段
        病历模板
        常用短语
        医疗符号
        结构化质控
```

## 电子病历主线

```mermaid
flowchart TD
  A["patientInfo 患者基础信息"] --> B["App.tsx 病历头展示"]
  A --> C["medicalRecordDocument.ts 示例病历生成"]
  C --> D["MedicalRecordDocument 结构化文档"]
  D --> E["documentToPlainText()"]
  E --> F["canvas-word-basic /medical-record"]

  D -.未来演进.-> G["medical-record 业务包装层"]
  G --> H["转换为 RichTextDocument"]
  H --> I["rich-canvas-word 通用富文本能力"]

  B --> J["左侧 patient-card"]
  I --> K["右侧富文本编辑区"]
```

当前 `/medical-record` 仍走 v0 纯文本链路：结构化病历先转成纯文本，再交给 `canvas-word-basic` 编辑。未来更理想的路线是让 `medical-record` 业务层把病历结构转换为 `RichTextDocument`，再调用 `rich-canvas-word` 的通用编辑命令。

## v0：canvas-word-basic

```mermaid
mindmap
  root((canvas-word-basic v0))
    定位
      纯文本Canvas Word
      电子病历基础编辑器
      rich版本的稳定对照组
    入口
      CanvasWordRecord.tsx
        组装病历文档
        连接Surface和hooks
    展示层
      CanvasWordSurface.tsx
        canvas
        隐藏textarea
        toast
        scroller
      CanvasWordContextMenu.tsx
        撤销
        重做
        复制
        剪切
        粘贴
        删除
    排版层
      canvasTextLayout.ts
        字符测量
        自动换行
        分页
        标点避头
        source和visual映射
      canvasWordRenderer.ts
        页面背景
        文本
        选区
        光标
    编辑层
      textEditing.ts
        插入
        删除
        替换
      textSelection.ts
        选区归一化
        选区矩形
      wordClipboard.ts
        Clipboard API
      wordHistory.ts
        past future
    事件层
      useCanvasWordEditor
      useCanvasWordKeyboard
      useCanvasWordMouseSelection
      useImeAnchor
    已知风险
      原文索引
      可视offset
      鼠标x坐标
      行真实font
      多概念转换复杂
```

v0 的核心模型很简单：

```ts
type PlainEditorState = {
  text: string;
  cursor: number;
  selection: { anchor: number; focus: number } | null;
};
```

它的优势是稳定、直观、依赖少；限制是无法自然表达同一段文字内的不同字号、颜色、加粗、下划线和段落对齐。因此 v1 没有继续在 v0 上堆功能，而是新建了 `rich-canvas-word`。

## v1：rich-canvas-word

```mermaid
mindmap
  root((rich-canvas-word v1))
    定位
      通用富文本Canvas Word
      不耦合电子病历业务
      未来被medical-record包装
    入口
      RichCanvasWordRecord.tsx
        标题状态
        Canvas工具栏
        Canvas正文Surface
    文档模型
      richTypes.ts
        RichTextDocument
        RichTextBlock
        RichTextRun
        RichTextMarks
        RichTextPosition
        RichTextSelection
      document/richTextDocument.ts
        示例文档
      document/richTextPersistence.ts
        localStorage草稿
        schemaVersion
        savedAt
    编辑命令
      richTextEditing.ts
        插入文本
        删除
        替换
      richTextBlockCommands.ts
        Enter拆分block
        Backspace合并block
        Delete合并block
      richTextFormatCommands.ts
        加粗
        下划线
        字号
        颜色
        高亮
        对齐
      richTextSelection.ts
        归一化
        删除选区
      richTextClipboard.ts
        text/plain
        text/html
      richTextClipboardSlice.ts
        内部富文本片段
      richTextNormalization.ts
        合并相邻run
        修复cursor
    排版绘制
      richTextLineBreaking.ts
        run级测量
        自动换行
        分页
        对齐
      richTextLayout.ts
        排版聚合出口
      richTextCaret.ts
        光标矩形
        方向键移动
        选区矩形
      richTextHitTesting.ts
        鼠标命中position
      richTextRenderer.ts
        页面
        run文本
        背景高亮
        下划线
        选区
        光标
      richToolbarLayout.ts
        工具栏按钮布局
      richToolbarRenderer.ts
        Canvas工具栏绘制
    React Hooks
      useRichCanvasWordEditor
        document
        cursor
        selection
        activeMarks
        history
        saveStatus
      useRichCanvasRendering
        Canvas重绘
        IME锚点
        光标滚动跟随
      useRichCanvasKeyboardHandlers
        快捷键
        方向键
        删除
        回车
      useRichCanvasPointerHandlers
        点击定位
        鼠标拖选
      useRichCanvasCompositionHandlers
        中文输入法
      useRichCanvasHistory
        undo redo
      useRichCanvasFormatCommands
        工具栏状态
        格式命令
      useRichCanvasClipboardCommands
        复制
        剪切
        粘贴
    工具栏
      toolbarConfig.ts
        Save
        Reset
        Undo
        Redo
        Bold
        Underline
        FontSize
        TextColor
        Highlight
        Clear
        Align
        Zoom
      formatOptions.ts
        字号档位
        颜色循环
        高亮循环
```

## 富文本数据模型

```mermaid
classDiagram
  class RichTextDocument {
    id: string
    title: string
    blocks: RichTextBlock[]
  }

  class RichTextBlock {
    id: string
    type: heading | paragraph
    align: left | center | right
    runs: RichTextRun[]
  }

  class RichTextRun {
    id: string
    text: string
    marks: RichTextMarks
  }

  class RichTextMarks {
    bold?: boolean
    underline?: boolean
    color?: string
    backgroundColor?: string
    fontSize?: number
    fontFamily?: string
  }

  class RichTextPosition {
    blockId: string
    runId: string
    offset: number
  }

  class RichTextSelection {
    anchor: RichTextPosition
    focus: RichTextPosition
  }

  RichTextDocument "1" --> "*" RichTextBlock
  RichTextBlock "1" --> "*" RichTextRun
  RichTextRun "1" --> "1" RichTextMarks
  RichTextSelection --> RichTextPosition
```

理解这个模型的关键：

- `block` 是段落或标题。
- `run` 是一段样式连续的文字。
- `marks` 是这段文字的字符级样式。
- `position` 不用全局字符索引，而用 `blockId + runId + offset`。
- `selection` 保存原始方向，使用前再归一化。

## Rich Canvas Word 编辑链路

```mermaid
flowchart TD
  A["用户输入/点击/快捷键/工具栏"] --> B{"事件来源"}

  B --> C["Keyboard Handlers"]
  B --> D["Pointer Handlers"]
  B --> E["Composition Handlers"]
  B --> F["Toolbar Command"]

  C --> G["编辑命令"]
  D --> H["hitTestRichTextPosition"]
  E --> G
  F --> I["格式命令"]

  H --> J["setCursor / setSelection"]
  G --> K["commitEdit"]
  I --> K

  K --> L["更新 document / cursor / selection"]
  L --> M["保存 history 快照"]
  L --> N["更新保存状态"]
  L --> O["触发 renderRichTextDocument"]

  O --> P["layoutRichTextDocument"]
  P --> Q["RichTextLayoutResult"]
  Q --> R["绘制页面/文字/选区/光标"]
  Q --> S["定位IME textarea"]
  Q --> T["光标超出视口时滚动 scroller"]
```

这条链路里最重要的分工是：

- 编辑命令只更新文档模型，不关心 Canvas 像素。
- layout 负责把文档变成视觉行、fragment、页面高度和坐标。
- renderer 负责画出来，不直接修改 React 状态。
- hook 负责把 React 状态、DOM 事件、Canvas 绘制和输入代理接起来。

## 分页与滚动逻辑

```mermaid
flowchart TD
  A["document/cursor/selection/zoom变化"] --> B["useRichCanvasRendering"]
  B --> C["renderRichTextDocument"]
  C --> D["layoutRichTextDocument"]
  D --> E["layout.height 和 pages"]
  E --> F["设置 canvas 实际尺寸和CSS尺寸"]
  F --> G["绘制所有页面"]
  G --> H["getRichCursorRect"]
  H --> I["定位IME textarea"]
  H --> J{"caret是否接近不可见区域"}
  J -- 是 --> K["调整 rich-canvas-scroller.scrollTop"]
  J -- 否 --> L["保持当前滚动位置"]
```

当前已修复的问题：

- 当输入内容增长到新页面时，Canvas 会生成新页。
- 光标进入新页后，滚动容器会自动滚动到光标附近。
- 用户不再需要手动滚轮追踪下一页编辑位置。

## 复制粘贴与格式保留

```mermaid
flowchart LR
  A["选区"] --> B["normalizeRichTextSelection"]
  B --> C["创建 RichTextClipboardSlice"]
  C --> D["内部剪贴板 保留run格式"]
  C --> E["写入 text/html"]
  C --> F["写入 text/plain"]

  G["粘贴"] --> H{"来源"}
  H --> I["内部 rich slice"]
  H --> J["外部 text/html"]
  H --> K["外部 text/plain"]
  I --> L["insertRichTextSliceAtPosition"]
  J --> M["解析基础HTML格式"]
  K --> N["按纯文本插入"]
  L --> O["normalizeDocumentAndCursor"]
  M --> O
  N --> O
```

## 持久化与保存状态

```mermaid
flowchart TD
  A["编辑 document"] --> B["标记未保存更改"]
  B --> C["1.5秒 debounce"]
  C --> D["saveRichCanvasWordDraft"]
  D --> E["localStorage"]
  E --> F["schemaVersion: 1"]
  E --> G["savedAt"]
  E --> H["document"]
  D --> I["保存状态 已自动保存 HH:mm"]

  J["页面初始化"] --> K["loadRichCanvasWordDraft"]
  K --> L{"草稿有效吗"}
  L -- 是 --> M["恢复本地草稿"]
  L -- 否 --> N["使用 sampleRichTextDocument"]

  O["Reset"] --> P["clearRichCanvasWordDraft"]
  P --> Q["恢复示例文档"]
  Q --> R["清空history和内部剪贴板"]
```

## 当前边界

```mermaid
mindmap
  root((边界))
    rich-canvas-word负责
      通用富文本模型
      通用编辑命令
      Canvas排版渲染
      工具栏
      剪贴板
      撤销重做
      草稿保存
    rich-canvas-word不负责
      患者字段语义
      病历模板语义
      医疗短语
      医疗符号
      病历质控
      后端保存协议
    medical-record未来负责
      将患者信息转换为插入命令
      将病历模板转换为block/run
      封装业务工具栏
      对接后端保存
      结构化字段绑定
    v2未来负责
      表格
      图片
      浮动文本框
      批注
      页眉页脚
      打印PDF
```

## 推荐阅读顺序

1. 先读 [README.md](./README.md)，了解项目状态。
2. 再读 [02-technical-architecture.md](./02-technical-architecture.md)，理解页面和模块边界。
3. 如果关心 v0 编辑器，读 [05-canvas-editor-architecture.md](./05-canvas-editor-architecture.md) 和 [08-canvas-word-record-refactor-plan.md](./08-canvas-word-record-refactor-plan.md)。
4. 如果关心 rich editor，读 [09-rich-canvas-word-v1-plan.md](./09-rich-canvas-word-v1-plan.md) 和 [10-rich-canvas-word-next-plan.md](./10-rich-canvas-word-next-plan.md)。
5. 如果要接入电子病历业务层，从 [07-canvas-word-version-roadmap.md](./07-canvas-word-version-roadmap.md) 的 `medical-record` 包装层规划开始。

## 一句话架构总结

当前项目把“医疗业务语义”和“通用文档编辑能力”拆开：`medical-record` 负责患者、诊断、模板等业务概念，`rich-canvas-word` 负责通用富文本编辑器内核，`App.tsx` 负责把它们放进可演示的 EMR 页面里。
