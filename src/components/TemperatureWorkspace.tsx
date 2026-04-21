import { FormEvent } from 'react';
import { TemperatureChart } from './TemperatureChart';
import { timeSlots } from '../data/vitals';
import type { TemperatureMethod, VitalRecord } from '../data/vitals';
import './styles/TemperatureWorkspace.scss';

export type VitalFormState = {
  date: string;
  time: string;
  temperature: string;
  temperatureMethod: TemperatureMethod;
  pulse: string;
  systolic: string;
  diastolic: string;
};

type TemperatureWorkspaceProps = {
  dates: string[];
  form: VitalFormState;
  records: VitalRecord[];
  onFormChange: (nextForm: VitalFormState) => void;
  onResetSamples: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TemperatureWorkspace({
  dates,
  form,
  records,
  onFormChange,
  onResetSamples,
  onSubmit,
}: TemperatureWorkspaceProps) {
  return (
    <>
      <section className="chart-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              {dates[0]} 至 {dates[dates.length - 1]}
            </p>
            <h2>体温、脉搏、血压趋势</h2>
          </div>
          <div className="legend-row" aria-label="图例">
            <span className="legend-symbol oral">口腔</span>
            <span className="legend-symbol axillary">腋下</span>
            <span className="legend-symbol rectal">直肠</span>
            <span className="legend-line pulse">脉搏</span>
            <span className="legend-bar">血压</span>
            <span className="legend-line reference">37°C</span>
          </div>
        </div>
        <TemperatureChart records={records} />
      </section>

      <section className="entry-panel" aria-label="录入生命体征">
        <div>
          <p className="eyebrow">Bedside Entry</p>
          <h2>录入新记录</h2>
          <p className="subtitle">同一日期和时间槽再次提交会自动覆盖原记录。</p>
        </div>
        <form className="vital-form" onSubmit={onSubmit}>
          <label>
            日期
            <select value={form.date} onChange={(event) => onFormChange({ ...form, date: event.target.value })}>
              {dates.map((date) => (
                <option value={date} key={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>
          <label>
            时间
            <select value={form.time} onChange={(event) => onFormChange({ ...form, time: event.target.value })}>
              {timeSlots.map((time) => (
                <option value={time} key={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
          <label>
            体温 °C
            <input
              max="42"
              min="35"
              step="0.1"
              type="number"
              value={form.temperature}
              onChange={(event) => onFormChange({ ...form, temperature: event.target.value })}
            />
          </label>
          <label>
            测量方式
            <select
              value={form.temperatureMethod}
              onChange={(event) => onFormChange({ ...form, temperatureMethod: event.target.value as TemperatureMethod })}
            >
              <option value="oral">口腔</option>
              <option value="axillary">腋下</option>
              <option value="rectal">直肠</option>
            </select>
          </label>
          <label>
            脉搏 次/分
            <input
              max="180"
              min="40"
              step="1"
              type="number"
              value={form.pulse}
              onChange={(event) => onFormChange({ ...form, pulse: event.target.value })}
            />
          </label>
          <label>
            收缩压
            <input
              max="180"
              min="40"
              step="1"
              type="number"
              value={form.systolic}
              onChange={(event) => onFormChange({ ...form, systolic: event.target.value })}
            />
          </label>
          <label>
            舒张压
            <input
              max="180"
              min="40"
              step="1"
              type="number"
              value={form.diastolic}
              onChange={(event) => onFormChange({ ...form, diastolic: event.target.value })}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              保存记录
            </button>
            <button type="button" className="btn btn-secondary" onClick={onResetSamples}>
              重置示例数据
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
