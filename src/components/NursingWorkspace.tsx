import { FormEvent, useMemo, useRef, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { OverviewSummary } from './OverviewSummary';
import { TemperatureWorkspace } from './TemperatureWorkspace';
import { WorkspaceLayout } from './WorkspaceLayout';
import { CanvasWordRecord } from '../lib/canvas-word-basic/CanvasWordRecord';
import { MedicalRichRecordEditor } from '../lib/medical-record/MedicalRichRecordEditor';
import { RichCanvasWordRecord } from '../lib/rich-canvas-word';
import { createRecord, createSampleRecords, patientInfo } from '../data/vitals';
import type { VitalRecord } from '../data/vitals';
import type { VitalFormState } from './TemperatureWorkspace';
import type {
  RichCanvasWordEditorHandle,
  RichTextBlock,
  RichTextDocument,
  RichTextPosition,
  RichTextSelection,
  RichTextTableBlock,
} from '../lib/rich-canvas-word';

function recordKey(record: Pick<VitalRecord, 'date' | 'time'>) {
  return `${record.date}-${record.time}`;
}

export type NursingWorkspaceContext = {
  dates: string[];
  form: VitalFormState;
  records: VitalRecord[];
  stats: { label: string; value: string }[];
  setForm: (nextForm: VitalFormState) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  resetSamples: () => void;
};

export function NursingWorkspace() {
  const [records, setRecords] = useState<VitalRecord[]>(() => createSampleRecords());
  const dates = useMemo(() => Array.from(new Set(records.map((item) => item.date))), [records]);

  const [form, setForm] = useState<VitalFormState>(() => {
    const latestRecord = records[records.length - 1];
    return {
      date: latestRecord.date,
      time: latestRecord.time,
      temperature: String(latestRecord.temperature ?? 36.8),
      temperatureMethod: latestRecord.temperatureMethod,
      pulse: String(latestRecord.pulse ?? 80),
      systolic: String(latestRecord.systolic ?? 120),
      diastolic: String(latestRecord.diastolic ?? 76),
    };
  });

  const stats = useMemo(() => {
    const validTemps = records.filter((item) => item.temperature !== null);
    const highest = validTemps.reduce((max, item) => ((item.temperature ?? 0) > (max.temperature ?? 0) ? item : max));
    const feverCount = validTemps.filter((item) => (item.temperature ?? 0) >= 37.3).length;
    const avgPulse = Math.round(
      records.reduce((total, item) => total + (item.pulse ?? 0), 0) / records.filter((item) => item.pulse !== null).length,
    );

    return [
      { label: '记录周期', value: `${dates.length} 天` },
      { label: '时间槽', value: `${records.length} 条` },
      { label: '最高体温', value: `${highest.temperature} °C` },
      { label: '发热记录', value: `${feverCount} 次` },
      { label: '平均脉搏', value: `${avgPulse} 次/分` },
    ];
  }, [dates.length, records]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextRecord = createRecord(form.date, form.time, {
      temperature: Number(form.temperature),
      temperatureMethod: form.temperatureMethod,
      pulse: Number(form.pulse),
      systolic: Number(form.systolic),
      diastolic: Number(form.diastolic),
    });

    setRecords((current) => {
      const withoutSlot = current.filter((item) => recordKey(item) !== recordKey(nextRecord));
      return [...withoutSlot, nextRecord].sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    });
  };

  const resetSamples = () => {
    const sampleRecords = createSampleRecords();
    setRecords(sampleRecords);
    const sampleLatest = sampleRecords[sampleRecords.length - 1];
    setForm({
      date: sampleLatest.date,
      time: sampleLatest.time,
      temperature: String(sampleLatest.temperature ?? 36.8),
      temperatureMethod: sampleLatest.temperatureMethod,
      pulse: String(sampleLatest.pulse ?? 80),
      systolic: String(sampleLatest.systolic ?? 120),
      diastolic: String(sampleLatest.diastolic ?? 76),
    });
  };

  return (
    <WorkspaceLayout patient={patientInfo}>
      <Outlet
        context={
          {
            dates,
            form,
            records,
            stats,
            setForm,
            handleSubmit,
            resetSamples,
          } satisfies NursingWorkspaceContext
        }
      />
    </WorkspaceLayout>
  );
}

export function OverviewPage() {
  return (
    <OverviewSummary
      allergy={patientInfo.allergy}
      nursingLevel={patientInfo.nursingLevel}
      stats={useNursingWorkspace().stats}
    />
  );
}

export function TemperaturePage() {
  const workspace = useNursingWorkspace();
  return (
    <TemperatureWorkspace
      dates={workspace.dates}
      form={workspace.form}
      records={workspace.records}
      onFormChange={workspace.setForm}
      onResetSamples={workspace.resetSamples}
      onSubmit={workspace.handleSubmit}
    />
  );
}

export function MedicalRecordPage() {
  return <CanvasWordRecord patient={patientInfo} />;
}

export function MedicalRichRecordPage() {
  const workspace = useNursingWorkspace();
  return <MedicalRichRecordEditor patient={patientInfo} records={workspace.records} />;
}

export function RichCanvasWordPage() {
  const [readonly, setReadonly] = useState(false);
  const editorRef = useRef<RichCanvasWordEditorHandle | null>(null);
  const [cursor, setCursor] = useState<RichTextPosition | null>(null);
  const [selection, setSelection] = useState<RichTextSelection | null>(null);
  const [tableGridHover, setTableGridHover] = useState({ rows: 0, columns: 0 });

  const createDemoBlocks = (): RichTextBlock[] => [
    {
      id: `api-block-heading-${Date.now()}`,
      type: 'heading',
      align: 'left',
      runs: [
        {
          id: `api-run-heading-${Date.now()}`,
          text: 'V2 API 插入的标题',
          marks: { bold: true, fontSize: 22, color: '#166173' },
        },
      ],
    },
    {
      id: `api-block-paragraph-${Date.now()}`,
      type: 'paragraph',
      align: 'left',
      runs: [
        { id: `api-run-p-1-${Date.now()}`, text: '这组 blocks 来自 ', marks: {} },
        { id: `api-run-p-2-${Date.now()}`, text: 'RichCanvasWordEditorHandle.insertBlocks', marks: { bold: true } },
        { id: `api-run-p-3-${Date.now()}`, text: '，用于验证外部 API 可以插入富文本结构。', marks: {} },
      ],
    },
  ];

  const createEmptyDocument = (): RichTextDocument => ({
    id: `api-empty-document-${Date.now()}`,
    title: 'V2 API 空文档测试',
    blocks: [
      {
        id: `api-empty-block-${Date.now()}`,
        type: 'paragraph',
        align: 'left',
        runs: [{ id: `api-empty-run-${Date.now()}`, text: '', marks: {} }],
      },
    ],
  });

  const createDemoTable = (rowCount = 3, columnCount = 3): RichTextTableBlock => ({
    id: `api-table-${Date.now()}`,
    type: 'table',
    align: 'left',
    runs: [],
    columnWidths: Array.from({ length: columnCount }, () => 1),
    rows: Array.from({ length: rowCount }, (_, rowIndex) => ({
      id: `api-table-row-${rowIndex}-${Date.now()}`,
      cells: Array.from({ length: columnCount }, (_, cellIndex) => {
        const isHeader = rowIndex === 0;
        const headerText = ['项目', '当前值', '说明', '备注', '责任人', '时间'][cellIndex] ?? `列 ${cellIndex + 1}`;
        const bodyText =
          rowIndex === 1 && cellIndex === 0
            ? '体温'
            : rowIndex === 1 && cellIndex === 1
              ? '37.2 °C'
              : rowIndex === 1 && cellIndex === 2
                ? 'V2.2 表格，可点击单元格选中。'
                : '';

        return {
          id: `api-table-cell-${rowIndex}-${cellIndex}-${Date.now()}`,
          runs: [
            {
              id: `api-table-run-${rowIndex}-${cellIndex}-${Date.now()}`,
              text: isHeader ? headerText : bodyText,
              marks: isHeader ? { bold: true, color: '#166173' } : cellIndex === 1 && rowIndex === 1 ? { color: '#dc2626' } : {},
            },
          ],
        };
      }),
    })),
  });

  const describePosition = (position: RichTextPosition | null) =>
    position ? `${position.blockId} / ${position.runId} / ${position.offset}` : '无';

  const describeSelection = (currentSelection: RichTextSelection | null) =>
    currentSelection
      ? `anchor: ${describePosition(currentSelection.anchor)} | focus: ${describePosition(currentSelection.focus)}`
      : '无';

  return (
    <div className="rich-canvas-word-page">
      <div className="rich-canvas-word-mode">
        <button
          type="button"
          className={`btn ${readonly ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => setReadonly(false)}
          aria-pressed={!readonly}
        >
          编辑模式
        </button>
        <button
          type="button"
          className={`btn ${readonly ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setReadonly(true)}
          aria-pressed={readonly}
        >
          只读预览
        </button>
      </div>
      <div className="rich-canvas-api-panel" aria-label="V2 API 测试区">
        <div>
          <p className="eyebrow">V2 API Playground</p>
          <h2>公共 API 测试区</h2>
          <p className="subtitle">这些按钮只在通用富文本 demo 页面出现，用来验证外部组件可以通过 ref 控制编辑器。</p>
        </div>
        <div className="rich-canvas-api-actions">
          <button type="button" className="btn btn-secondary" onClick={() => editorRef.current?.focus()}>
            聚焦编辑器
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={readonly}
            onClick={() => editorRef.current?.insertText('【V2 API 插入文本】')}
          >
            插入文本
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={readonly}
            onClick={() => editorRef.current?.insertBlocks(createDemoBlocks())}
          >
            插入 blocks
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={readonly}
            onClick={() => editorRef.current?.insertBlocks([createDemoTable()])}
          >
            插入表格
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={readonly}
            onClick={() => editorRef.current?.replaceSelection('【V2 API 替换选区】')}
          >
            替换选区
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={readonly}
            onClick={() => editorRef.current?.setDocument(createEmptyDocument())}
          >
            空文档测试
          </button>
        </div>
        <div className="rich-canvas-table-picker" onMouseLeave={() => setTableGridHover({ rows: 0, columns: 0 })}>
          <div className="rich-canvas-table-picker-head">
            <span>插入表格</span>
            <strong>{tableGridHover.rows && tableGridHover.columns ? `${tableGridHover.rows} x ${tableGridHover.columns}` : '选择行列'}</strong>
          </div>
          <div className="rich-canvas-table-grid" aria-label="表格行列选择器">
            {Array.from({ length: 6 }, (_, rowIndex) =>
              Array.from({ length: 6 }, (_, columnIndex) => {
                const rows = rowIndex + 1;
                const columns = columnIndex + 1;
                const isActive = tableGridHover.rows >= rows && tableGridHover.columns >= columns;
                return (
                  <button
                    key={`${rows}-${columns}`}
                    type="button"
                    className={isActive ? 'is-active' : ''}
                    disabled={readonly}
                    aria-label={`插入 ${rows} 行 ${columns} 列表格`}
                    onMouseEnter={() => setTableGridHover({ rows, columns })}
                    onFocus={() => setTableGridHover({ rows, columns })}
                    onClick={() => editorRef.current?.insertBlocks([createDemoTable(rows, columns)])}
                  />
                );
              }),
            )}
          </div>
        </div>
        <div className="rich-canvas-api-state">
          <span>Cursor：{describePosition(cursor)}</span>
          <span>Selection：{describeSelection(selection)}</span>
        </div>
      </div>
      <RichCanvasWordRecord
        ref={editorRef}
        readonly={readonly}
        placeholder="这是 V2 API placeholder：可以直接输入，或点击上方按钮插入内容。"
        onCursorChange={setCursor}
        onSelectionChange={setSelection}
      />
    </div>
  );
}

function useNursingWorkspace(): NursingWorkspaceContext {
  return useOutletContext<NursingWorkspaceContext>();
}
