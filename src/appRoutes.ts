export const appRoutes = {
  overview: '/overview',
  temperature: '/temperature',
  medicalRecordRich: '/medical-record-rich',
  richCanvasWord: '/rich-canvas-word',
  wordBasic: '/word-basic',
} as const;

export type AppRoute = (typeof appRoutes)[keyof typeof appRoutes];

export const routeLabels: Record<AppRoute, string> = {
  [appRoutes.overview]: '病历概览',
  [appRoutes.temperature]: '体温单',
  [appRoutes.medicalRecordRich]: '电子病历 V1',
  [appRoutes.richCanvasWord]: '富文本 V1',
  [appRoutes.wordBasic]: '基础版 V0',
};
