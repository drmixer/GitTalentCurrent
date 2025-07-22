import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// AuthContext: Named export
import { AuthProvider } from './contexts/AuthContext.tsx';

// Components: All confirmed as Named Exports
import { Header } from './components/Layout/Header';
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { DeveloperOnboarding } from './components/Onboarding/DeveloperOnboarding';

// Pages: Mixed exports - Pay close attention!
import { LandingPage } from './pages/LandingPage';           // Confirmed: Named Export
import { Dashboard } from './pages/Dashboard';               // Confirmed: Named Export
import { AdminDashboard } from './pages/AdminDashboard';     // Confirmed: Named Export
import RecruiterDashboard from './pages/RecruiterDashboard'; // Confirmed: Default Export
import RecruiterProfilePage from './pages/RecruiterProfilePage'; // Confirmed: Default Export
import CompanyProfilePage from './pages/CompanyProfilePage';     // Confirmed: Default Export
import { DeveloperDashboard } from './pages/DeveloperDashboard'; // Confirmed: Named Export
import { PublicDeveloperProfile } from './pages/PublicDeveloperProfile'; // Confirmed: Named Export
import { GitHubAppSetup } from './pages/GitHubAppSetup';     // Confirmed: Named Export
import { AuthCallback } from './pages/AuthCallback';         // Confirmed: Named Export
import { ApplyForJob } from './pages/ApplyForJob';           // Confirmed: Named Export

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
          <Route path="/recruiters/:id" element={<RecruiterProfilePage />} />
          <Route path="/company/:id" element={<CompanyProfilePage />} />
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
