# Rich Canvas Word 后续功能规划

本文档承接 `09-rich-canvas-word-v1-plan.md` 的 v1 开发记录。`09` 号文档保留架构探索、问题修复和阶段 5.6 结构优化历史；从这里开始，只记录后续功能规划和产品化开发路线。

## 当前判断

`rich-canvas-word` 当前已经具备富文本编辑器 v1 的核心链路：

- block/run 文档模型。
- Canvas 排版、渲染、命中测试。
- 光标、选区、中文 IME。
- 撤销、重做。
- 复制、剪切、粘贴。
- 基础格式命令和段落对齐。
- 页面缩放。
- 分页后光标自动滚动到可视区域。
- 核心模块已经完成一轮结构拆分。

下一阶段不建议继续优先做大规模重构，应该开始补齐“文档编辑器可用性”和“业务接入能力”。

## 阶段 6：文档持久化与草稿恢复

目标：

- 支持保存当前 `RichTextDocument`。
- 页面刷新后可以恢复草稿。
- 支持保存状态提示：
  - 未保存更改。
  - 已保存。
  - 保存失败。
  - 已恢复草稿。
- 支持恢复示例文档或清空本地草稿。
- 保存数据增加版本结构，例如：

```ts
type RichCanvasWordSavedState = {
  schemaVersion: 1;
  document: RichTextDocument;
  savedAt: string;
};
```

建议先使用 `localStorage` 实现，后续再替换成后端 API。

优先级：高。

原因：

- 当前编辑器刷新即丢内容。
- 持久化是从 demo 变成可用编辑器的关键一步。
- 保存结构会倒逼检查 `RichTextDocument` 是否适合作为长期数据格式。

### 阶段 6 小目标

#### 6.1：本地草稿保存/恢复

目标：

- 将当前 `RichTextDocument` 保存到 `localStorage`。
- 页面重新打开时优先恢复草稿。
- 首次打开没有草稿时使用示例文档。
- 工具栏或页面上提供“保存”入口。
- 保存成功后显示 toast。

验收：

- 输入文字后点击保存。
- 刷新页面，内容仍存在。
- 清空浏览器 localStorage 后，重新进入显示示例文档。
- `pnpm run build` 通过。

#### 6.2：保存数据版本结构

目标：

- 保存时不直接裸存 `RichTextDocument`，而是包一层保存结构。
- 保存结构包含 `schemaVersion`、`document`、`savedAt`。
- 如果读取到不存在、损坏或版本不匹配的数据，回退到示例文档。
- 读取损坏 JSON 时不崩溃。

验收：

- localStorage 中能看到 `schemaVersion`。
- localStorage 中能看到 `savedAt`。
- 坏数据不会导致页面崩溃。
- 保存后 toast 提示“已保存草稿”。

当前进展：

- 已新增 `document/richTextPersistence.ts`。
  - 定义 `RichCanvasWordSavedState`。
  - 当前 `schemaVersion` 为 `1`。
  - 提供 `loadRichCanvasWordDraft` 和 `saveRichCanvasWordDraft`。
  - 读取时会校验版本和基础 document 结构。
  - localStorage 不可用或 JSON 损坏时返回 `null`。
- 工具栏已新增 `Save` 按钮。
- editor 初始化时会优先读取本地草稿。
- 保存成功显示“已保存草稿”。
- 恢复本地草稿后显示“已恢复本地草稿”。

#### 6.3：未保存状态

目标：

- 编辑后显示“未保存”状态。
- 保存后显示“已保存”状态。
- 可以显示最近保存时间。
- 撤销/重做后也能正确进入未保存状态。

当前进展：

- editor 已维护保存状态：
  - 尚未保存。
  - 未保存更改。
  - 已保存 HH:mm。
- 保存成功后会记录 `lastSavedAt`。
- 已保存 document 会记录为快照，用于和当前 document 比对。
- 撤销/重做后如果回到已保存快照，会恢复为已保存状态；否则显示未保存更改。
- 标题区域已展示当前保存状态。

#### 6.4：恢复示例文档 / 清除草稿

目标：

