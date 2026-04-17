export type TemperatureMethod = 'oral' | 'axillary' | 'rectal';

export type VitalRecord = {
  date: string;
  time: string;
  datetime: Date;
  dayLabel: string;
  timeLabel: string;
  temperature: number | null;
  temperatureMethod: TemperatureMethod;
  pulse: number | null;
  systolic: number | null;
  diastolic: number | null;
  event?: string;
};

export type PatientInfo = {
  name: string;
  department: string;
  bedNo: string;
  inpatientNo: string;
  gender: string;
  age: string;
  admissionDate: string;
  diagnosis: string;
  allergy: string;
  nursingLevel: string;
};

export const timeSlots = ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'];

const dates = Array.from({ length: 10 }, (_, index) => {
  const date = new Date('2026-04-08T00:00:00');
  date.setDate(date.getDate() + index);
  return date.toISOString().slice(0, 10);
});

const temperatures = [
  36.6, 36.7, 36.8, 36.9, 36.8, 36.7,
  36.7, 36.9, 37.4, 38.1, 38.6, 38.2,
  37.8, 37.4, 37.1, 37.5, 38.0, 38.3,
  38.5, 38.8, 39.2, 39.0, 38.4, 37.9,
  37.6, 37.3, 37.1, 37.4, 37.8, 37.5,
  37.2, 37.0, 36.9, 36.8, 36.7, 36.8,
  36.7, 36.8, 36.9, 37.1, 37.0, 36.8,
  36.6, 36.7, 36.8, 36.9, 36.8, 36.7,
  36.5, 36.6, 36.7, 36.8, 36.7, 36.6,
  36.6, 36.7, 36.8, 36.9, 36.8, 36.7,
];

const pulses = [
  76, 78, 80, 82, 80, 78,
  80, 86, 96, 108, 118, 112,
  104, 98, 92, 100, 110, 116,
  120, 126, 132, 128, 116, 106,
  100, 96, 92, 96, 104, 98,
  90, 86, 82, 80, 78, 80,
  78, 80, 82, 86, 84, 80,
  76, 78, 80, 82, 80, 78,
  76, 76, 78, 80, 78, 76,
  76, 78, 80, 82, 80, 78,
];

const systolic = [
  118, 116, 120, 122, 120, 118,
  120, 124, 128, 132, 136, 134,
  130, 128, 126, 128, 132, 134,
  136, 138, 140, 138, 134, 130,
  126, 124, 122, 124, 128, 126,
  122, 120, 118, 116, 118, 120,
  118, 120, 122, 124, 122, 120,
  116, 118, 120, 122, 120, 118,
  116, 116, 118, 120, 118, 116,
  116, 118, 120, 122, 120, 118,
];

const diastolic = [
  74, 72, 76, 78, 76, 74,
  76, 78, 82, 84, 86, 84,
  82, 80, 78, 80, 82, 84,
  86, 88, 90, 88, 84, 82,
  80, 78, 76, 78, 80, 78,
  76, 74, 72, 72, 74, 76,
  74, 76, 78, 80, 78, 76,
  72, 74, 76, 78, 76, 74,
  72, 72, 74, 76, 74, 72,
  72, 74, 76, 78, 76, 74,
];

const methods: TemperatureMethod[] = ['oral', 'axillary', 'rectal'];

const events: Record<number, string> = {
  9: '低热',
  16: '寒战',
  20: '高热',
  22: '退热处理',
  31: '复测',
};

export const createRecord = (
  date: string,
  time: string,
  values: Pick<VitalRecord, 'temperature' | 'temperatureMethod' | 'pulse' | 'systolic' | 'diastolic'> & {
    event?: string;
  },
): VitalRecord => ({
  date,
  time,
  datetime: new Date(`${date}T${time}:00`),
  dayLabel: date.slice(5),
  timeLabel: time.slice(0, 2),
  temperature: values.temperature,
  temperatureMethod: values.temperatureMethod,
  pulse: values.pulse,
  systolic: values.systolic,
  diastolic: values.diastolic,
  event: values.event,
});

export const createSampleRecords = (): VitalRecord[] =>
  dates.flatMap((date, dayIndex) =>
    timeSlots.map((time, timeIndex) => {
      const index = dayIndex * timeSlots.length + timeIndex;
      return createRecord(date, time, {
        temperature: temperatures[index],
        temperatureMethod: methods[index % methods.length],
        pulse: pulses[index],
        systolic: systolic[index],
        diastolic: diastolic[index],
        event: events[index],
      });
    }),
  );

export const patientInfo: PatientInfo = {
  name: '林知远',
  department: '心胸外科',
  bedNo: '08 床',
  inpatientNo: 'ZY20260408037',
  gender: '男',
  age: '48 岁',
  admissionDate: '2026-04-08',
  diagnosis: '肺部感染伴术后观察',
  allergy: '青霉素',
  nursingLevel: '一级护理',
};
