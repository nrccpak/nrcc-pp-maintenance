import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Equipment from './pages/Equipment'
import Maintenance from './pages/Maintenance'
import DataGaps from './pages/DataGaps'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './lib/AuthContext'

function Gate({ children }) {
  const { session, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-panel-bg flex items-center justify-center">
        <p className="text-ink-mid font-mono text-sm">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <>
      <button
        onClick={signOut}
        className="fixed top-3 right-3 z-50 text-xs font-mono text-ink-mid hover:text-ink-hi bg-panel-surface border border-panel-line px-3 py-1 rounded"
      >
        Sign out
      </button>
      {children}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/equipment" element={<Equipment />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/data-gaps" element={<DataGaps />} />
            </Routes>
          </Layout>
        </HashRouter>
      </Gate>
    </AuthProvider>
  )
}
