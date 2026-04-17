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
- [07-rich-text-toolbar-plan.md](./07-rich-text-toolbar-plan.md)
  - 记录电子病历富文本工具栏范围、模型升级、交互规则、一期/二期边界。

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
- 富文本工具栏目前仅完成需求和架构计划，尚未实现 UI 和富文本模型。
- 项目包管理器已切换为 pnpm。

## 接手建议

后续 AI 或开发者开始工作前，建议按以下顺序阅读：

1. 先读本文件。
2. 再读 [01-product-requirements.md](./01-product-requirements.md)。
3. 若要改架构，读 [02-technical-architecture.md](./02-technical-architecture.md)。
4. 若要继续修 Canvas 编辑器，重点读 [05-canvas-editor-architecture.md](./05-canvas-editor-architecture.md) 和 [06-known-issues-and-next-steps.md](./06-known-issues-and-next-steps.md)。
5. 若要做富文本工具栏，先读 [07-rich-text-toolbar-plan.md](./07-rich-text-toolbar-plan.md)。
