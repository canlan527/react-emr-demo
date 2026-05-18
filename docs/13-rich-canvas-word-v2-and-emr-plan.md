# Rich Canvas Word V2 与结构化 EMR 规划

本文整理一次关于 `rich-canvas-word` V2 和结构化电子病历业务层的讨论结论。它既是答疑记录，也是后续开发规划。

核心结论：

- `rich-canvas-word` 是通用富文本 Word 编辑器，不放入 `medical`、`record`、`patient`、`diagnosis` 等医疗业务语义。
- `src/lib/medical-record` 是电子病历业务层，可以出现患者、诊断、生命体征、病历模板、质控、归档等业务概念。
- 后续更推荐先增强 `rich-canvas-word` V2 的通用能力和公共 API，再让 `medical-record` 调用这些通用能力实现结构化 EMR。
- V2 不应一次性做完整 Word，而应先做公共 API 和可扩展文档模型，再逐步做表格、图片、批注、页眉页脚等对象能力。

## HIS 与 EMR 的业务边界

HIS 更像医院的业务流转和运营系统，关注人、号、床、费用、医嘱、检查检验申请、药品和结算。

典型 HIS 能力包括：

- 挂号。
- 收费。
- 住院登记。
- 床位管理。
- 医嘱管理。
- 药房发药。
- 检查检验申请。
- 费用结算。
- 护理执行。
- 医保结算。

EMR 是电子病历系统，更关注医生和护士形成的医疗文书、诊疗记录、质控和归档。

典型 EMR 内容包括：

- 入院记录。
- 首次病程记录。
- 日常病程记录。
- 手术记录。
- 会诊记录。
- 出院记录。
- 护理记录。
- 知情同意书。
- 诊疗计划。
- 病历质控。
- 归档病历。

在当前项目中，可以把数据来源和模块关系理解为：

```txt
src/data/vitals.ts
  模拟 HIS/护理系统提供的患者信息和生命体征。

src/lib/rich-canvas-word
  通用富文本编辑器，只负责文档编辑、排版、渲染、导出和打印。

src/lib/medical-record
  EMR 业务层，把患者、诊断、生命体征和病历模板转换成 RichTextDocument。
```

## 当前层级判断

`rich-canvas-word` 目录下不携带电子病历业务词，这是正确方向。它应继续保持通用性。

`medical-record` 目录可以被明确视为电子病历业务层。因此在这个目录下，组件命名不必再额外加入 `Business` 这个词。例如：

- `MedicalRecordToolbar.tsx` 优于 `MedicalRecordBusinessToolbar.tsx`。
- `MedicalRecordEditor.tsx` 可以作为后续 `MedicalRichRecordEditor.tsx` 的更长期命名。
- `MedicalRecordTemplatePanel.tsx`、`MedicalRecordFieldPanel.tsx`、`MedicalRecordQualityPanel.tsx` 都可以直接表达业务含义。

建议后续结构：

```txt
src/lib/medical-record/
  MedicalRecordEditor.tsx
  MedicalRecordToolbar.tsx
  MedicalRecordSidebar.tsx
  MedicalRecordTemplatePanel.tsx
  MedicalRecordFieldPanel.tsx
  MedicalRecordQualityPanel.tsx

  medicalRecordTypes.ts
  medicalRecordFields.ts
  medicalRecordTemplates.ts
  medicalRecordPhrases.ts
  medicalRecordQuality.ts
  medicalRecordDocumentOps.ts
  richMedicalRecordDocument.ts

  styles/
    MedicalRecordEditor.scss
```

职责建议：

- `MedicalRecordEditor.tsx`：电子病历主组件，管理文档、编辑/归档状态、保存状态，并组合业务 UI 和 `RichCanvasWordRecord`。
- `MedicalRecordToolbar.tsx`：插入患者字段、插入模板、同步体征、保存、归档预览等业务按钮。
- `MedicalRecordSidebar.tsx`：承载模板、短语、质控结果等辅助面板。
- `medicalRecordTypes.ts`：定义病历章节、模板、字段、质控结果等业务类型。
- `medicalRecordFields.ts`：管理患者字段定义，并把 `PatientInfo` 转为可插入内容。
- `medicalRecordTemplates.ts`：管理主诉、现病史、体格检查、诊疗计划、病程记录等模板。
- `medicalRecordPhrases.ts`：管理常用医疗短语。
- `medicalRecordQuality.ts`：检查空段落、缺少签名、缺少诊断、未归档等问题。
- `medicalRecordDocumentOps.ts`：专门处理 `RichTextDocument` 的追加、替换章节、插入片段、同步体征摘要等操作。
- `richMedicalRecordDocument.ts`：把患者信息和生命体征生成初始富文本病历。

