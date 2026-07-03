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
          bg: '#eef0f3',      // platinum page canvas
          surface: '#ffffff',
          raised: '#f5f6f8',
          hover: '#e9ecf0',
          line: '#dde1e7',
          line2: '#c7cdd6',
        },
        ink: {
          hi: '#1b2430',
          mid: '#5b6472',
          lo: '#707b8a',
        },
        st: {
          run: '#16a34a',     // running
          standby: '#2563eb', // standby
          warn: '#d97706',     // due soon
          over: '#dc2626',     // overdue
          trip: '#e11d48',     // tripped
          idle: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
}
