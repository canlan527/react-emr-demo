# 体温单模块计划

## 模块目标

提供住院患者 10 天生命体征趋势展示和床旁录入能力。

## 数据模型

核心类型位于 `src/data/vitals.ts`：

- `VitalRecord`
- `TemperatureMethod`
- `PatientInfo`

`VitalRecord` 字段：

- `date`
- `time`
- `datetime`
- `dayLabel`
- `timeLabel`
- `temperature`
- `temperatureMethod`
- `pulse`
- `systolic`
- `diastolic`
- `event`

## 示例数据

示例数据通过 `createSampleRecords()` 生成：

- 10 天。
- 每天 6 个时间槽。
- 包含发热发展和恢复过程。
- 包含脉搏随体温升高变化。
- 包含血压区间。
- 包含少量事件标记。

## 图表实现

图表由 `src/components/TemperatureChart.tsx` 使用 D3 绘制。

### 比例尺

- X 轴：`scalePoint<Date>`。
- 左 Y 轴：体温 35~42°C。
- 右 Y 轴：脉搏/血压 40~180。

### 背景区域

当前分区：

- 偏低：35~36。
- 正常：36~37.3。
- 低热：37.3~38。
- 高热：38~42。

### 视觉编码

- 体温：
  - 折线。
  - 不同测量方式使用不同点形状。
- 脉搏：
  - 虚线折线。
  - 小圆点。
- 血压：
  - 蓝色矩形条。
  - 上端表示收缩压。
  - 下端表示舒张压。
- 37°C：
  - 红色虚线。

## 表单交互

表单位于 `src/App.tsx`。

提交时：

1. 根据日期和时间生成新记录。
2. 删除同一日期时间槽旧记录。
3. 插入新记录。
4. 按时间重新排序。

## 已完成

- 图表绘制。
- Tooltip。
- 示例数据重置。
- 重复时间槽覆盖。
- 病历头展示。

## 后续可选增强

- 数据持久化到 localStorage。
- 导出图片或 PDF。
- 打印体温单。
- 增加呼吸、疼痛评分、出入量等表格行。
- 增加异常值校验。
