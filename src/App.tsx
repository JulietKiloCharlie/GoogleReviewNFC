import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { AdminLayout } from "@/pages/AdminLayout";
import { BusinessFormPage } from "@/pages/BusinessFormPage";
import { BusinessesPage } from "@/pages/BusinessesPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { PublicPage } from "@/pages/PublicPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

function RequireAdmin() {
  const auth = useAuth();
  if (auth.loading) return <main className="grid min-h-screen place-items-center">Loading…</main>;
  if (!auth.configured || !auth.session || !auth.isAdmin) return <Navigate to="/login" replace />;
  return <AdminLayout />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/admin" element={<RequireAdmin />}>
        <Route index element={<OverviewPage />} />
        <Route path="businesses" element={<BusinessesPage />} />
        <Route path="businesses/new" element={<BusinessFormPage />} />
        <Route path="businesses/:id" element={<BusinessFormPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/:slug" element={<PublicPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
