import { useMemo, useState } from 'react';
import { RichCanvasWordRecord } from '../rich-canvas-word';
import { createRichMedicalRecordDocument } from './richMedicalRecordDocument';
import type { PatientInfo, VitalRecord } from '../../data/vitals';
import type { RichTextDocument, ToolbarCommand } from '../rich-canvas-word';
import './styles/MedicalRichRecordEditor.scss';

const editableToolbar: ToolbarCommand[] = [
  'save',
  'exportJson',
  'exportPlainText',
  'printPreview',
  'exportPdf',
  'copy',
  'undo',
  'redo',
  'bold',
  'underline',
  'fontSize',
  'textColor',
  'backgroundColor',
  'clearFormat',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'zoom',
];

const readonlyToolbar: ToolbarCommand[] = ['printPreview', 'exportPdf', 'copy', 'zoom'];

type MedicalRichRecordEditorProps = {
  patient: PatientInfo;
  records: VitalRecord[];
};

export function MedicalRichRecordEditor({ patient, records }: MedicalRichRecordEditorProps) {
  const sourceDocument = useMemo(() => createRichMedicalRecordDocument(patient, records), [patient, records]);
  const [document, setDocument] = useState<RichTextDocument>(() => sourceDocument);
  const [readonly, setReadonly] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const syncFromVitals = () => {
    setDocument(createRichMedicalRecordDocument(patient, records));
    setSavedAt(null);
  };

  const saveDocument = async (nextDocument: RichTextDocument) => {
    setDocument(nextDocument);
    setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <div className="medical-rich-record">
      <div className="medical-rich-record-panel">
        <div>
          <p className="eyebrow">Rich Canvas EMR</p>
          <h2>{patient.name} · 富文本电子病历</h2>
          <p>{patient.department} / {patient.bedNo} / {patient.diagnosis}</p>
        </div>
        <div className="medical-rich-record-actions">
          <span>{savedAt ? `业务保存 ${savedAt}` : '业务保存待触发'}</span>
          <button type="button" className={`btn ${readonly ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setReadonly(false)} aria-pressed={!readonly}>
            编辑病历
          </button>
          <button type="button" className={`btn ${readonly ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReadonly(true)} aria-pressed={readonly}>
            归档预览
          </button>
          <button type="button" className="btn btn-secondary" onClick={syncFromVitals}>
            同步体征
          </button>
        </div>
      </div>

      <RichCanvasWordRecord
        autoSave={false}
        onChange={setDocument}
        onSave={saveDocument}
        readonly={readonly}
        toolbarConfig={readonly ? readonlyToolbar : editableToolbar}
        value={document}
      />
    </div>
  );
}
