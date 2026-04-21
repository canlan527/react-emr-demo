import { ReactNode } from 'react';
import { PatientSidebar } from './PatientSidebar';
import type { PatientInfo } from '../data/vitals';
import './styles/WorkspaceLayout.scss';

type WorkspaceLayoutProps = {
  patient: PatientInfo;
  children: ReactNode;
};

export function WorkspaceLayout({ patient, children }: WorkspaceLayoutProps) {
  return (
    <div className="workspace-layout">
      <PatientSidebar patient={patient} />
      <div className="workspace-content">{children}</div>
    </div>
  );
}
