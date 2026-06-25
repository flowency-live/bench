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
          DEFAULT: '#0a1929',
          light: '#1a2a3a',
        },
        lime: {
          DEFAULT: '#c5f82a',
        },
        gradient: {
          start: '#7ed321',
          mid: '#00bcd4',
          end: '#2196f3',
        },
      },
      fontFamily: {
        heading: ['var(--font-oswald)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
