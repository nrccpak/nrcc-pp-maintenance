/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        panel: {
          bg: '#0e1116',      // deep control-room slate
          surface: '#151a21',
          raised: '#1b212a',
          line: '#262d38',
          line2: '#323a47',
        },
        ink: {
          hi: '#e8edf4',
          mid: '#9aa6b6',
          lo: '#5f6b7c',
        },
        st: {
          run: '#34d399',     // running
          standby: '#60a5fa', // standby
          warn: '#fbbf24',     // due soon
          over: '#f87171',     // overdue
          trip: '#fb7185',     // tripped
          idle: '#64748b',
        },
      },
    },
  },
  plugins: [],
}