- 增加“恢复示例文档”或“清除草稿”入口。
- 清除后 localStorage 删除。
- 文档回到 sample document。
- history 清空或重新初始化。

当前进展：

- 工具栏已新增 `Reset` 按钮。
- `document/richTextPersistence.ts` 已新增 `clearRichCanvasWordDraft`。
- 点击 `Reset` 后会：
  - 删除 localStorage 草稿。
  - 恢复 `sampleRichTextDocument`。
  - 重置 cursor、selection、activeMarks 和内部 rich clipboard。
  - 清空 undo/redo history。
  - 重置保存状态为“尚未保存”。
  - toast 提示“已恢复示例文档，并清除本地草稿”。
- 恢复示例文档不会进入 undo 栈，避免撤销把旧草稿带回来。

#### 6.5：自动保存

目标：

- 编辑后延迟自动保存，例如 1.5 秒 debounce。
- 显示“正在保存 / 已自动保存”。
- 保留手动保存。

说明：

- 自动保存牵涉 history、toast、保存状态频繁变化，建议放在阶段 6 后半。

当前进展：

- 已实现 1.5 秒 debounce 自动保存。
- 只有 document 存在未保存变化时才启动自动保存。
- 连续输入会取消上一轮自动保存 timer，避免每个字符都写 localStorage。
- 自动保存期间标题区显示“正在保存...”。
- 自动保存成功后标题区显示“已自动保存 HH:mm”。
- 手动 `Save` 仍保留，手动保存成功后显示“已保存 HH:mm”并 toast 提示。

#### 6.6：分页输入时自动跟随光标

目标：

- 当输入、回车、粘贴或其他编辑操作让光标进入下一页或超出当前可视区域时，正文滚动容器自动滚动到光标附近。
- 避免文档新增页面后，用户还需要手动滚轮才能继续看到正在编辑的位置。

当前进展：

- `RichCanvasWordSurface` 已为 `.rich-canvas-scroller` 增加 `scrollerRef`。
- `useRichCanvasRendering` 复用 `getRichCursorRect` 计算当前光标位置。
- 当 caret 顶部或底部接近滚动容器可视区域边界时，会自动调整 `scrollTop`。
- 该逻辑只在光标接近不可见区域时滚动，避免普通输入过程中频繁打断用户当前视图。

## 阶段 7：只读预览模式

目标：

- 支持 `readonly` 模式。
- 只渲染文档，不允许编辑。
- 禁用输入代理、光标编辑、键盘编辑命令。
- 工具栏进入只读状态，保留缩放和复制能力。
- 支持只读模式下选中文本复制。

优先级：高。

原因：

- EMR 场景通常存在编辑、审阅、归档等状态。
- 只读模式是后续业务组件 API 的基础能力。

当前进展：

- `RichCanvasWordRecord` 已支持 `readonly` prop。
- `/rich-canvas-word` demo 页已增加“编辑模式 / 只读预览”切换。
- 只读模式下标题状态显示“只读预览”，正文区域隐藏编辑光标。
- 输入代理 `textarea` 已设置 `readOnly` 和 `aria-readonly`。
- IME/input 事件在只读模式下不再提交文本。
- 键盘处理在只读模式下保留：
  - Escape 取消选区。
  - Cmd/Ctrl+A 全选。
  - Cmd/Ctrl+C 复制。
  - 方向键、Shift+方向键、Home/End 移动和扩展选区。
- 键盘处理在只读模式下禁用：
  - 撤销、重做。
  - 加粗、下划线等格式快捷键。
  - 剪切、粘贴。
  - Backspace、Delete、Enter。
- Canvas 工具栏已新增 `Copy` 按钮。
- 只读模式下工具栏仅保留 `Copy` 和 `Zoom` 可用，其余编辑类命令禁用。
- 鼠标点击和拖拽仍可定位、选择文本，方便只读复制。

验收：

- 切换到“只读预览”后状态区显示“只读预览”。
- 只读模式下点击正文不会显示编辑光标。
- 只读模式下输入文字、粘贴、删除、回车不会改变文档。
- 只读模式下可以拖拽选择文本，并通过 `Copy` 或 Cmd/Ctrl+C 复制。
- 只读模式下 `Zoom` 仍可调整页面缩放。
- `pnpm run build` 通过。

