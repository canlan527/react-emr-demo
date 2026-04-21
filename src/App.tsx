import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import {
  MedicalRecordPage,
  NursingWorkspace,
  OverviewPage,
  RichCanvasWordPage,
  TemperaturePage,
} from './components/NursingWorkspace';
import { appRoutes } from './appRoutes';
import './styles/App.scss';

function App() {
  return (
    <main className="app-shell">
      <AppHeader />
      <Routes>
        <Route path="/" element={<Navigate to={appRoutes.temperature} replace />} />
        <Route element={<NursingWorkspace />}>
          <Route path={appRoutes.overview} element={<OverviewPage />} />
          <Route path={appRoutes.temperature} element={<TemperaturePage />} />
          <Route path={appRoutes.medicalRecord} element={<MedicalRecordPage />} />
          <Route path={appRoutes.richCanvasWord} element={<RichCanvasWordPage />} />
        </Route>
      </Routes>
    </main>
  );
}

export default App;
