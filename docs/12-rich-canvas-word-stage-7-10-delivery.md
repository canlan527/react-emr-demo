# Rich Canvas Word 阶段 7-10 交付记录

本文记录本轮 `rich-canvas-word` 从只读预览到业务组件封装的交付内容、关键文件、踩坑记录和验收结果。它用于接手时快速了解这批改动的真实边界。

## 交付范围

本轮完成了四条主线：

- 阶段 7：只读预览模式。
- 阶段 8：查找与替换。
- 阶段 9：JSON/TXT 导出、打印预览、PDF 下载。
- 阶段 10：业务组件 API 封装。

本轮没有开始 DOCX 导出，也没有把 `medical-record` v0 页面切到 `rich-canvas-word`。这两个方向应作为后续独立阶段推进。

## 阶段 7：只读预览模式

目标是让 `RichCanvasWordRecord` 可以用于审阅、归档和打印前预览场景。

已完成：

- `RichCanvasWordRecord` 支持 `readonly`。
- `/rich-canvas-word` demo 页增加“编辑模式 / 只读预览”切换。
- 只读模式隐藏编辑光标，禁用输入、删除、回车、粘贴、剪切、撤销、重做和格式修改。
- 只读模式保留文本选择、复制、方向键移动、Shift 选区、Cmd/Ctrl+A、Cmd/Ctrl+C 和缩放。
- 工具栏新增 `Copy`，只读下仅保留复制、导出、打印和缩放等安全命令。

关键文件：

- `src/components/NursingWorkspace.tsx`
- `src/lib/rich-canvas-word/RichCanvasWordRecord.tsx`
- `src/lib/rich-canvas-word/components/RichCanvasWordSurface.tsx`
- `src/lib/rich-canvas-word/hooks/useRichCanvasKeyboardHandlers.ts`
- `src/lib/rich-canvas-word/hooks/useRichCanvasCompositionHandlers.ts`
- `src/lib/rich-canvas-word/hooks/useRichCanvasFormatCommands.ts`

## 阶段 8：查找与替换

目标是验证 `document -> layout -> selection -> command` 链路，并补齐文档编辑器高频能力。

已完成：

- 新增普通文本查找。
- 支持同一个 block 内跨 run 匹配。
- 支持匹配高亮、当前匹配高亮、上一个/下一个跳转。
- 支持替换当前项和全部替换。
- 替换操作进入 undo/redo history，并触发未保存状态。
- 查找在编辑和只读模式下都可用，替换仅编辑模式可用。

关键文件：

- `src/lib/rich-canvas-word/editing/richTextSearch.ts`
- `src/lib/rich-canvas-word/layout/richTextRenderer.ts`
- `src/lib/rich-canvas-word/hooks/useRichCanvasWordEditor.ts`
- `src/lib/rich-canvas-word/RichCanvasWordRecord.tsx`

当前限制：

- 暂不支持跨 block 匹配。

## 阶段 9：导出、打印和 PDF

目标是让文档可以从编辑器流转出去，并保证打印/PDF 与 Canvas 真实分页一致。

已完成：

- 新增 JSON 导出。
- 新增纯文本 TXT 导出。
- 新增浏览器打印预览。
- 新增直接下载 PDF。
- 打印和 PDF 都复用 Canvas 分页快照，避免 HTML 重新排版导致页数不一致。

关键文件：

- `src/lib/rich-canvas-word/document/richTextSerialization.ts`
- `src/lib/rich-canvas-word/layout/richTextPrintPages.ts`
- `src/lib/rich-canvas-word/document/richTextPdfExport.ts`
- `src/lib/rich-canvas-word/hooks/useRichCanvasWordEditor.ts`
- `src/lib/rich-canvas-word/toolbar/toolbarConfig.ts`

### 打印/PDF 最终方案

最终稳定方案是：

- `renderRichTextDocumentPrintPages(document)` 使用现有 Canvas renderer 渲染整篇文档。
- 按 `pageHeight + pageGap` 裁切成 A4 页图。
- “打印预览”创建离屏 iframe，iframe 中只写入页图，然后调用浏览器 `print()`。
- “导出 PDF”直接用同一组页图生成 PDF Blob 并触发下载。

这个方案的重点是以 Canvas 真实排版为准，而不是再写一套 HTML 正文流排版。

### 打印/PDF 踩坑记录

问题一：内容看似 1 页，Chrome 打印显示 2 页。

- 原因：曾通过打印 CSS 隐藏应用壳，但隐藏 DOM 仍参与布局。
- 处理：打印改成离屏 iframe，应用壳不进入打印布局。

问题二：打印预览带背景阴影和边框。

- 原因：曾把页面内预览卡片作为打印内容，屏幕样式污染打印结果。
- 处理：移除页面内打印预览组件，打印内容只保留 iframe 页图。