## 阶段 8：查找与替换

目标：

- 支持普通文本查找。
- 高亮所有匹配项。
- 支持上一个/下一个跳转。
- 支持替换当前项。
- 支持全部替换。
- 支持跨 run 匹配，例如一个词中间存在不同格式时仍能查到。

建议拆分：

- `richTextSearch.ts`：基于 document 的文本索引和匹配。
- `richTextSearchHighlights.ts`：把匹配结果映射到 layout rect。
- editor hook 中增加 search state。

优先级：中高。

原因：

- 查找替换是文档编辑器高频能力。
- 它能验证 `document -> layout -> selection -> command` 链路是否足够稳定。

当前进展：

- 已完成阶段 8.1：普通文本查找。
- 已完成阶段 8.2：替换当前项和全部替换。
- 已新增 `editing/richTextSearch.ts`。
  - 将每个 block 内的 run 文本按 Unicode 字符建立索引。
  - 支持同一个 block 内跨 run 匹配。
  - 返回 `RichTextSearchMatch`，其中包含可直接映射到 layout 的 `RichTextSelection`。
  - 当前查找大小写不敏感。
  - 提供 `replaceRichTextSearchMatches`，用于从后往前批量替换匹配项，避免后方 offset 变化影响前方选区。
- `RichCanvasWordRecord` 已新增查找栏：
  - 输入关键词。
  - 输入替换文本。
  - 显示当前匹配序号和总数。
  - 支持“上一个 / 下一个”。
  - 输入框 Enter 跳转到下一个匹配项。
  - 替换输入框 Enter 替换当前匹配项。
  - 支持“替换”和“全部替换”。
- renderer 已支持搜索匹配高亮：
  - 所有匹配项绘制黄色高亮。
  - 当前匹配项绘制更深的橙色高亮和描边。
- 跳转匹配项时会同步设置 selection 和 cursor，复用现有选区和滚动跟随链路。
- 查找在编辑模式和只读预览模式下都可用；替换仅编辑模式可用。
- 替换操作会进入 undo/redo history，并触发未保存状态和自动保存链路。

验收：

- 查找“体温”时显示 `1 / 3`。
- 连续点击“下一个”可从 `1 / 3` 跳到 `2 / 3`。
- 点击“上一个”可回到 `1 / 3`。
- 所有匹配项在 Canvas 正文中有搜索高亮。
- 当前匹配项有更明显的活动高亮。
- 替换当前项后文档进入未保存状态。
- 全部替换“胸闷”为“气促”后，匹配计数从 `0 / 2` 变为 `0 / 0`。
- `pnpm run build` 通过。

暂未实现：

- 跨 block 匹配。

## 阶段 9：导入导出

目标：

- 导出 JSON。
- 导出纯文本。
- 导出 HTML。
- 后续考虑打印预览、PDF 或图片导出。

建议优先级：

1. JSON 导出。
2. 纯文本导出。
3. HTML 导出。
4. 打印/PDF。

原因：

- JSON 是后端保存和业务系统集成的基础格式。
- 纯文本和 HTML 便于和外部系统流转。

当前进展：

- 已完成阶段 9.1：JSON 和纯文本导出。
- 已完成阶段 9.2：打印预览和 PDF 导出入口。
- 已新增 `document/richTextSerialization.ts`。
  - `serializeRichTextDocumentToJson` 导出带 `schemaVersion`、`exportedAt` 和 `document` 的结构。
  - `serializeRichTextDocumentToPlainText` 按 block 输出纯文本，block 之间使用换行连接。
- Canvas 工具栏已新增 `JSON` 和 `TXT` 导出入口。
- 查找/替换操作栏也提供 DOM 版“导出 JSON”和“导出 TXT”按钮，方便可访问性和自动化验证。
- 导出在编辑模式和只读预览模式下都可用。
- 导出不会修改 document，不进入 undo/redo history，也不改变未保存状态。
- 打印/PDF 链路恢复为离屏 iframe 打印。
  - iframe 内写入 Canvas renderer 裁出的分页页图。
  - 等 iframe 和所有页图加载/解码完成后再调用 `print()`。
  - iframe 保持 `210mm × 297mm`，移动到屏幕外，不再使用 `0×0` 隐藏。
