import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider } from './lib/ThemeContext'
import { PageLoader } from './components/ui'

// Route-level code splitting — only the active page's bundle is fetched,
// instead of one ~500 kB chunk containing every page up front.
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const LogReadings      = lazy(() => import('./pages/LogReadings'))
const Equipment        = lazy(() => import('./pages/Equipment'))
const Maintenance      = lazy(() => import('./pages/Maintenance'))
const MajorMaintenance = lazy(() => import('./pages/MajorMaintenance'))
const DataGaps         = lazy(() => import('./pages/DataGaps'))

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
    <ThemeProvider>
      <AuthProvider>
        <Gate>
          <HashRouter>
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/log-readings" element={<LogReadings />} />
                  <Route path="/equipment" element={<Equipment />} />
                  <Route path="/maintenance" element={<Maintenance />} />
                  <Route path="/major-maintenance" element={<MajorMaintenance />} />
                  <Route path="/data-gaps" element={<DataGaps />} />
                </Routes>
              </Suspense>
            </Layout>
          </HashRouter>
        </Gate>
      </AuthProvider>
    </ThemeProvider>
  )
}
