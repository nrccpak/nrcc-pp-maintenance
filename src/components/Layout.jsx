import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme, THEMES } from '../lib/ThemeContext'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/log-readings', label: 'Log Readings' },
  { to: '/equipment', label: 'Equipment Registry' },
  { to: '/maintenance', label: 'Maintenance' },
  { to: '/major-maintenance', label: 'Major Maintenance' },
  { to: '/data-gaps', label: 'Data Gaps' },
]

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="flex rounded-md border border-panel-line bg-panel-bg p-0.5">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.label}
          aria-pressed={theme === t.id}
          className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
            theme === t.id
              ? 'bg-panel-surface text-ink-hi shadow-sm'
              : 'text-ink-lo hover:text-ink-hi'
          }`}
        >
          {t.short}
        </button>
      ))}
    </div>
  )
}

export default function Layout({ children }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-panel-line bg-panel-surface">
        <div className="panel-rule border-b border-panel-line px-5 py-4">
          <div className="font-mono text-sm font-bold tracking-tight text-ink-hi">NRCC</div>
          <div className="text-[11px] uppercase tracking-wider text-ink-lo">Power Plant Ops</div>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-panel-raised text-ink-hi'
                    : 'text-ink-mid hover:bg-panel-raised/60 hover:text-ink-hi'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-panel-line px-5 py-3 text-[11px] text-ink-lo">
          <ThemePicker />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-st-run" />
              Connected
            </div>
            <button onClick={signOut} className="text-ink-lo underline underline-offset-2 hover:text-ink-hi">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto min-h-full w-full max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  )
}