- “打印预览”保留浏览器打印链路，打印内容来自同一组 Canvas 分页快照。
- “导出 PDF”改为直接生成 `.pdf` 文件下载，不再复用浏览器打印预览。
- 旧的 HTML 正常流打印序列化路径已移除，避免和 Canvas 编辑器排版产生第二套分页规则。

### 阶段 9 打印/PDF 问题记录

本阶段出现过几类打印问题，目前恢复到 iframe + Canvas 分页快照方案，作为阶段 9 结束前的稳定点。

#### 问题 1：页面内容只有 1 页，Chrome 打印显示 2 页

原因：

- 早期打印 CSS 使用 `visibility: hidden` 隐藏应用壳。
- 被隐藏的导航、侧栏、编辑器仍然参与打印布局，占据高度。
- Chrome 因此把不可见布局也计入分页，出现额外空白页。

处理：

- 后续改为离屏 iframe 打印，不再打印当前应用页面。
- 应用壳、导航、侧栏和编辑器 DOM 不参与浏览器打印布局。

#### 问题 2：打印预览带入屏幕预览卡片阴影

原因：

- 为避免弹窗拦截，曾经把 A4 预览做成页面内 DOM 卡片。
- 打印当前页面时，Chrome 会把这个屏幕预览卡片作为打印内容的一部分。
- 即使通过 `@media print` 清理阴影，仍容易被预览 DOM 的布局和样式影响。

处理：

- 已移除页面内 `RichCanvasPrintPreview` 作为打印内容的方案。
- 正式打印内容回到离屏 iframe，iframe 内只包含 Canvas 分页页图。

#### 问题 3：iframe 打印出现空白页

原因：

- 曾尝试创建隐藏 iframe，把打印 HTML 写入 iframe 后调用 `print()`。
- iframe 内图片页尚未完成加载/解码时触发打印，Chrome 可能拿到空白内容。
- 另外隐藏 iframe 和打印预览取内容的时序在不同浏览器中不稳定。

处理：

- iframe 打印路径已恢复。
- 打印前等待 iframe `load`。
- 打印前等待 iframe 内所有页图加载或解码完成。
- 不再定时移除当前打印 iframe，下一次打印前才清理旧 iframe。
- iframe 保持实际 A4 尺寸，只是移动到屏幕外，不再使用 `0×0`。

#### 问题 4：HTML 打印没有保留 Canvas 中间空白和分页

原因：

- HTML 正常流会重新排版 `RichTextDocument`。
- 它不会复刻 Canvas 编辑器中的真实行高、分页、页间空白、手动空行和光标处产生的版面效果。
- 结果是 Canvas 中显示 2 页，HTML 打印可能压成 1 页。

最终解决方式：

- 新增 `layout/richTextPrintPages.ts`。
- 使用现有 `renderRichTextDocument` 和 `richCanvasWordLayout` 生成整篇文档的 Canvas 位图。
- 按 `pageHeight + pageGap` 从整篇 Canvas 中裁切每一页。
- 每一页转成 `data:image/png`。
- iframe 只写入这些页图。
- 打印/PDF 只打印 iframe 中的页图。

当前约束：

- 打印/PDF 是位图输出，优先保证视觉、分页和 Canvas 编辑器一致。
- 文本在 PDF 中不可选择；如果后续需要可选择文本 PDF，应改为后端 PDF 渲染或专门的版式引擎。
- 新增打印功能时不得恢复 HTML 正常流打印作为正式输出路径。

#### 问题 5：专项收敛支线已回退

原因：

- 曾尝试改成页面内打印预览、`pageChrome`/`print mode`、直接 PDF 下载等方案。
- 这些改动偏离了“iframe 打印修复完成”时的稳定点，并让问题定位复杂化。

处理：

