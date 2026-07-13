import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sf: {
          blue: '#29B5E8',
          primary: '#29B5E8',
          dark: '#11567F',
          navy: '#003860',
          light: '#E8F4FA',
          accent: '#FF6F61',
          pale: '#A3DAF5',
          cyan: '#4DC9F6',
          deeper: '#003860',
        },
      },
    },
  },
  plugins: [animate],
};

export default config;
