import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
// Firebase is used only for static hosting of this SPA. Importing for its
// side effect initializes the Firebase app; it must not gate app startup.
import "@/lib/firebase/init";
import ClientErrorObserver from "@/components/client-error-observer";
import NetworkStatus from "@/components/network-status";
import PwaRegister from "@/components/pwa-register";
import CompleteProfilePage from "@/app/complete-profile/page";
import HomePage from "@/app/home/page";
import LoginPage from "@/app/login/page";
import OfflinePage from "@/app/offline/page";
import PublicProfileRoute from "@/app/profile/[username]/page";
import RegisterPage from "@/app/register/page";
import VerifyEmailPage from "@/app/verify-email/page";
import RootPage from "@/app/page";
import "@/app/globals.css";
import { AuthProvider } from "@/lib/auth/auth-provider";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/complete-profile" element={<CompleteProfilePage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/offline" element={<OfflinePage />} />
      <Route path="/profile/:username" element={<PublicProfileRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <StrictMode>
      <PwaRegister />
      <ClientErrorObserver />
      <NetworkStatus />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </StrictMode>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Vynq-chat root element is missing.");

createRoot(root).render(<BrowserRouter><App /></BrowserRouter>);
