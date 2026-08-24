import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import CheckEmail from './pages/CheckEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Properties from './pages/Properties'
import Prospects from './pages/Prospects'
import Calendar from './pages/Calendar'
import CalendarCallback from './pages/CalendarCallback'
import Team from './pages/Team'
import Settings from './pages/Settings'
import TeamActivity from './pages/TeamActivity'
import Tasks from './pages/Tasks'
import Documents from './pages/Documents'
import Billing from './pages/Billing'
import Onboarding from './pages/Onboarding'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSupport from './pages/admin/AdminSupport'
import AdminBilling from './pages/admin/AdminBilling'
import AdminOrgDetail from './pages/admin/AdminOrgDetail'
import AdminUsers from './pages/admin/AdminUsers'
import AdminActivity from './pages/admin/AdminActivity'
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/check-email" element={<CheckEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/properties" element={<ProtectedRoute><Properties /></ProtectedRoute>} />
      <Route path="/prospects" element={<ProtectedRoute><Prospects /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/team/activity" element={<ProtectedRoute><TeamActivity /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
      <Route path="/calendar/callback/:provider" element={<ProtectedRoute><CalendarCallback /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/admin" element={<Navigate to="/admin/support" replace />} />
      <Route path="/admin/kpis" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
      <Route path="/admin/support" element={<ProtectedAdminRoute><AdminSupport /></ProtectedAdminRoute>} />
      <Route path="/admin/support/billing" element={<ProtectedAdminRoute><AdminBilling /></ProtectedAdminRoute>} />
      <Route path="/admin/support/users" element={<ProtectedAdminRoute><AdminUsers /></ProtectedAdminRoute>} />
      <Route path="/admin/support/activity" element={<ProtectedAdminRoute><AdminActivity /></ProtectedAdminRoute>} />
      <Route path="/admin/orgs/:orgId" element={<ProtectedAdminRoute><AdminOrgDetail /></ProtectedAdminRoute>} />
    </Routes>
  )
}