- 已移除页面内 `RichCanvasPrintPreview` 组件和样式。
- 已移除 `pageChrome`/`print mode` 分支。
- 已移除页面内预览、`pageChrome`/`print mode` 等会影响打印预览的支线。
- 打印预览恢复到 iframe 打印方案。
- 后续如需去除页图内部屏幕装饰，应作为独立小步重新设计和验收。

#### 问题 6：导出 PDF 与打印预览职责拆分

原因：

- 打印预览用于连接浏览器打印流程，适合用户检查页面、连接打印机、手动另存为 PDF。
- “导出 PDF”如果也只是触发浏览器打印，会和打印预览重复。

处理：

- 新增 `document/richTextPdfExport.ts`。
- “导出 PDF”使用同一组 Canvas 分页快照生成 PDF Blob，并触发 `.pdf` 文件下载。
- “导出 PDF”不再创建打印 iframe，也不再打开浏览器打印弹窗。
- “打印预览”继续保留 iframe + `print()` 链路。

验收：

- 点击“导出 JSON”后触发 `.json` 文件下载，并提示“已导出 JSON”。
- 点击“导出 TXT”后触发 `.txt` 文件下载，并提示“已导出纯文本”。
- 切换到只读预览后仍可导出 JSON。
- 点击“打印预览”后创建离屏 iframe，并拉起浏览器打印预览弹窗。
- 打印 iframe 中写入当前富文本文档的 Canvas 分页快照。
- 打印 iframe 中的页面内容为 `data:image/png` 页图，不包含 HTML 正文流。
- Canvas 编辑器真实 2 页时，打印预览应生成 2 张页图。
- 点击“导出 PDF”后直接下载 `.pdf` 文件，并提示“已导出 PDF”。
- `pnpm run build` 通过。

## 阶段 10：业务组件封装

目标：

- 把当前 demo 内部状态封装为可复用组件 API。
- 支持外部传入文档。
- 支持外部监听文档变更。
- 支持只读、自动保存、工具栏配置等业务参数。

建议 API：

```ts
type RichCanvasWordProps = {
  value?: RichTextDocument;
  defaultValue?: RichTextDocument;
  readonly?: boolean;
  autoSave?: boolean;
  toolbarConfig?: ToolbarCommand[];
  placeholder?: string;
  onChange?: (document: RichTextDocument) => void;
  onSave?: (document: RichTextDocument) => Promise<void> | void;
};
```

优先级：中。

原因：

- 完成后 `rich-canvas-word` 才能从 demo 模块变成 EMR 页面可嵌入的业务组件。

### 阶段 10.1：加 API，不改现有行为

目标：

- 给 `RichCanvasWordRecord` 增加最小可复用组件 API。
- 外部不传参数时，继续保持当前 demo 行为。
- 不拆保存策略，不改打印/PDF，不改查找替换。

当前进展：

- `RichCanvasWordRecordProps` 已导出。
- 已支持 `defaultValue?: RichTextDocument`。
  - `defaultValue` 只作为非受控初始文档使用。
  - 外部传入 `defaultValue` 时，不读取 localStorage 草稿，避免草稿覆盖业务传入文档。
  - 外部不传 `defaultValue` 时，仍保持原有 localStorage 草稿优先、无草稿使用示例文档的行为。
- 已支持 `onChange?: (document: RichTextDocument) => void`。
  - 首次初始化不触发。
  - 文档实际变更后触发。
- `readonly` 继续保留。
- `Reset` 在外部传入 `defaultValue` 时恢复到该初始文档；未传时仍恢复示例文档。

验收：

- 不传 `defaultValue/onChange` 时，页面行为与之前一致。
- 传入 `defaultValue` 时，初始文档使用外部文档。
- 编辑文档后触发 `onChange`。
- `pnpm run build` 通过。
- 浏览器刷新 `/rich-canvas-word` 后，标题、打印预览、导出 PDF、编辑/只读入口仍正常显示。

### 阶段 10.2：抽出保存入口，默认行为不变

目标：

- 让业务页面可以接管保存动作。
- 不传业务保存函数时，继续保持 demo 的 localStorage 草稿保存。
- 自动保存只做开关，不改变现有手动保存按钮。

当前进展：

