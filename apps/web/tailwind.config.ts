import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/@bench/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#001930',
          panel: '#002e52',
        },
        lime: {
          DEFAULT: '#baeb5b',
        },
        slate: {
          secondary: '#9dadc8',
        },
      },
      fontFamily: {
        display: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        body: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