## 通用 V2 能力与 EMR 业务能力的边界

判断标准：

- 如果能力可以被任何 Word 类编辑器使用，它属于 `rich-canvas-word`。
- 如果能力只理解医疗业务语义，它属于 `medical-record`。

适合进入 `rich-canvas-word` V2 的能力：

- 公共编辑器 API。
- 可扩展 block 文档模型。
- 表格。
- 图片。
- 批注。
- 页眉页脚。
- DOCX 导出。
- 更高质量 PDF 或可选择文本 PDF 的通用导出能力。

不适合进入 `rich-canvas-word` V2 的能力：

- 插入患者姓名。
- 插入住院号。
- 插入诊断。
- 插入主诉、现病史、诊疗计划模板。
- 同步生命体征摘要。
- 病历质控规则。
- 归档状态和归档人。
- HIS/EMR 保存协议。
- 医疗常用短语。

示例边界：

```txt
rich-canvas-word V2 提供通用表格能力。
medical-record 使用表格能力生成生命体征表、护理记录表、病程记录表。

rich-canvas-word V2 提供通用图片能力。
medical-record 使用图片能力插入签名、检查图像或扫描附件。

rich-canvas-word V2 提供通用批注能力。
medical-record 使用批注能力呈现病历质控意见。
```

## 为什么建议先做 V2 底座

如果直接在 `medical-record` 里做复杂 EMR 功能，会遇到两个问题：

- 业务层很快需要插入到当前光标、替换选区、插入表格、插入图片、添加批注，但这些都属于通用编辑器能力。
- 如果绕开 `rich-canvas-word` 内部状态，直接在业务层改 `RichTextDocument`，只能比较自然地做到追加到文末、替换指定章节或重建整篇文档，不容易做到“插入到当前光标位置”。

因此更合理的路线是：

```txt
先做 rich-canvas-word V2 公共 API 和可扩展模型
  再做表格、图片、批注、页眉页脚等通用能力
    最后由 medical-record 调用这些能力实现结构化 EMR
```

这样 `rich-canvas-word` 会变强，`medical-record` 会变聪明，但两者不会互相污染。

## V2 建议开发顺序

### V2.0：公共 API 和编辑器控制能力

当前进展：

- 已新增 `RichCanvasWordEditorHandle` 公共类型。
- `RichCanvasWordRecord` 已支持 `ref` 暴露通用编辑器 handle。
- 公共入口 `src/lib/rich-canvas-word/index.ts` 已导出 `RichCanvasWordEditorHandle`。
- 已支持 `placeholder?: string`。
- 已支持 `onCursorChange?: (cursor: RichTextPosition | null) => void`。
- 已支持 `onSelectionChange?: (selection: RichTextSelection | null) => void`。
- 外部可通过 handle 调用：
  - `focus()`。
  - `getDocument()`。
  - `getCursor()`。
  - `getSelection()`。
  - `insertText(text)`。
  - `insertBlocks(blocks)`。
  - `replaceSelection(content)`。
  - `setDocument(document)`。
- `insertText`、`insertBlocks`、`replaceSelection`、`setDocument` 均走现有 `commitEdit` 链路，保留 undo/redo、未保存状态和 `onChange` 语义。
- 只读模式下外部编辑命令会被安全拦截。
- `/rich-canvas-word` demo 已新增 V2 API 测试区，可通过按钮验证聚焦、插入文本、插入 blocks、替换选区、空文档 placeholder 和 cursor/selection 状态展示。
- `pnpm run build` 通过。

目标：

- 让外部业务层可以以通用方式操作编辑器。
- 不暴露医疗业务语义。
- 为后续 EMR 工具栏、模板插入、字段插入打基础。

建议 API：

```ts
type RichCanvasWordEditorHandle = {
  focus: () => void;
  getDocument: () => RichTextDocument;
  getCursor: () => RichTextPosition | null;
  getSelection: () => RichTextSelection | null;

  insertText: (text: string) => void;
  insertBlocks: (blocks: RichTextBlock[]) => void;
  replaceSelection: (content: string | RichTextBlock[]) => void;
};
```

建议 props：

