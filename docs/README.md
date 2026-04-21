# 项目文档索引

本目录用于沉淀当前项目的产品需求、技术架构、模块设计、实现计划和遗留问题，方便后续开发者或 AI 继续接手。

## 文档结构

- [01-product-requirements.md](./01-product-requirements.md)
  - 记录体温单、病历头、电子病历、Canvas Word 编辑器等产品功能需求。
- [02-technical-architecture.md](./02-technical-architecture.md)
  - 记录 React/Vite/D3/Canvas 的技术架构、文件职责和模块边界。
- [03-temperature-chart-plan.md](./03-temperature-chart-plan.md)
  - 记录体温单图表模块的数据模型、图表要求、交互和已完成事项。
- [04-electronic-medical-record-plan.md](./04-electronic-medical-record-plan.md)
  - 记录电子病历路由、文档模型、Canvas Word 基础能力和后续演进方向。
- [05-canvas-editor-architecture.md](./05-canvas-editor-architecture.md)
  - 记录 Canvas 编辑器内部模块、排版算法、输入法代理、选区和剪贴板设计。
- [06-known-issues-and-next-steps.md](./06-known-issues-and-next-steps.md)
  - 记录当前遗留问题，尤其是选区高亮边界与光标/复制范围不一致的问题。
- [07-canvas-word-version-roadmap.md](./07-canvas-word-version-roadmap.md)
  - 记录 Canvas Word 从 v0 基础版到 rich-canvas-word v1/v2，再到 medical-record 业务包装层的版本路线、富文本模型和拆分步骤。
- [08-canvas-word-record-refactor-plan.md](./08-canvas-word-record-refactor-plan.md)
  - 记录 v0 主组件 `CanvasWordRecord.tsx` 的拆分阶段、目标文件和每阶段验收清单。
- [09-rich-canvas-word-v1-plan.md](./09-rich-canvas-word-v1-plan.md)
  - 记录 rich-canvas-word v1 的详细规划，包括 Canvas 工具栏、block + run 文档模型、目录结构、IME 代理和分阶段实现计划。
- [10-rich-canvas-word-next-plan.md](./10-rich-canvas-word-next-plan.md)
  - 记录 rich-canvas-word v1 核心链路完成后的产品化能力、文档持久化、分页滚动跟随、只读模式、查找替换和导入导出规划。
- [11-emr-rich-canvas-word-mindmap.md](./11-emr-rich-canvas-word-mindmap.md)
  - 用 Mermaid 思维导图梳理电子病历、canvas-word-basic 和 rich-canvas-word 的模块关系、数据流、编辑链路和演进边界。

## 当前项目定位

这是一个住院患者护理记录演示项目，核心包括：

- 住院患者体温单。
- 生命体征图表。
- 病历头信息展示。
- 电子病历查看和编辑。
- 原生 Canvas 绘制的简易 Web Word 编辑器。

## 当前状态

- 体温单图表、录入表单和示例数据重置已实现。
- 电子病历路由、病历头和 Canvas Word 基础编辑能力已实现。
- 中文输入、鼠标选区、右键菜单、剪贴板、撤销/重做已实现。
- `rich-canvas-word` v1 已新增临时入口 `/rich-canvas-word`。
- 富文本 v1 已实现 block + run 模型、Canvas 正文渲染、Canvas 工具栏、输入、IME、选区、撤销/重做和基础格式命令。
- 当前富文本复制、剪切、粘贴已支持当前 rich editor 内部保留格式；复制/剪切会写入 `text/html` + `text/plain`，粘贴时也会尝试读取外部 `text/html` 并还原基础格式。
- 富文本 v1 已支持工具栏固定档位页面缩放，缩放不改变文档内容。
- 富文本 v1 已支持配置化字号、文字颜色和高亮色循环切换。
- 页面主工作区已调整为左侧紧凑病历头 + 右侧内容区，电子病历和富文本编辑器首屏可展示更多正文内容。
- 富文本 v1 已支持分页输入时自动滚动到光标附近。
- 项目包管理器已切换为 pnpm。

## 接手建议

后续 AI 或开发者开始工作前，建议按以下顺序阅读：

1. 先读本文件。
2. 再读 [01-product-requirements.md](./01-product-requirements.md)。
3. 若要改架构，读 [02-technical-architecture.md](./02-technical-architecture.md)。
4. 若要继续修 Canvas 编辑器，重点读 [05-canvas-editor-architecture.md](./05-canvas-editor-architecture.md) 和 [06-known-issues-and-next-steps.md](./06-known-issues-and-next-steps.md)。
5. 若要做富文本工具栏、规划 Canvas Word 版本演进或拆分目录，读 [07-canvas-word-version-roadmap.md](./07-canvas-word-version-roadmap.md)。
6. 若要拆分 `CanvasWordRecord.tsx`，按 [08-canvas-word-record-refactor-plan.md](./08-canvas-word-record-refactor-plan.md) 分阶段推进。
7. 若要开始实现富文本 v1，读 [09-rich-canvas-word-v1-plan.md](./09-rich-canvas-word-v1-plan.md)。
8. 若要快速建立电子病历和 rich-canvas-word 的全局图景，读 [11-emr-rich-canvas-word-mindmap.md](./11-emr-rich-canvas-word-mindmap.md)。
