# 产品需求计划

## 目标

构建一个住院患者护理记录 Web 演示项目，包含体温单、病历头、电子病历查看与基础编辑能力。

## 路由需求

项目当前已使用 React Router 组织页面路由。

已规划路由：

- `/temperature`
  - 体温单页面。
  - 默认主工作页面。
- `/overview`
  - 病历概览页面。
- `/medical-record-rich`
  - 富文本电子病历 V1 页面。
  - 内含 `MedicalRichRecordEditor`，把患者和生命体征业务数据转换为 `RichTextDocument`。
- `/rich-canvas-word`
  - 通用富文本 Canvas Word V1 demo 页面。
- `/word-basic`
  - 基础版 V0 纯文本 Canvas Word 页面。
- `/medical-record`
  - 历史兼容路径，当前重定向到 `/word-basic`。

## 病历头需求

病历头包含标准字段：

- 姓名
- 科室
- 床号
- 住院号
- 性别
- 年龄
- 入院日期
- 诊断
- 过敏史
- 护理级别

当前病历头数据位于 `src/data/vitals.ts` 的 `patientInfo`。

## 体温单需求

### 图表内容

- 横轴：
  - 10 天。
  - 每天 6 个时间点：02、06、10、14、18、22 时。
- 纵轴左：
  - 体温 35~42°C。
  - 背景色区分偏低、正常、低热、高热区域。
- 纵轴右：
  - 脉搏 40~180 次/分。
  - 脉搏使用虚线折线图。
- 血压：
  - 以蓝色矩形条展示收缩压/舒张压区间。
- 参考线：
  - 37°C 红色虚线。

### 体温测量方式

- 口腔：红色圆点。
- 腋下：蓝色方块。
- 直肠：绿色三角形。

### 交互

- 鼠标悬停显示 tooltip。
- 表单录入新记录：
  - 日期
  - 时间
  - 体温
  - 测量方式
  - 脉搏
  - 收缩压
  - 舒张压
- 同一日期和时间槽重复录入时自动覆盖。
- 一键重置示例数据。
- 示例数据包含模拟发热演变过程。

## 电子病历需求

### 文档模型

基础版 V0 的初期文档模型和数据结构在 `src/lib/medical-record/medicalRecordDocument.ts` 中实现：

- `MedicalRecordDocument`
- `MedicalRecordBlock`
- 标题块
- 段落块
- 字段组块

### Canvas Word 基础功能

已要求和部分实现：

- 文本绘制。
- 自动换行。
- 行高计算。
- 字符宽度测量：`ctx.measureText`。
- 单行输入。
- 多行换行。
- 光标移动：
  - 左
  - 右
  - 上
  - 下
- Backspace 删除。
- Delete 删除。
- 点击定位光标。
- 滚动。
- 分页。
- 加载病历文档。
- 中文输入法 IME 支持。
- 输入法候选框跟随光标。
- 鼠标拖拽选区。
- 右键菜单：
  - 撤销
  - 重做
  - 复制
  - 剪切
  - 粘贴
  - 删除
- 常用快捷键：
  - Ctrl/Cmd+A
  - Ctrl/Cmd+Z
  - Ctrl/Cmd+Shift+Z
  - Ctrl+Y
  - Ctrl/Cmd+C
  - Ctrl/Cmd+X
  - Ctrl/Cmd+V
  - Ctrl/Cmd+左箭头
  - Ctrl/Cmd+右箭头
  - Ctrl/Cmd+上箭头
  - Ctrl/Cmd+下箭头
  - Backspace
  - Delete
  - Escape

### 富文本电子病历 V1

当前富文本业务包装层在 `src/lib/medical-record/MedicalRichRecordEditor.tsx` 中实现：

- 将 `patientInfo` 和体温单 `VitalRecord[]` 转换为 `RichTextDocument`。
- 生成住院电子病历标题、患者字段、主诉、现病史、生命体征摘要、体格检查、诊疗计划、病程记录和签名。
- 支持编辑病历和归档预览两种模式。
- 支持同步体征，将当前体温单记录重新生成进业务文档。
- 使用 `RichCanvasWordRecord` 的 `value/onChange/onSave/readonly/toolbarConfig` 接入通用富文本编辑器。

## UI 反馈需求

- 复制成功后，在文档上方显示“已复制”提示。
- 当前使用本地轻量 toast，没有引入 Ant Design。
- Toast 定位以电子病历编辑器区域为中心，不使用整个浏览器窗口中心。

## 注意事项

Canvas 选区高亮曾出现宽度偏差，根因是测量字体和实际绘制字体不一致。当前已改为每行记录真实字体，并在测量、绘制、光标和选区中统一使用。
