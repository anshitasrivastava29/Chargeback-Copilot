import { Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import DisputeDetailPage from '@/pages/DisputeDetailPage'
import DisputeInboxPage from '@/pages/DisputeInboxPage'
import EvidenceVaultPage from '@/pages/EvidenceVaultPage'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import PayPalConnectionPage from '@/pages/PayPalConnectionPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import SignupPage from '@/pages/SignupPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="disputes" element={<DisputeInboxPage />} />
          <Route path="disputes/:disputeId" element={<DisputeDetailPage />} />
          <Route path="evidence" element={<EvidenceVaultPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="paypal" element={<PayPalConnectionPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
