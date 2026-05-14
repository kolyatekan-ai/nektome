import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Titanium palette — cool gunmetal + cyan glow
        bgDeep: '#0a0b0e',
        bgSidebar: '#0f1116',
        bgPanel: '#13151c',
        bgPanelHi: '#1a1d26',
        bgChat: '#0c0e13',
        bgInput: '#1c1f2a',
        border: '#262a35',
        borderHi: '#3a3f4d',
        textMain: '#e4e6eb',
        textSoft: '#b8bcc4',
        textMuted: '#7d8590',
        accent: '#7dd3fc',
        accentHi: '#a5f3fc',
        accentDark: '#0891b2',
        accentGlow: 'rgba(125, 211, 252, 0.35)',
        success: '#34d399',
        successGlow: 'rgba(52, 211, 153, 0.35)',
        danger: '#f87171',
        warning: '#fbbf24',
      },
      backgroundImage: {
        'titanium-grad':
          'linear-gradient(135deg, #1a1d26 0%, #13151c 50%, #0f1116 100%)',
        'titanium-shine':
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.0) 50%, rgba(255,255,255,0.03) 100%)',
        'cyan-glow':
          'radial-gradient(circle at 50% 0%, rgba(125, 211, 252, 0.15) 0%, transparent 60%)',
        'accent-grad':
          'linear-gradient(135deg, #7dd3fc 0%, #a5f3fc 50%, #67e8f9 100%)',
      },
      boxShadow: {
        glow: '0 0 24px rgba(125, 211, 252, 0.25)',
        'glow-sm': '0 0 12px rgba(125, 211, 252, 0.2)',
        'inner-shine': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        panel:
          '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 -1px 0 0 rgba(0,0,0,0.4) inset, 0 8px 24px -8px rgba(0,0,0,0.6)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'speak-ring': 'speak-ring 1.4s ease-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'speak-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(52, 211, 153, 0.5)' },
          '100%': { boxShadow: '0 0 0 12px rgba(52, 211, 153, 0)' },
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'gg sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
