import type { PatientInfo } from '../data/vitals';

export type MedicalRecordBlock =
  | {
      type: 'heading';
      text: string;
    }
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'fieldGroup';
      fields: Array<{ label: string; value: string }>;
    };

export type MedicalRecordDocument = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  blocks: MedicalRecordBlock[];
};

export const canvasWordLayout = {
  pageWidth: 794,
  pageHeight: 1123,
  pageGap: 28,
  marginX: 72,
  marginY: 76,
  font: '16px "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
  titleFont: '700 24px "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
  lineHeight: 28,
};

export function createMedicalRecordDocument(patient: PatientInfo): MedicalRecordDocument {
  return {
    id: `emr-${patient.inpatientNo}`,
    title: '住院电子病历',
    createdAt: '2026-04-08 09:20',
    updatedAt: '2026-04-17 15:30',
    blocks: [
      { type: 'heading', text: '住院电子病历' },
      {
        type: 'fieldGroup',
        fields: [
          { label: '姓名', value: patient.name },
          { label: '性别', value: patient.gender },
          { label: '年龄', value: patient.age },
          { label: '科室', value: patient.department },
          { label: '床号', value: patient.bedNo },
          { label: '住院号', value: patient.inpatientNo },
          { label: '入院日期', value: patient.admissionDate },
          { label: '诊断', value: patient.diagnosis },
        ],
      },
      {
        type: 'heading',
        text: '主诉',
      },
      {
        type: 'paragraph',
        text: '发热、咳嗽伴胸闷3天，术后恢复期需继续观察生命体征变化。',
      },
      {
        type: 'heading',
        text: '现病史',
      },
      {
        type: 'paragraph',
        text:
          '患者3天前无明显诱因出现发热，最高体温39.2°C，伴咳嗽、少量白痰及活动后胸闷。入院后予抗感染、补液、雾化及物理降温处理，体温逐步下降，脉搏随发热期升高后恢复平稳。',
      },
      {
        type: 'heading',
        text: '既往史',
      },
      {
        type: 'paragraph',
        text: `否认高血压、糖尿病长期用药史。过敏史：${patient.allergy}。`,
      },
      {
        type: 'heading',
        text: '体格检查',
      },
      {
        type: 'paragraph',
        text:
          '神志清楚，精神尚可。双肺呼吸音稍粗，可闻及散在湿啰音。心率齐，腹软，无压痛及反跳痛。切口敷料清洁干燥，局部无明显渗血渗液。',
      },
      {
        type: 'heading',
        text: '初步诊疗计划',
      },
      {
        type: 'paragraph',
        text:
          '继续监测体温、脉搏、血压变化；完善血常规、CRP、胸部影像复查；根据培养结果调整抗感染方案；加强翻身拍背、呼吸功能训练和疼痛评估。',
      },
      {
        type: 'heading',
        text: '病程记录',
      },
      {
        type: 'paragraph',
        text:
          '2026-04-17 08:30：患者夜间睡眠可，晨测体温36.8°C，脉搏80次/分，血压120/76mmHg。诉咳嗽较前减轻，无明显胸闷。继续当前治疗并观察体温曲线。',
      },
      {
        type: 'paragraph',
        text: '医师签名：周明        记录护士：陈禾',
      },
    ],
  };
}

export function documentToPlainText(document: MedicalRecordDocument) {
  return document.blocks
    .map((block) => {
      if (block.type === 'fieldGroup') {
        return block.fields.map((field) => `${field.label}：${field.value}`).join('    ');
      }

      return block.text;
    })
    .join('\n\n');
}
