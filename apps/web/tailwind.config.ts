import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Discord-inspired palette
        bgDeep: '#1e1f22',
        bgSidebar: '#2b2d31',
        bgChat: '#313338',
        bgInput: '#383a40',
        textMain: '#dbdee1',
        textMuted: '#949ba4',
        accent: '#5865f2',
        accentHover: '#4752c4',
        success: '#23a559',
        danger: '#f23f43',
      },
    },
  },
  plugins: [],
};

export default config;
