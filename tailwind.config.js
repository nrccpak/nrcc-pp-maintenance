/** @type {import('tailwindcss').Config} */

// Every color below resolves through a CSS custom property (see index.css),
// so the same utility classes (bg-panel-bg, text-st-over/30, etc.) render
// differently per theme just by swapping the [data-theme] variable block —
// no class-name changes needed anywhere in the app.
function themeColor(varName) {
  return `rgb(var(${varName}) / <alpha-value>)`
}

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
          bg:      themeColor('--panel-bg'),
          surface: themeColor('--panel-surface'),
          raised:  themeColor('--panel-raised'),
          hover:   themeColor('--panel-hover'),
          line:    themeColor('--panel-line'),
          line2:   themeColor('--panel-line2'),
        },
        ink: {
          hi:  themeColor('--ink-hi'),
          mid: themeColor('--ink-mid'),
          lo:  themeColor('--ink-lo'),
        },
        st: {
          run:      themeColor('--st-run'),      // running / confirmed / success
          standby:  themeColor('--st-standby'),  // standby / scheduled / informational
          warn:     themeColor('--st-warn'),      // due soon / field-verify
          over:     themeColor('--st-over'),      // overdue / gap / error
          trip:     themeColor('--st-trip'),      // tripped
          idle:     themeColor('--st-idle'),      // unknown / idle
          partial:  themeColor('--st-partial'),   // partial-gap
        },
      },
    },
  },
  plugins: [],
}
