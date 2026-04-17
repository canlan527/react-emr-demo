import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        clinical: {
          ink: '#172033',
          muted: '#5d6b82',
          line: '#d7deeb',
          surface: '#f6f8fb',
          fever: '#d64545',
          temp: '#e34a4a',
          pulse: '#1f7a8c',
          breath: '#2f855a',
          urine: '#7c5c2e',
        },
      },
      boxShadow: {
        panel: '0 18px 50px rgba(28, 42, 68, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
