import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Assuming AuthProvider is a named export from AuthContext.tsx
import { AuthProvider } from './contexts/AuthContext.tsx'; 

// Assuming Header is a named export
import { Header } from './components/Layout/Header'; 

// Page components typically use default exports
import LandingPage from './pages/LandingPage'; 
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import RecruiterDashboard from './pages/RecruiterDashboard'; // FIXED: Changed to default import
import DeveloperDashboard from './pages/DeveloperDashboard';
import PublicDeveloperProfile from './pages/PublicDeveloperProfile';
import GitHubAppSetup from './pages/GitHubAppSetup';
import AuthCallback from './pages/AuthCallback';
import ApplyForJob from './pages/ApplyForJob';
import RecruiterProfilePage from './pages/RecruiterProfilePage'; // Already correct
import CompanyProfilePage from './pages/CompanyProfilePage';     // Already correct

// Form components often use named exports
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { DeveloperOnboarding } from './components/Onboarding/DeveloperOnboarding';


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