- `RichCanvasWordRecordProps` 已支持 `autoSave?: boolean`。
  - 默认值为 `true`，保持原有自动保存草稿行为。
  - 传入 `autoSave={false}` 时，关闭自动保存定时器。
  - 手动点击 `Save` 仍可保存。
- `RichCanvasWordRecordProps` 已支持 `onSave?: (document: RichTextDocument) => Promise<void> | void`。
  - 外部不传 `onSave` 时，手动保存和自动保存继续写入 localStorage 草稿。
  - 外部传入 `onSave` 时，手动保存和自动保存调用外部保存函数。
  - 外部保存成功后更新“已保存/已自动保存”状态和未保存标记。
  - 外部保存失败时提示“保存失败，请稍后重试”，并保留未保存状态。
  - 保存请求按最新一次结果更新 UI，避免自动保存和手动保存重叠时旧请求覆盖新状态。

验收：

- 不传 `autoSave/onSave` 时，页面保存行为与之前一致。
- `autoSave={false}` 时，编辑后不触发自动保存，但手动 `Save` 仍可用。
- 传入 `onSave` 时，保存动作调用外部函数。
- `onSave` 支持同步和异步函数。
- `pnpm run build` 通过。
- 浏览器刷新 `/rich-canvas-word` 后，标题、打印预览、导出 PDF、编辑/只读入口仍正常显示，控制台无 error。

### 阶段 10.3：支持受控文档值

目标：

- 让业务页面可以通过 `value` 驱动当前文档。
- 用户编辑后通过 `onChange` 把新文档交回业务页面。
- 默认 demo 不传 `value` 时，继续保持非受控行为。

当前进展：

- `RichCanvasWordRecordProps` 已支持 `value?: RichTextDocument`。
- 外部传入 `value` 时：
  - 初始文档使用 `value`。
  - 不读取 localStorage 草稿。
  - 外部 `value` 变化后，同步更新画布文档。
  - 外部同步不会反向触发 `onChange`。
  - 同步只响应外部 `value` 内容变化，不会在用户编辑后立刻用旧 `value` 覆盖本地画布。
  - 同步外部文档时会清空 selection、active marks 和当前搜索位置，并重置 history，避免旧文档的光标/历史落到新文档上。
- 用户在画布中编辑时，仍会更新当前画布并触发 `onChange`。

当前约束：

- 当前是小步“实用受控”模式：内部会先乐观更新画布，再等待父组件通过 `value` 回传确认。
- 如果父组件传入 `value` 但不响应 `onChange` 回传，内部画布可能暂时显示本地编辑结果；后续如需严格受控模式，应单独改造 command/history 写入路径。

验收：

- 不传 `value` 时，页面行为与之前一致。
- 传入 `value` 时，初始文档使用外部文档。
- 外部更新 `value` 时，画布同步更新且不触发 `onChange` 回环。
- 用户编辑后触发 `onChange`。
- `pnpm run build` 通过。
- 浏览器刷新 `/rich-canvas-word` 后，标题、打印预览、导出 PDF、编辑/只读入口仍正常显示，控制台无 error。

### 阶段 10.4：支持工具栏按钮配置

目标：

- 让 EMR 业务页面可以按场景裁剪工具栏按钮。
- 不传配置时，继续使用当前完整工具栏。
- 只暴露命令集合，不让业务页面重写 toolbar 内部状态推导。

当前进展：

- `RichCanvasWordRecordProps` 已支持 `toolbarConfig?: ToolbarCommand[]`。
- 外部不传 `toolbarConfig` 时，继续使用默认完整工具栏。
- 外部传入 `toolbarConfig` 时：
  - 按命令集合从默认工具栏中筛选按钮。
  - 保留默认按钮文案、active、disabled、颜色和缩放显示逻辑。
  - 自动清理开头、结尾和连续的分隔线。
- `readonly` 下的按钮禁用规则仍统一由内部状态推导，不需要业务页面重复判断。

示例：

```tsx
<RichCanvasWordRecord
  toolbarConfig={['save', 'printPreview', 'exportPdf', 'copy', 'zoom']}
/>
```

验收：

