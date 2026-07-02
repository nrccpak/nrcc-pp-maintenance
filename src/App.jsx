import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Equipment from './pages/Equipment'
import Maintenance from './pages/Maintenance'
import MajorMaintenance from './pages/MajorMaintenance'
import DataGaps from './pages/DataGaps'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './lib/AuthContext'

function Gate({ children }) {
  const { session, loading } = useAuth()

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

  return children
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
              <Route path="/major-maintenance" element={<MajorMaintenance />} />
              <Route path="/data-gaps" element={<DataGaps />} />
            </Routes>
          </Layout>
        </HashRouter>
      </Gate>
    </AuthProvider>
  )
}
