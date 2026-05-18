# 技术架构

## 技术栈

- Vite
- React 19
- TypeScript
- D3
- SCSS
- Tailwind CSS
- 原生 Canvas 2D API
- pnpm

## 主要依赖边界

当前已引入：

- React Router

目前未引入：

- Ant Design
- Fabric.js
- Pretext

### 原因

页面已使用 React Router 维护 `/overview`、`/temperature`、`/medical-record-rich`、`/rich-canvas-word` 和 `/word-basic` 等路由。

Canvas Word 编辑器当前主要是文本排版、输入、光标、选区、剪贴板和分页，不需要 Fabric.js 的对象画布能力。Fabric.js 更适合图形对象拖拽、图片、签名、标注等功能。

复制提示只需简单 toast，不需要引入完整 Ant Design。

## 文件职责

### 应用入口

- `src/main.tsx`
  - React 挂载入口。
- `src/App.tsx`
  - 页面路由。
  - React Router 路由表。
  - 病历头展示。
  - 主工作区两栏布局。
  - 体温单表单状态。
  - 各页面模块组装。

### 页面布局

- 顶部 `top-strip` 保留项目标题、医院图片和路由导航。
- 顶部下方使用 `workspace-layout` 组织主工作区：
  - 左侧为紧凑竖排病历头 `patient-card`，在桌面端 sticky 固定在视口内。
  - 右侧为 `workspace-content`，承载病历概览、体温单、富文本电子病历 V1、通用 `rich-canvas-word` 或 v0 基础版。
- 这样病历头不再占据主内容流的一整行，电子病历和富文本编辑器可以整体上移，首屏展示更多正文内容。
- 小屏幕下两栏布局会自然回退为上下布局，避免移动端内容被横向挤压。

### 体温单

- `src/data/vitals.ts`
  - 患者信息。
  - 生命体征数据类型。
  - 示例数据生成。
  - 时间槽。
- `src/components/TemperatureChart.tsx`
  - D3 SVG 图表绘制。
  - Tooltip。
  - 体温、脉搏、血压可视化。

### 电子病历 Canvas Word

- `src/lib/medical-record/medicalRecordDocument.ts`
  - 电子病历文档模型。
  - 示例病历数据。
  - 文档转纯文本。
- `src/lib/medical-record/richMedicalRecordDocument.ts`
  - 将患者信息和生命体征记录转换为 `RichTextDocument`。
  - 生成富文本电子病历业务文档。
- `src/lib/medical-record/MedicalRichRecordEditor.tsx`
  - 富文本电子病历业务包装层。
  - 接入 `RichCanvasWordRecord` 的受控文档、保存入口、只读模式和工具栏配置。
- `src/lib/canvas-word-basic/CanvasWordRecord.tsx`
  - React 组件。
  - Canvas 渲染协调。
  - 键盘事件。
  - IME 输入代理。
  - 鼠标拖拽选区。
  - 右键菜单。
  - 剪贴板操作。
  - Toast。
- `src/lib/canvas-word-basic/layout/canvasTextLayout.ts`
  - 文本排版。
  - 自动换行。
  - 标点避头规则。
  - 行高和分页。
  - 光标命中和字符测量。
- `src/lib/canvas-word-basic/editing/textSelection.ts`
  - 选区归一化。
  - 选区矩形生成。
- `src/lib/canvas-word-basic/editing/textEditing.ts`
  - 纯文本插入、删除、替换。
- `src/lib/canvas-word-basic/components/CanvasWordSurface.tsx`
  - 编辑器外壳、隐藏 textarea、canvas、右键菜单和 toast 展示。
- `src/lib/canvas-word-basic/hooks/useCanvasWordEditor.ts`
  - 文本、光标、选区、历史和编辑命令。

### 样式

- `src/styles/index.scss`
  - 全局样式。
  - 页面布局。
  - 图表样式。
  - 电子病历编辑器样式。
  - 右键菜单。
  - Toast。

## 架构原则

### 高内聚

排版算法集中在 `layout/canvasTextLayout.ts`。

文本编辑集中在 `editing/textEditing.ts`。

选区逻辑集中在 `editing/textSelection.ts`。

React 组件和 hooks 负责事件协调和状态管理。

### 低耦合

体温单和电子病历互不依赖。

电子病历文档模型和 Canvas 组件分离。

Canvas 排版和 React 生命周期分离。

### 后续方向

Canvas Word 基础版已按能力继续拆为：

- `useCanvasWordEditor`
- `useCanvasWordKeyboard`
- `useCanvasWordMouseSelection`
- `useImeAnchor`
- `layout/canvasWordRenderer`
- `editing/wordClipboard`
- `editing/wordHistory`

这样可以降低 `CanvasWordRecord.tsx` 的复杂度。

富文本 V1 已形成独立的 `rich-canvas-word` 公共入口，后续业务能力应继续放在 `medical-record` 包装层中，避免把患者字段、病历模板、质控等医疗语义反向放入通用编辑器内核。
