import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Suspense, lazy } from 'react'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
import LoadingSpinner from '@/components/common/LoadingSpinner'

const LandingPage = lazy(() => import('@/pages/Landing'))
const LoginPage = lazy(() => import('@/pages/Login'))
const RegisterPage = lazy(() => import('@/pages/Register'))
const DashboardPage = lazy(() => import('@/pages/Dashboard'))
const BotsPage = lazy(() => import('@/pages/Bots'))
const BotDetailPage = lazy(() => import('@/pages/BotDetail'))
const CreateBotPage = lazy(() => import('@/pages/CreateBot'))
const DealsPage = lazy(() => import('@/pages/Deals'))
const BacktestingPage = lazy(() => import('@/pages/Backtesting'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const WebhooksPage = lazy(() => import('@/pages/Webhooks'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (token) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

            <Route element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="/bots/new" element={<CreateBotPage />} />
              <Route path="/bots/:botId" element={<BotDetailPage />} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/backtesting" element={<BacktestingPage />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