- 不传 `toolbarConfig` 时，页面工具栏行为与之前一致。
- 传入 `toolbarConfig` 时，仅展示指定命令对应按钮。
- 配置后不出现开头、结尾或连续分隔线。
- `pnpm run build` 通过。
- 浏览器刷新 `/rich-canvas-word` 后，默认完整工具栏对应页面仍正常显示，控制台无 error。

### 阶段 10.5：整理公共导出入口

目标：

- 给业务页面提供稳定 import 路径。
- 只导出组件接入需要的公共 API。
- 暂不暴露内部 hooks、layout、editing 模块，避免业务层依赖编辑器内部实现。

当前进展：

- 已新增 `src/lib/rich-canvas-word/index.ts`。
- 公共入口已导出：
  - `RichCanvasWordRecord`
  - `RichCanvasWordRecordProps`
  - `RichTextDocument`
  - `RichTextBlock`
  - `RichTextRun`
  - `RichTextMarks`
  - `RichTextAlign`
  - `ToolbarCommand`
- `/rich-canvas-word` demo 页已改为从 `../lib/rich-canvas-word` 导入，先由项目自身使用公共入口。

验收：

- 业务页面可以通过 `import { RichCanvasWordRecord } from '../lib/rich-canvas-word'` 接入组件。
- 公共类型可以从同一入口导入。
- 内部 hooks/layout/editing 仍不作为公共入口导出。
- `pnpm run build` 通过。
- 浏览器刷新 `/rich-canvas-word` 后，页面仍正常显示，控制台无 error。

## 推荐开发顺序

1. 阶段 10.1：整理可复用组件 API。
2. 阶段 10.2：抽出保存入口，默认行为不变。
3. 阶段 10.3：支持受控文档值。
4. 阶段 10.4：支持工具栏按钮配置。
5. 阶段 10.5：整理公共导出入口。
6. 阶段 11.1：真实 EMR 业务包装层。已完成第一版。
7. 阶段 11.2：EMR 业务工具栏与模板插入。
8. 后续增强：DOCX 导出或后端 PDF 渲染。

## 阶段 11：真实 EMR 业务接入

### 阶段 11.1：EMR 业务包装层

目标：

- 验证 `RichCanvasWordRecord` 能否承载真实电子病历页面。
- 业务层负责患者、诊断、住院号、生命体征摘要等医疗语义。
- 通用 `rich-canvas-word` 继续只负责富文本文档编辑、渲染、查找、导出和打印。

当前进展：

- 已新增 `src/lib/medical-record/richMedicalRecordDocument.ts`。
  - 将 `PatientInfo` 和 `VitalRecord[]` 转换为 `RichTextDocument`。
  - 生成住院电子病历标题、患者字段、主诉、现病史、生命体征摘要、体格检查、诊疗计划、病程记录和签名。
  - 使用 run marks 表达加粗、颜色、字号和右对齐，不污染通用编辑器类型。
- 已新增 `src/lib/medical-record/MedicalRichRecordEditor.tsx`。
  - 用 `value/onChange/onSave/readonly/toolbarConfig` 接入 `RichCanvasWordRecord`。
  - 支持“编辑病历 / 归档预览”切换。
  - 支持“同步体征”，从当前体温单记录重新生成业务文档。
  - 使用 `autoSave={false}`，保存由业务层 `onSave` 接管。
  - 编辑模式和归档预览使用不同工具栏配置。
- 已新增 `/medical-record-rich` 富文本电子病历路由，并在顶部导航中展示为“电子病历 V1”。
- `/word-basic` 保留原 v0 纯文本 Canvas Word。
- 旧 `/medical-record` 路径已重定向到 `/word-basic`，避免路径语义继续误导。
- `/word-basic` 顶部导航名称为“基础版 V0”，并位于“富文本 V1”右侧。
- `/rich-canvas-word` 仍保留为通用组件 demo。

验收：

