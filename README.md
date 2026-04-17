# React EMR Demo

住院患者电子病历与体温单演示项目。

项目包含体温单趋势图、病历头信息、Canvas 绘制的简易 Web Word 电子病历编辑器，并已沉淀富文本工具栏的后续规划。

## 功能概览

- 体温单图表：
  - 10 天、每天 6 个时间点。
  - 体温、脉搏、血压展示。
  - 体温测量方式区分。
  - tooltip、表单录入、重复时间槽覆盖、重置示例数据。
- 电子病历：
  - `/medical-record` 路由。
  - 病历头标准字段。
  - Canvas 文本绘制、自动换行、分页。
  - 中文输入法输入。
  - 光标移动、点击定位、滚动。
  - 鼠标选区、复制、剪切、粘贴、删除。
  - 撤销、重做。
  - 右键菜单和复制提示。
- 文档规划：
  - 已规划富文本工具栏、富文本文档模型和后续分期边界。

## 技术栈

- React
- TypeScript
- Vite
- D3
- Canvas 2D
- Sass
- Tailwind CSS
- pnpm

## 本地运行

```bash
pnpm install
pnpm run dev
```

构建：

```bash
pnpm run build
```

预览构建结果：

```bash
pnpm run preview
```

## 主要路由

- `/overview`：患者概览。
- `/temperature`：体温单。
- `/medical-record`：电子病历。

## 项目文档

开发计划、架构说明、已知问题和富文本工具栏规划见 [docs/README.md](./docs/README.md)。

建议接手前先阅读：

- [产品需求](./docs/01-product-requirements.md)
- [技术架构](./docs/02-technical-architecture.md)
- [Canvas 编辑器架构](./docs/05-canvas-editor-architecture.md)
- [富文本工具栏计划](./docs/07-rich-text-toolbar-plan.md)