```ts
type RichCanvasWordRecordProps = {
  autoSave?: boolean;
  defaultValue?: RichTextDocument;
  onChange?: (document: RichTextDocument) => void;
  onSave?: (document: RichTextDocument) => Promise<void> | void;
  readonly?: boolean;
  toolbarConfig?: ToolbarCommand[];
  value?: RichTextDocument;

  placeholder?: string;
  onCursorChange?: (cursor: RichTextPosition | null) => void;
  onSelectionChange?: (selection: RichTextSelection | null) => void;
};
```

注意：

- 光标和选区可以通过 `onCursorChange` / `onSelectionChange` 通知外部，也可以通过 `editorRef.current.getCursor()` 按需读取。
- 不建议让业务层直接依赖 layout 像素坐标；业务层大多数时候只需要文档位置和选区语义。

验收：

- 外部可以调用 `insertText` 在当前光标插入普通文本。
- 外部可以调用 `insertBlocks` 插入富文本 block。
- 外部可以调用 `replaceSelection` 替换当前选区。
- 操作进入 undo/redo。
- 操作触发 `onChange` 和未保存状态。
- 只读模式下外部编辑命令被禁用或安全忽略。

### V2.1：可扩展 block 文档模型

当前进展：

- 已把 `RichTextBlock` 拆成可扩展的顶层 block union。
- 已新增基础类型：
  - `RichTextBlockType`。
  - `RichTextBaseBlock`。
  - `RichTextTextBlockType`。
  - `RichTextTextBlock`。
  - `RichTextHeadingBlock`。
  - `RichTextParagraphBlock`。
- 已新增 `src/lib/rich-canvas-word/document/richTextBlocks.ts`，集中管理 text block 判断、创建和文本/HTML 标签读取。
- 公共入口已导出 block helper：
  - `createRichTextBlock`。
  - `isRichTextTextBlockType`。
  - `isRichTextTextBlock`。
  - `isRichTextHeadingBlock`。
  - `getRichTextBlockPlainText`。
  - `getRichTextBlockHtmlTag`。
- layout 已改为先筛选 text blocks，再走现有 heading/paragraph 排版路径。
- plain text serialization、clipboard HTML serialization、localStorage draft 校验已改用 block helper。
- 现有 heading/paragraph 文档行为保持不变。
- `pnpm run build` 通过。

目标：

- 让 `RichTextDocument` 不再只支持 `heading | paragraph`。
- 为表格、图片、页眉页脚、批注锚点等对象能力做模型准备。

建议模型方向：

```ts
type RichTextBlock =
  | RichParagraphBlock
  | RichHeadingBlock
  | RichTableBlock
  | RichImageBlock;
```

第一步可以只引入类型分层和渲染分发，不急着实现所有对象。

验收：

- 现有 heading/paragraph 行为不变。
- layout 和 renderer 可以按 block type 分发。
- selection、copy/paste、serialization 对未知或新增 block 有明确策略。

### V2.2：表格

当前进展：

- 已新增 `RichTextTableBlock`、`RichTextTableRow`、`RichTextTableCell` 类型。
- `RichTextBlock` 已扩展为 `heading | paragraph | table`。
- table block 当前作为文档流对象参与排版和渲染。
- 表格支持：
  - 固定行列。
  - 单元格文本。
  - 单元格内基础自动换行。
  - 边框绘制。
  - 按行分页。
  - JSON 持久化。
  - 纯文本导出时按 tab 和换行降级。
- `/rich-canvas-word` demo 的 V2 API 测试区已新增“插入表格”按钮。
- 已新增 6x6 类 WPS 表格行列选择器，hover 显示行列数，点击插入指定行列表格。
- 已支持点击 Canvas 表格单元格命中，并绘制蓝色选中边框。
- 已支持选中表格单元格后直接输入文字，Backspace/Delete 删除单元格末尾字符，Enter 在单元格内插入换行。
- 已支持单元格单击和双击的不同语义：
  - 单击已有内容单元格时，光标默认落到单元格末尾。
  - 双击已有内容位置时，光标按点击字符附近精确定位。
- 已支持单元格内按精确位置定位光标，并让输入法锚点、Canvas 光标和数据写入位置保持一致。
- 已补充表格单元格内的中文换行规则：
  - 避免中文标点出现在行首。
  - 连续标点出现在新行开头时，会尝试从上一行拉下前置文字，形成更自然的行首。
  - 数字、英文和中文混排时，换行宽度按实际测量处理，避免数字溢出单元格边界。