- `/word-basic` 可打开原 v0 纯文本病历文档。
- `/medical-record-rich` 可打开富文本电子病历业务包装层。
- 页面显示患者姓名、科室、床号、诊断和生命体征摘要。
- 编辑模式可编辑文档。
- 归档预览禁用编辑并保留打印/PDF/复制/缩放。
- 点击“同步体征”可按当前体温单记录重新生成文档。
- `pnpm run build` 通过。
- 浏览器打开 `/medical-record-rich` 后，富文本电子病历、患者信息、归档预览、同步体征、打印预览和导出 PDF 均正常显示，控制台无 error。
- 点击“归档预览”后进入只读预览状态。
- 顶部导航顺序为“病历概览 / 体温单 / 电子病历 V1 / 富文本 V1 / 基础版 V0”。
- 访问旧 `/medical-record` 会跳转到 `/word-basic`。

### 阶段 11.2：EMR 业务工具栏与模板插入

目标：

- 让富文本电子病历不只是展示由业务数据生成的文档，还能执行常见 EMR 编辑动作。
- 业务按钮、病历模板、患者字段和医疗短语仍放在 `medical-record` 层，不进入通用 `rich-canvas-word` 内核。
- 先用现有 `RichCanvasWordRecord` 公共 API 能承载的方式推进；若需要插入命令 API，再小步扩展公共入口。

建议功能范围：

- 在 `MedicalRichRecordEditor` 上方增加业务工具栏或侧栏。
- 插入患者字段：
  - 姓名、性别、年龄、科室、床号、住院号、入院日期、诊断。
- 插入当前日期和签名占位。
- 插入病历段落模板：
  - 主诉。
  - 现病史。
  - 体格检查。
  - 诊疗计划。
  - 病程记录。
- 插入常用短语：
  - 生命体征平稳。
  - 未诉明显不适。
  - 遵医嘱继续观察。
- 增加同步体征的确认或差异提示，避免直接覆盖医生已编辑正文。

实现建议：

- 新增 `src/lib/medical-record/medicalRecordTemplates.ts`：
  - 管理模板 block/run 片段。
  - 管理患者字段和常用短语定义。
- 新增 `src/lib/medical-record/MedicalRecordBusinessToolbar.tsx`：
  - 只负责业务按钮和菜单。
  - 不直接操作 Canvas。
- 评估并扩展 `RichCanvasWordRecord` 公共 API：
  - 优先考虑 `editorRef` 或命令回调这类受控命令入口。
  - 初期也可以由业务层直接更新 `value`，但要明确是否需要保留 undo/redo 语义。
- `rich-canvas-word` 内部如需新增插入片段能力，应放在 editing 模块，并从公共入口只导出必要类型或命令。

验收：

- `/medical-record-rich` 可插入患者字段和常用短语。
- 插入内容保留基础样式，并进入文档保存状态。
- 编辑模式可用，归档预览模式禁用业务插入。
- 同步体征不会静默覆盖用户已编辑内容。
- `pnpm run build` 通过。

### 阶段 12：导出与归档增强

目标：

- 补齐病历归档链路，让 V1 从编辑演示更接近可交付文档。

候选方向：

- DOCX 导出：
  - 将 `RichTextDocument` 映射到标题、段落、run 样式和对齐。
  - 优先支持纯文本、加粗、下划线、字号、颜色、段落对齐。
  - 表格、图片、页眉页脚先不纳入第一版。
- 可选择文本 PDF：
  - 当前 PDF 是 Canvas 位图，版式稳定但文本不可选。
  - 若需要可选择文本，考虑后端 PDF 渲染或专门版式引擎。
- 归档元数据：
  - 保存时间、归档人、文档版本号。
  - 归档预览默认工具栏只保留复制、打印、PDF 和缩放。

推荐顺序：

1. 先做 DOCX 导出最小版。
2. 再评估是否需要可选择文本 PDF。
3. 最后补归档元数据和版本展示。

## 开发原则

- 优先保持 `RichTextDocument` 的数据模型稳定。
- 新功能优先通过独立模块实现，不把大型逻辑重新堆回组件。
- 涉及编辑语义的功能需要同时验证：
  - document 更新。
  - layout 映射。
  - cursor/selection。
  - undo/redo。
  - copy/paste。
- 每个阶段完成后至少运行：

```bash
pnpm run build
```

涉及重构时额外运行：

```bash
pnpm exec tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters false
```
