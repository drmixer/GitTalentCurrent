import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { Header } from './components/Layout/Header';
import { LandingPage } from './pages/LandingPage';
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { DeveloperDashboard } from './pages/DeveloperDashboard';
import { DeveloperOnboarding } from './components/Onboarding/DeveloperOnboarding';
import { PublicDeveloperProfile } from './pages/PublicDeveloperProfile';
import { GitHubAppSetup } from './pages/GitHubAppSetup';
import { AuthCallback } from './pages/AuthCallback';
import { ApplyForJob } from './pages/ApplyForJob';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/onboarding" element={<DeveloperOnboarding />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/recruiter" element={<RecruiterDashboard />} />
          <Route path="/developer" element={<DeveloperDashboard />} />
          <Route path="/dashboard/jobs" element={<Navigate to="/developer?tab=jobs" />} />
          <Route path="/u/:slug" element={<PublicDeveloperProfile />} />
          <Route path="/github-setup" element={<GitHubAppSetup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/apply/job/:jobId" element={<ApplyForJob />} />
          <Route path="/features" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Features Coming Soon</h1></div>} />
          <Route path="/pricing" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Pricing Coming Soon</h1></div>} />
          <Route path="/about" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">About Coming Soon</h1></div>} />
          <Route path="/contact" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Contact Coming Soon</h1></div>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;