export const appRoutes = {
  overview: '/overview',
  temperature: '/temperature',
  medicalRecord: '/medical-record',
  richCanvasWord: '/rich-canvas-word',
} as const;

export type AppRoute = (typeof appRoutes)[keyof typeof appRoutes];

export const routeLabels: Record<AppRoute, string> = {
  [appRoutes.overview]: '病历概览',
  [appRoutes.temperature]: '体温单',
  [appRoutes.medicalRecord]: '查看电子病例',
  [appRoutes.richCanvasWord]: '富文本 V1',
};
