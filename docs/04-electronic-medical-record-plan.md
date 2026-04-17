# 电子病历模块计划

## 模块目标

在 `/medical-record` 路由中提供一个简易 Web 版 Word 电子病历查看和编辑体验。

## 当前路由

`/medical-record`

在 `src/App.tsx` 中渲染：

```tsx
<CanvasWordRecord patient={patientInfo} />
```

## 文档模型

文件：`src/lib/medicalRecordDocument.ts`

核心类型：

- `MedicalRecordDocument`
- `MedicalRecordBlock`

支持块类型：

- `heading`
- `paragraph`
- `fieldGroup`

当前通过 `documentToPlainText()` 将结构化文档转换为纯文本流，再交给 Canvas 编辑器排版。

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

- 恢复结构化 block 模型，而不是只编辑纯文本。
- 增加标题、段落、字段组的独立样式。
- 表格。
- 页眉页脚。
- 打印和 PDF 导出。
- 查找替换。
- 选区修复和多段选区。
- 富文本样式：
  - 加粗
  - 下划线
  - 字号
  - 颜色
- 图片/签名插入。
