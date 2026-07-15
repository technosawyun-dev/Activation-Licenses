import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PageHeaderProvider } from './context/PageHeaderContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import TokensPage from './pages/TokensPage';
import TokenDetailPage from './pages/TokenDetailPage';
import LicensesPage from './pages/LicensesPage';
import LicenseDetailPage from './pages/LicenseDetailPage';
import DevicesPage from './pages/DevicesPage';
import DeviceDetailPage from './pages/DeviceDetailPage';
import AuditLogsPage from './pages/AuditLogsPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PageHeaderProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/tokens" element={<TokensPage />} />
              <Route path="/tokens/:id" element={<TokenDetailPage />} />
              <Route path="/licenses" element={<LicensesPage />} />
              <Route path="/licenses/:id" element={<LicenseDetailPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/devices/:id" element={<DeviceDetailPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </PageHeaderProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
