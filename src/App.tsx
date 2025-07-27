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
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';
import RecruiterProfilePage from './pages/RecruiterProfilePage';
import CompanyProfilePage from './pages/CompanyProfilePage';
import { DeveloperDashboard } from './pages/DeveloperDashboard';
import { PublicDeveloperProfile } from './pages/PublicDeveloperProfile';
import { GitHubAppSetup } from './pages/GitHubAppSetup';
import { AuthCallback } from './pages/AuthCallback';
import { ApplyForJob } from './pages/ApplyForJob';

// !! NEW IMPORT !!
import EndorsementPage from './pages/EndorsementPage'; // Assuming default export for EndorsementPage

import { HelmetProvider } from 'react-helmet-async';

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Header /> {/* This component renders your navigation bar */}
          <Routes>
            {/* Main Routes */}
            <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/onboarding" element={<DeveloperOnboarding />} />

          {/* User-Specific Dashboards/Profiles */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/recruiter" element={<RecruiterDashboard />} />
          <Route path="/developer" element={<DeveloperDashboard />} />

          {/* Navigation Redirects (if any) */}
          <Route path="/dashboard/jobs" element={<Navigate to="/developer?tab=jobs" />} />

          {/* Authentication & GitHub Setup */}
          <Route path="/github-setup" element={<GitHubAppSetup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Company & Recruiter Profiles */}
          <Route path="/recruiters/:id" element={<RecruiterProfilePage />} />
          <Route path="/company/:id" element={<CompanyProfilePage />} />
          <Route path="/apply/job/:jobId" element={<ApplyForJob />} />

          {/* !! IMPORTANT: NEW ENDORSEMENT ROUTE - Place more specific routes BEFORE less specific ones !! */}
          {/* This route will match '/u/some-uuid/endorse' */}
          <Route path="/u/:userId/endorse" element={<EndorsementPage />} />

          {/* Existing Public Developer Profile Route */}
          {/* This route will match '/u/some-slug' and now also acts as a fallback for '/u/:userId/*' if the /endorse route above isn't matched first */}
          <Route path="/u/:slug" element={<PublicDeveloperProfile />} />


          {/* Placeholder/Coming Soon Pages */}
          <Route path="/features" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Features Coming Soon</h1></div>} />
          <Route path="/pricing" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Pricing Coming Soon</h1></div>} />
          <Route path="/about" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">About Coming Soon</h1></div>} />
          <Route path="/contact" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Contact Coming Soon</h1></div>} />

          {/* Fallback 404 Route (Optional but recommended) */}
          <Route path="*" element={<div className="min-h-screen flex flex-col items-center justify-center p-8 text-gray-700">
            <h1 className="text-4xl font-bold mb-4">404 - Not Found</h1>
            <p className="text-lg">The page you are looking for does not exist.</p>
            <p className="text-md mt-2">Please check the URL or go back to the <a href="/" className="text-blue-600 hover:underline">homepage</a>.</p>
          </div>} />
        </Routes>
      </div>
    </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
