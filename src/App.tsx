import { FormEvent, useEffect, useMemo, useState } from 'react';
import { TemperatureChart } from './components/TemperatureChart';
import { CanvasWordRecord } from './lib/canvas-word-basic/CanvasWordRecord';
import { RichCanvasWordRecord } from './lib/rich-canvas-word/RichCanvasWordRecord';
import {
  createRecord,
  createSampleRecords,
  patientInfo,
  timeSlots,
} from './data/vitals';
import type { TemperatureMethod, VitalRecord } from './data/vitals';

type Route = '/overview' | '/temperature' | '/medical-record' | '/rich-canvas-word';

type VitalFormState = {
  date: string;
  time: string;
  temperature: string;
  temperatureMethod: TemperatureMethod;
  pulse: string;
  systolic: string;
  diastolic: string;
};

const routeLabels: Record<Route, string> = {
  '/overview': '病历概览',
  '/temperature': '体温单',
  '/medical-record': '查看电子病例',
  '/rich-canvas-word': '富文本 V1',
};

function readRoute(): Route {
  if (window.location.pathname === '/overview') {
    return '/overview';
  }

  if (window.location.pathname === '/medical-record') {
    return '/medical-record';
  }

  if (window.location.pathname === '/rich-canvas-word') {
    return '/rich-canvas-word';
  }

  return '/temperature';
}

function navigate(route: Route) {
  window.history.pushState({}, '', route);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function recordKey(record: Pick<VitalRecord, 'date' | 'time'>) {
  return `${record.date}-${record.time}`;
}

function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [records, setRecords] = useState<VitalRecord[]>(() => createSampleRecords());

  useEffect(() => {
    const handleRoute = () => setRoute(readRoute());
    window.addEventListener('popstate', handleRoute);
    return () => window.removeEventListener('popstate', handleRoute);
  }, []);

  const dates = useMemo(() => Array.from(new Set(records.map((item) => item.date))), [records]);
  const latestRecord = records[records.length - 1];
  const [form, setForm] = useState<VitalFormState>(() => ({
    date: latestRecord.date,
    time: latestRecord.time,
    temperature: String(latestRecord.temperature ?? 36.8),
    temperatureMethod: latestRecord.temperatureMethod,
    pulse: String(latestRecord.pulse ?? 80),
    systolic: String(latestRecord.systolic ?? 120),
    diastolic: String(latestRecord.diastolic ?? 76),
  }));

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
    <main className="app-shell">
      <header className="top-strip">
        <div className="brand-lockup">
          <img
            src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=320&q=80"
            alt="医院走廊"
            className="brand-image"
          />
          <div>
            <p className="eyebrow">HIS Nursing Record</p>
            <h1>住院患者体温单</h1>
            <p className="subtitle">10天体温、脉搏、血压趋势与床旁录入</p>
          </div>
        </div>
        <nav className="route-tabs" aria-label="页面路由">
          {(Object.keys(routeLabels) as Route[]).map((item) => (
            <button
              className={route === item ? 'route-tab active' : 'route-tab'}
              key={item}
              type="button"
              onClick={() => navigate(item)}
            >
              {routeLabels[item]}
            </button>
          ))}
        </nav>
      </header>

      <div className="workspace-layout">
        <aside className="patient-card" aria-label="病历头">
          <div className="patient-main">
            <span className="ward-pill">
              {patientInfo.department} · {patientInfo.bedNo}
            </span>
            <h2>{patientInfo.name}</h2>
            <p>{patientInfo.diagnosis}</p>
          </div>
          <div className="patient-grid standard-fields">
            <div>
              <span>姓名</span>
              <strong>{patientInfo.name}</strong>
            </div>
            <div>
              <span>科室</span>
              <strong>{patientInfo.department}</strong>
            </div>
            <div>
              <span>床号</span>
              <strong>{patientInfo.bedNo}</strong>
            </div>
            <div>
              <span>住院号</span>
              <strong>{patientInfo.inpatientNo}</strong>
            </div>
            <div>
              <span>性别</span>
              <strong>{patientInfo.gender}</strong>
            </div>
            <div>
              <span>年龄</span>
              <strong>{patientInfo.age}</strong>
            </div>
            <div>
              <span>入院日期</span>
              <strong>{patientInfo.admissionDate}</strong>
            </div>
            <div>
              <span>诊断</span>
              <strong>{patientInfo.diagnosis}</strong>
            </div>
          </div>
        </aside>

        <div className="workspace-content">
          {route === '/overview' ? (
            <section className="summary-grid" aria-label="病历概览">
              {stats.map((item) => (
                <article className="summary-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>
                    {patientInfo.nursingLevel} · 过敏史：{patientInfo.allergy}
                  </p>
                </article>
              ))}
            </section>
          ) : null}

          {route === '/medical-record' ? (
            <CanvasWordRecord patient={patientInfo} />
          ) : null}

          {route === '/rich-canvas-word' ? (
            <RichCanvasWordRecord />
          ) : null}

          {route === '/temperature' ? (
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
                <form className="vital-form" onSubmit={handleSubmit}>
                  <label>
                    日期
                    <select value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}>
                      {dates.map((date) => (
                        <option value={date} key={date}>
                          {date}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    时间
                    <select value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })}>
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
                      onChange={(event) => setForm({ ...form, temperature: event.target.value })}
                    />
                  </label>
                  <label>
                    测量方式
                    <select
                      value={form.temperatureMethod}
                      onChange={(event) => setForm({ ...form, temperatureMethod: event.target.value as TemperatureMethod })}
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
                      onChange={(event) => setForm({ ...form, pulse: event.target.value })}
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
                      onChange={(event) => setForm({ ...form, systolic: event.target.value })}
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
                      onChange={(event) => setForm({ ...form, diastolic: event.target.value })}
                    />
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                      保存记录
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={resetSamples}>
                      重置示例数据
                    </button>
                  </div>
                </form>
              </section>
            </>
          ) : (
            null
          )}
        </div>
      </div>
    </main>
  );
}

export default App;
