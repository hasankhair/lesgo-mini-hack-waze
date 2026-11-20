import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import MapPage from './pages/MapPage.jsx';
import LoginPage from './authentication/LoginPage.jsx';
import RegisterPage from './authentication/RegisterPage.jsx';
import ForgotPasswordPage from './authentication/ForgotPasswordPage.jsx';
import ResetPasswordPage from './authentication/ResetPasswordPage.jsx';
import ProtectedRoute from './authentication/ProtectedRoute.jsx';

const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));

function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="btn-primary">
        Back to the map
      </Link>
    </main>
  );
}

const Loading = () => (
  <div className="flex h-dvh items-center justify-center" role="status">
    <LoaderCircle className="h-8 w-8 animate-spin text-brand-600" aria-label="Loading" />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/dashboard/:tab?"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