- 已支持表格内鼠标划选：
  - 跨单元格拖拽时，高亮矩形范围内的多行多列单元格。
  - 单个单元格内部拖拽时，高亮选中的文字范围。
- 已支持表格选区复制、剪切、粘贴：
  - 单元格内部文字选区复制/剪切/粘贴按普通文本处理。
  - 跨单元格选区复制时，会生成只包含所选行列的 `table block`。
  - 跨单元格选区写入系统剪贴板时，同时写入 `text/html` table 和 `text/plain`。
  - 粘贴到正文光标位置时，会插入一张新的表格。
  - 粘贴到表格单元格时，会以当前单元格作为左上角，按行列粘贴到目标表格。
  - 目标表格行列不足时，会自动补齐行列。
  - 空单元格区域也能复制为表格结构，不会因为纯文本为空而丢失结构。
- 已支持在表格单元格内使用 Cmd/Ctrl+A 选中整张表格区域。
- 当前表格单元格仍是阶段性编辑能力，暂不支持合并单元格、拖拽调整行高列宽、键盘方向键在单元格间跳转、外部 HTML table 解析回内部表格。
- 为了兼容现有文本编辑命令，table block 暂时保留空 `runs` 和 `align` 兼容字段；后续对象编辑模型稳定后可继续收敛。
- `pnpm run build` 通过。

优先级最高。表格对 EMR 的价值很大，可用于生命体征摘要、护理记录、病程记录、检查检验摘要等。

第一版建议范围：

- 插入固定行列表格。已完成。
- 类 WPS 行列选择器。已完成。
- 单元格文本输入。已完成。
- 单元格内自动换行。已完成。
- 单元格内中文标点避头规则。已完成。
- 单元格命中、选中和光标绘制。已完成。
- 单元格内文字选区。已完成最小版。
- 跨单元格区域选区。已完成最小版。
- 表格区域复制、剪切、粘贴。已完成最小版。
- 边框绘制。已完成。
- 表格整体作为 block 参与分页。已完成按行分页。
- JSON 持久化。已完成。
- 打印/PDF 保留表格视觉。沿用 Canvas 渲染导出链路，当前可用。

暂缓：

- 合并单元格。
- 拖拽调整列宽。
- 拖拽调整行高。
- 单元格复杂富文本编辑。
- 表格工具栏，例如插入行、删除行、插入列、删除列、边框样式、表头设置。
- 键盘 Tab / Shift+Tab / 方向键在单元格间移动。
- 外部 Word/WPS/网页 HTML table 粘贴解析为内部 `RichTextTableBlock`。
- 跨页表格重复表头。

建议下一步：

1. V2.2d：表格结构命令。
   - 在当前选中单元格附近插入行、删除行、插入列、删除列。
   - 支持清空单元格内容。
   - 命令走 `commitEdit`，支持 undo/redo。
2. V2.2e：表格尺寸控制。
   - 支持拖拽列宽。
   - 后续再评估拖拽行高。
   - `columnWidths` 从比例权重逐步明确为稳定的布局参数。
3. V2.2f：表格键盘体验。
   - Tab 进入下一个单元格。
   - Shift+Tab 回到上一个单元格。
   - 方向键在文本边界时可以跳到相邻单元格。
4. V2.2g：外部表格粘贴。
   - 从系统剪贴板读取 `text/html`。
   - 解析 `<table><tr><td>` 为 `RichTextTableBlock`。
   - 保留基础文字样式，复杂 Word 样式先降级。

### V2.3：图片

第一版建议范围：

- 插入图片 block。
- 固定宽高。
- Canvas 渲染。
- JSON 持久化。
- 打印/PDF 保留图片。

EMR 后续使用场景：

- 签名图片。
- 检查图像。
- 病灶照片。
- 扫描附件。

暂缓：

- 拖拽缩放。
- 裁剪。
- 图片环绕文字。
- 浮动定位。

### V2.4：批注

批注依赖选区语义，适合在公共 API 和基础对象能力稳定后做。

第一版建议范围：

- 对文本范围添加批注。
- 批注锚点保存到文档模型。
- 正文显示批注高亮。
- 右侧批注列表。
- 只读模式可查看批注。

EMR 后续使用场景：

- 病历质控意见。
- 上级医生审核意见。
- 归档前修改建议。

### V2.5：页眉页脚

页眉页脚和分页强相关，建议放在表格、图片、批注之后。

第一版建议范围：

- 文档级 header/footer。
- 页码。
- 每页固定区域渲染。
- 打印/PDF 保留页眉页脚。