问题三：iframe 打印空白。

- 原因：页图未加载或解码完成就调用 `print()`，且过早移除 iframe。
- 处理：打印前等待 iframe load 和所有图片 load/decode；不定时移除当前 iframe，下一次打印前再清理旧 iframe。

问题四：真实 Canvas 两页，HTML 打印变一页。

- 原因：HTML 正文流重新排版，没有保留 Canvas 中间空白、分页和行高。
- 处理：打印和 PDF 统一以 Canvas 分页快照为准。

当前限制：

- PDF 是位图输出，文本不可选择。
- 后续若需要可选择文本 PDF，应考虑后端 PDF 渲染或专门版式引擎。

## 阶段 10：业务组件封装

目标是让 `rich-canvas-word` 从 demo 模块变成 EMR 页面可嵌入的通用业务组件。

### 10.1：最小外部 API

已完成：

- `RichCanvasWordRecordProps` 已导出。
- 支持 `defaultValue?: RichTextDocument`。
- 支持 `onChange?: (document: RichTextDocument) => void`。
- 外部传 `defaultValue` 时不读取 localStorage 草稿。
- 不传参数时保留 demo 原行为。

### 10.2：保存入口

已完成：

- 支持 `autoSave?: boolean`。
- 支持 `onSave?: (document: RichTextDocument) => Promise<void> | void`。
- 不传 `onSave` 时继续保存 localStorage 草稿。
- 传 `onSave` 时手动保存和自动保存都调用外部保存函数。
- 保存请求按最新一次结果更新 UI，避免自动保存和手动保存重叠时旧请求覆盖新状态。

### 10.3：受控文档值

已完成：

- 支持 `value?: RichTextDocument`。
- 外部传 `value` 时不读取 localStorage 草稿。
- 外部 `value` 内容变化会同步到画布。
- 外部同步不会反向触发 `onChange`。
- 用户编辑仍会触发 `onChange`。
- 同步外部文档时会清理 selection、active marks、当前搜索位置，并重置 history。

当前约束：

- 当前是小步“实用受控”模式：内部会先乐观更新画布，再等待父组件通过 `value` 回传确认。
- 若未来需要严格受控模式，应单独改造 command/history 写入路径。

### 10.4：工具栏配置

已完成：

- 支持 `toolbarConfig?: ToolbarCommand[]`。
- 不传配置时使用完整默认工具栏。
- 传入配置时按命令集合筛选按钮。
- 自动清理开头、结尾和连续分隔线。
- 按钮 label、active、disabled、颜色和缩放显示仍由内部统一推导。

示例：

```tsx
<RichCanvasWordRecord
  toolbarConfig={['save', 'printPreview', 'exportPdf', 'copy', 'zoom']}
/>
```

### 10.5：公共导出入口

已完成：

- 新增 `src/lib/rich-canvas-word/index.ts`。
- 从公共入口导出组件和业务接入需要的公共类型。
- `/rich-canvas-word` demo 已改为从公共入口导入。
- 暂不导出内部 hooks、layout、editing 模块。

公共入口示例：

```ts
import {
  RichCanvasWordRecord,
  type RichCanvasWordRecordProps,
  type RichTextDocument,
  type ToolbarCommand,
} from '../lib/rich-canvas-word';
```

## 当前公共 API

`RichCanvasWordRecordProps` 当前包含：

```ts
type RichCanvasWordRecordProps = {
  autoSave?: boolean;
  defaultValue?: RichTextDocument;
  onChange?: (document: RichTextDocument) => void;
  onSave?: (document: RichTextDocument) => Promise<void> | void;
  readonly?: boolean;
  toolbarConfig?: ToolbarCommand[];
  value?: RichTextDocument;
};
```

推荐接入方式：

- demo 或本地草稿场景：不传 `value/defaultValue/onSave`，使用默认 localStorage 行为。
- 业务非受控场景：传 `defaultValue`、`onChange`、`onSave`。
- 业务受控场景：传 `value`、`onChange`、`onSave`。
- 审阅/归档场景：传 `readonly`，并用 `toolbarConfig` 裁剪按钮。

## 验收结果

本轮多次执行：

```bash
pnpm run build
```

最终结果通过。

浏览器检查：

- `/rich-canvas-word` 可正常刷新。
- 标题正常显示。
- 编辑/只读入口正常显示。
- 打印预览入口正常显示。
- 导出 PDF 入口正常显示。
- 控制台无 error。

## 后续建议

建议下一阶段从以下方向选一个独立推进：

- 做真实 EMR 业务包装层，把 `medical-record` 的结构化数据转换为 `RichTextDocument`。
- 做 DOCX 导出。
- 做可选择文本的后端 PDF 渲染方案。
- 做 `placeholder` 和空文档体验。
- 做跨 block 查找匹配。
