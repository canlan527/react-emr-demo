import type { RichTextDocument } from '../richTypes';

// v1 的示例文档既是开发入口，也是排版/渲染回归样本。
// 内容刻意覆盖了标题、段落、多 run、不同字号、颜色、下划线、高亮、
// 长中文、中英文混排和无空格长 token，方便观察自动换行和 fragment 拼接。
export const sampleRichTextDocument: RichTextDocument = {
  id: 'rich-canvas-word-v1-sample',
  title: 'Rich Canvas Word 示例文档',
  blocks: [
    {
      id: 'block-title',
      type: 'heading',
      align: 'center',
      runs: [{ id: 'run-title', text: 'Rich Canvas Word 示例文档', marks: { bold: true, fontSize: 26 } }],
    },
    {
      id: 'block-summary',
      type: 'paragraph',
      align: 'left',
      runs: [
        { id: 'run-summary-1', text: '患者今日精神可，', marks: {} },
        { id: 'run-summary-2', text: '生命体征平稳', marks: { bold: true, color: '#166173' } },
        { id: 'run-summary-3', text: '，继续观察体温、脉搏和呼吸变化。', marks: {} },
      ],
    },
    {
      id: 'block-fields',
      type: 'paragraph',
      align: 'left',
      runs: [
        { id: 'run-fields-1', text: '患者姓名：', marks: { bold: true } },
        { id: 'run-fields-2', text: '张三', marks: { color: '#2563eb' } },
        { id: 'run-fields-3', text: '，诊断：', marks: { bold: true } },
        { id: 'run-fields-4', text: '肺部感染', marks: { color: '#dc2626', underline: true } },
        { id: 'run-fields-5', text: '。', marks: {} },
      ],
    },
    {
      id: 'block-mixed',
      type: 'paragraph',
      align: 'left',
      runs: [
        { id: 'run-mixed-1', text: '这一段包含 ', marks: {} },
        { id: 'run-mixed-2', text: '加粗', marks: { bold: true } },
        { id: 'run-mixed-3', text: '、', marks: {} },
        { id: 'run-mixed-4', text: '下划线', marks: { underline: true } },
        { id: 'run-mixed-5', text: '、', marks: {} },
        { id: 'run-mixed-6', text: '红色文字', marks: { color: '#dc2626' } },
        { id: 'run-mixed-7', text: '、', marks: {} },
        { id: 'run-mixed-8', text: '黄色高亮', marks: { backgroundColor: '#fef08a' } },
        { id: 'run-mixed-9', text: ' 和 ', marks: {} },
        { id: 'run-mixed-10', text: '不同字号', marks: { fontSize: 22, bold: true } },
        { id: 'run-mixed-11', text: ' 的富文本 run。', marks: {} },
      ],
    },
    {
      id: 'block-long-wrap',
      type: 'paragraph',
      align: 'left',
      runs: [
        {
          id: 'run-long-1',
          text:
            '这是一段用于验证自动换行的长文本：患者入院后精神状态较前改善，夜间睡眠尚可，仍需继续观察咳嗽、胸闷和体温变化，',
          marks: {},
        },
        {
          id: 'run-long-2',
          text: '重点记录发热高峰、用药后反应以及活动后不适。',
          marks: { color: '#166173', bold: true },
        },
        {
          id: 'run-long-3',
          text: ' mixed English words should wrap with Chinese text without moving a large old segment to the next line.',
          marks: { fontSize: 14, color: '#64748b' },
        },
      ],
    },
    {
      id: 'block-continuous-wrap',
      type: 'paragraph',
      align: 'left',
      runs: [
        {
          id: 'run-continuous-label',
          text: '连续长字符换行测试：',
          marks: { bold: true },
        },
        {
          id: 'run-continuous-cn',
          text:
            '发热咳嗽胸闷乏力夜间睡眠尚可继续观察生命体征变化记录用药后反应活动后不适体温脉搏呼吸血压变化趋势护理记录需要保持连续输入也能自然换行',
          marks: { color: '#166173' },
        },
        {
          id: 'run-continuous-en',
          text:
            'SuperLongEnglishTokenWithoutSpacesForCanvasRichTextWrappingVerificationShouldBreakByCharacterWhenNeeded',
          marks: { fontSize: 14, color: '#64748b', underline: true },
        },
      ],
    },
    {
      id: 'block-center',
      type: 'paragraph',
      align: 'center',
      runs: [{ id: 'run-center', text: '这是一行居中文本，用于验证 block 对齐。', marks: { color: '#226b4f' } }],
    },
    {
      id: 'block-right',
      type: 'paragraph',
      align: 'right',
      runs: [{ id: 'run-right', text: '右对齐示例 2026-04-18', marks: { fontSize: 14, color: '#64748b' } }],
    },
  ],
};
