import type { PatientInfo, VitalRecord } from '../../data/vitals';
import type { RichTextAlign, RichTextDocument, RichTextMarks, RichTextRun, RichTextTextBlock, RichTextTextBlockType } from '../rich-canvas-word';

type RunInput = {
  text: string;
  marks?: RichTextMarks;
};

const ink = '#1f2937';
const muted = '#64748b';
const primary = '#166173';
const danger = '#dc2626';

function run(id: string, text: string, marks: RichTextMarks = {}): RichTextRun {
  return { id, text, marks };
}

function block(id: string, type: RichTextTextBlockType, runs: RunInput[], align: RichTextAlign = 'left'): RichTextTextBlock {
  return {
    id,
    type,
    align,
    runs: runs.map((item, index) => run(`${id}-run-${index + 1}`, item.text, item.marks)),
  };
}

function fieldRuns(fields: Array<{ label: string; value: string }>): RunInput[] {
  return fields.flatMap((field, index) => [
    { text: `${field.label}：`, marks: { bold: true, color: ink } },
    { text: field.value, marks: { color: index === fields.length - 1 ? danger : primary } },
    { text: index === fields.length - 1 ? '' : '    ' },
  ]);
}

function formatVitalSummary(records: VitalRecord[]) {
  const validTemperatures = records.filter((item) => item.temperature !== null);
  const latest = records[records.length - 1];
  const highest = validTemperatures.reduce<VitalRecord | null>(
    (max, item) => (!max || (item.temperature ?? 0) > (max.temperature ?? 0) ? item : max),
    null,
  );
  const feverCount = validTemperatures.filter((item) => (item.temperature ?? 0) >= 37.3).length;

  return {
    latest,
    highestTemperature: highest?.temperature ?? null,
    latestTemperature: latest?.temperature ?? null,
    latestPulse: latest?.pulse ?? null,
    latestBloodPressure: latest?.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}mmHg` : '未记录',
    feverCount,
  };
}

export function createRichMedicalRecordDocument(patient: PatientInfo, records: VitalRecord[]): RichTextDocument {
  const summary = formatVitalSummary(records);
  const latestDate = summary.latest?.date ?? patient.admissionDate;
  const latestTime = summary.latest?.time ?? '08:00';

  return {
    id: `rich-emr-${patient.inpatientNo}`,
    title: `${patient.name} 住院电子病历`,
    blocks: [
      block('emr-title', 'heading', [{ text: '住院电子病历', marks: { bold: true, fontSize: 26 } }], 'center'),
      block(
        'emr-subtitle',
        'paragraph',
        [{ text: `${patient.department} · ${patient.bedNo} · ${patient.inpatientNo}`, marks: { fontSize: 14, color: muted } }],
        'center',
      ),
      block(
        'emr-fields-1',
        'paragraph',
        fieldRuns([
          { label: '姓名', value: patient.name },
          { label: '性别', value: patient.gender },
          { label: '年龄', value: patient.age },
          { label: '科室', value: patient.department },
        ]),
      ),
      block(
        'emr-fields-2',
        'paragraph',
        fieldRuns([
          { label: '床号', value: patient.bedNo },
          { label: '住院号', value: patient.inpatientNo },
          { label: '入院日期', value: patient.admissionDate },
          { label: '诊断', value: patient.diagnosis },
        ]),
      ),
      block('emr-chief-title', 'heading', [{ text: '主诉', marks: { bold: true, fontSize: 20 } }]),
      block('emr-chief', 'paragraph', [{ text: '发热、咳嗽伴胸闷3天，术后恢复期需继续观察生命体征变化。' }]),
      block('emr-history-title', 'heading', [{ text: '现病史', marks: { bold: true, fontSize: 20 } }]),
      block('emr-history', 'paragraph', [
        {
          text:
            '患者3天前无明显诱因出现发热，伴咳嗽、少量白痰及活动后胸闷。入院后予抗感染、补液、雾化及物理降温处理，',
        },
        { text: '体温逐步下降，脉搏随发热期升高后恢复平稳。', marks: { bold: true, color: primary } },
      ]),
      block('emr-vital-title', 'heading', [{ text: '生命体征摘要', marks: { bold: true, fontSize: 20 } }]),
      block('emr-vital-summary', 'paragraph', [
        { text: `最近记录 ${latestDate} ${latestTime}：`, marks: { bold: true } },
        { text: `体温 ${summary.latestTemperature ?? '未记录'}°C，` },
        { text: `脉搏 ${summary.latestPulse ?? '未记录'}次/分，` },
        { text: `血压 ${summary.latestBloodPressure}。` },
        { text: `住院期间最高体温 ${summary.highestTemperature ?? '未记录'}°C，发热记录 ${summary.feverCount} 次。`, marks: { color: danger } },
      ]),
      block('emr-physical-title', 'heading', [{ text: '体格检查', marks: { bold: true, fontSize: 20 } }]),
      block('emr-physical', 'paragraph', [
        {
          text:
            '神志清楚，精神尚可。双肺呼吸音稍粗，可闻及散在湿啰音。心率齐，腹软，无压痛及反跳痛。切口敷料清洁干燥，局部无明显渗血渗液。',
        },
      ]),
      block('emr-plan-title', 'heading', [{ text: '诊疗计划', marks: { bold: true, fontSize: 20 } }]),
      block('emr-plan', 'paragraph', [
        {
          text:
            '继续监测体温、脉搏、血压变化；完善血常规、CRP、胸部影像复查；根据培养结果调整抗感染方案；加强翻身拍背、呼吸功能训练和疼痛评估。',
        },
      ]),
      block('emr-progress-title', 'heading', [{ text: '病程记录', marks: { bold: true, fontSize: 20 } }]),
      block('emr-progress', 'paragraph', [
        { text: `${latestDate} ${latestTime}：`, marks: { bold: true } },
        {
          text:
            '患者夜间睡眠可，晨测生命体征较平稳，诉咳嗽较前减轻，无明显胸闷。继续当前治疗并观察体温曲线。',
        },
      ]),
      block(
        'emr-signature',
        'paragraph',
        [{ text: '医师签名：周明        记录护士：陈禾        记录日期：2026-04-17', marks: { fontSize: 14, color: muted } }],
        'right',
      ),
    ],
  };
}
