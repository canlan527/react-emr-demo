import { FormEvent, useMemo, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { OverviewSummary } from './OverviewSummary';
import { TemperatureWorkspace } from './TemperatureWorkspace';
import { WorkspaceLayout } from './WorkspaceLayout';
import { CanvasWordRecord } from '../lib/canvas-word-basic/CanvasWordRecord';
import { RichCanvasWordRecord } from '../lib/rich-canvas-word/RichCanvasWordRecord';
import { createRecord, createSampleRecords, patientInfo } from '../data/vitals';
import type { VitalRecord } from '../data/vitals';
import type { VitalFormState } from './TemperatureWorkspace';

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

export function RichCanvasWordPage() {
  return <RichCanvasWordRecord />;
}

function useNursingWorkspace(): NursingWorkspaceContext {
  return useOutletContext<NursingWorkspaceContext>();
}