EMR 后续使用场景：

- 医院名称。
- 文书类型。
- 患者姓名。
- 住院号。
- 页码。

### 文本框暂缓

文本框比表格和图片复杂很多，更接近浮动对象或绘图对象。它通常需要：

- 绝对定位。
- 拖拽移动。
- 调整大小。
- 框内独立编辑。
- 层级关系。
- 命中测试。
- 对象选中状态。
- 复制粘贴对象。

因此文本框不建议放入 V2 第一批。可以放到 V2 后期或 V3。

## placeholder 和空文档体验

`placeholder` 是编辑器产品体验，不是医疗业务本身。

通用层可以支持：

- `placeholder?: string`。
- 文档为空时在 Canvas 页面上绘制淡灰提示。
- 点击空白页可以定位光标。
- 第一次输入后 placeholder 消失。
- 空文档可以保存。
- 空文档可以打印或导出，但内容为空。

EMR 层可以传入医疗场景文案：

```txt
请从左侧选择模板，或直接输入病历内容
```

EMR 层还可以配合显示：

- 插入入院记录模板。
- 同步体征摘要。
- 质控提示“病历内容为空”。

placeholder 的价值是避免空白 Canvas 看起来像页面坏了，也为模板插入和结构化 EMR 的起始体验铺路。

## DOCX 导出是否需要

DOCX 在真实 EMR 中是有价值的，但不一定是最终归档格式。

真实 EMR 常见流转包括：

- 系统内归档。
- 打印纸质病历。
- PDF 归档。
- 上传病案系统。
- 病历质控系统查看。
- 患者复印病历。
- 医保、司法、转诊等场景导出。

PDF/归档格式通常更正式，DOCX 更偏可编辑交换格式。

DOCX 适合以下场景：

- 医生需要下载后继续编辑。
- 医院已有 Word 模板和套打流程。
- 病历文书需要和外部系统交换。
- 某些质控或行政流程习惯收 Word。
- 早期系统用 DOCX 作为在线编辑能力不完整时的过渡方案。

建议：

- 可以加入 DOCX 导出。
- 不要让 DOCX 反向决定编辑器模型。
- 第一版 DOCX 只支持标题、段落、加粗、下划线、字号、颜色和对齐。
- 表格、图片、页眉页脚等能力等 V2 模型稳定后再逐步映射到 DOCX。

## EMR 业务层后续功能

当 V2 公共 API 具备后，`medical-record` 可以逐步实现：

- 插入患者字段：
  - 姓名。
  - 性别。
  - 年龄。
  - 科室。
  - 床号。
  - 住院号。
  - 入院日期。
  - 诊断。
- 插入病历段落模板：
  - 主诉。
  - 现病史。
  - 既往史。
  - 体格检查。
  - 诊疗计划。
  - 病程记录。
- 插入常用短语：
  - 生命体征平稳。
  - 未诉明显不适。
  - 遵医嘱继续观察。
- 同步生命体征摘要：
  - 从 `VitalRecord[]` 生成摘要。
  - 后续增加差异提示或确认，避免静默覆盖医生已编辑内容。
- 病历质控：
  - 必填章节是否为空。
  - 是否缺少诊断。
  - 是否缺少签名。
  - 是否仍包含占位符。
- 归档：
  - 归档人。
  - 归档时间。
  - 文档版本号。
  - 归档预览下只保留复制、打印、PDF、缩放等安全功能。

## 推荐落地顺序

当前建议路线：

1. `rich-canvas-word` V2.0：公共 API 和编辑器控制能力。
2. `rich-canvas-word` V2.1：可扩展 block 文档模型。
3. `rich-canvas-word` V2.2：表格最小版。
4. `rich-canvas-word` V2.3：图片最小版。
5. `rich-canvas-word` V2.4：批注。
6. `rich-canvas-word` V2.5：页眉页脚。
7. `medical-record`：整理目录结构，并基于 V2 API 实现患者字段、模板、短语、质控、归档。
8. 导出增强：DOCX 最小版和后续可选择文本 PDF。

如果需要更小步，也可以先做：

1. V2.0 公共 API。
2. `medical-record` 目录结构整理。
3. EMR 工具栏调用 `insertText` / `insertBlocks` 插入患者字段和模板。
4. 再回到 V2 表格、图片、批注。

这样可以尽早验证 API 是否真的好用，同时不把 EMR 业务逻辑放进通用编辑器。
