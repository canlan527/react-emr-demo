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

## 推荐开发顺序

1. 阶段 6.1：实现 `localStorage` 草稿保存和恢复。
2. 阶段 6.2：增加保存数据 `schemaVersion`。
3. 阶段 6.3：增加保存状态 UI。
4. 阶段 7.1：实现只读预览模式。
5. 阶段 8.1：实现查找，不急于替换。
6. 阶段 9.1：实现 JSON 和纯文本导出。
7. 阶段 10.1：整理可复用组件 API。

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
