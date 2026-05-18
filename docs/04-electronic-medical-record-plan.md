# 电子病历模块计划

## 模块目标

提供基础版 V0 和富文本 V1 两条电子病历编辑体验：

- `/word-basic`：保留简易 Web 版 Word 电子病历查看和编辑体验。
- `/medical-record-rich`：提供基于 `rich-canvas-word` 的富文本电子病历 V1。
- `/medical-record`：历史兼容路径，当前重定向到 `/word-basic`。

## 当前路由

`/word-basic`

在 `src/App.tsx` 中渲染：

```tsx
<CanvasWordRecord patient={patientInfo} />
```

`/medical-record-rich`

在 `src/App.tsx` 中渲染：

```tsx
<MedicalRichRecordEditor patient={patientInfo} records={records} />
```

## 文档模型

文件：`src/lib/medical-record/medicalRecordDocument.ts`

核心类型：

- `MedicalRecordDocument`
- `MedicalRecordBlock`

支持块类型：

- `heading`
- `paragraph`
- `fieldGroup`

基础版 V0 通过 `documentToPlainText()` 将结构化文档转换为纯文本流，再交给 Canvas 编辑器排版。

富文本 V1 通过 `src/lib/medical-record/richMedicalRecordDocument.ts` 将患者信息和体温单记录转换为 `RichTextDocument`，再交给 `RichCanvasWordRecord` 渲染和编辑。

## 当前病历内容

示例病历包含：

- 住院电子病历标题。
- 患者基本信息。
- 主诉。
- 现病史。
- 既往史。
- 体格检查。
- 初步诊疗计划。
- 病程记录。
- 医师和护士签名。

## Canvas Word 基础能力

当前已实现：

- A4 页面尺寸。
- 多页显示。
- 页面阴影和页码。
- 文本绘制。
- 自动换行。
- 行高计算。
- 点击定位光标。
- 键盘输入。
- 中文 IME 输入。
- IME 候选框跟随光标。
- Enter 换行。
- Backspace/Delete。
- 方向键移动。
- 滚动。
- 加载病历文档。
- 复制、剪切、粘贴、删除。
- 右键菜单。
- 撤销/重做。
- 复制成功 Toast。

## 富文本电子病历 V1 当前能力

当前已实现：

- 业务包装层 `MedicalRichRecordEditor`。
- 患者信息、诊断、科室、床号等字段进入富文本文档。
- 生命体征摘要可由当前体温单记录生成。
- 编辑病历 / 归档预览模式切换。
- 同步体征。
- 业务保存入口。
- 归档预览下保留复制、缩放、打印预览和 PDF 导出。
- 编辑模式下保留保存、导出、撤销重做和基础格式命令。

## 为什么暂不引入 Fabric.js

当前核心是文本流编辑器，不是图形对象编辑器。

Fabric.js 的优势在：

- 图形对象拖拽。
- 图片。
- 标注。
- 签名。
- 形状。

当前阶段用原生 Canvas 2D 更直接，依赖更少。

## 后续可选增强

- 为富文本电子病历增加业务工具栏：
  - 插入患者字段。
  - 插入当前日期。
  - 插入病历结构模板。
  - 插入常用病历短语。
  - 插入医疗符号和单位。
- 增加结构化字段绑定和保存协议。
- 增加病历质控提示。
- DOCX 导出。
- 可选择文本 PDF。
- placeholder 和空文档体验。
- 跨 block 查找匹配。
- 表格。
- 页眉页脚。
- 图片/签名插入。
