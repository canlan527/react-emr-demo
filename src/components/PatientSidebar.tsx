import type { PatientInfo } from '../data/vitals';
import './styles/PatientSidebar.scss';

type PatientSidebarProps = {
  patient: PatientInfo;
};

export function PatientSidebar({ patient }: PatientSidebarProps) {
  return (
    <aside className="patient-card" aria-label="病历头">
      <div className="patient-main">
        <span className="ward-pill">
          {patient.department} · {patient.bedNo}
        </span>
        <h2>{patient.name}</h2>
        <p>{patient.diagnosis}</p>
      </div>
      <div className="patient-grid standard-fields">
        <div>
          <span>姓名</span>
          <strong>{patient.name}</strong>
        </div>
        <div>
          <span>科室</span>
          <strong>{patient.department}</strong>
        </div>
        <div>
          <span>床号</span>
          <strong>{patient.bedNo}</strong>
        </div>
        <div>
          <span>住院号</span>
          <strong>{patient.inpatientNo}</strong>
        </div>
        <div>
          <span>性别</span>
          <strong>{patient.gender}</strong>
        </div>
        <div>
          <span>年龄</span>
          <strong>{patient.age}</strong>
        </div>
        <div>
          <span>入院日期</span>
          <strong>{patient.admissionDate}</strong>
        </div>
        <div>
          <span>诊断</span>
          <strong>{patient.diagnosis}</strong>
        </div>
      </div>
    </aside>
  );
}
