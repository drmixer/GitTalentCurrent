import React, { useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './contexts/AuthContext.tsx';
import { Header } from './components/Layout/Header';
import { LandingPage } from './pages/LandingPage';
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { DeveloperDashboard } from './pages/DeveloperDashboard';
import { DeveloperOnboarding } from './components/Onboarding/DeveloperOnboarding';

function App() {
  const { user, userProfile, loading } = useContext(AuthContext);
  
  // Redirect paths for different roles
  const getRedirectPath = () => {
    if (userProfile) {
      if (userProfile.role === 'admin') return '/admin';
      if (userProfile.role === 'recruiter') return '/recruiter';
      if (userProfile.role === 'developer') return '/developer';
    }
    return null;
  };

  // Redirect path based on role
  const redirectPath = getRedirectPath();

  useEffect(() => {
    if (!loading && user && userProfile && redirectPath) {
      // Once the redirectPath is determined, handle redirection
    }
  }, [user, userProfile, loading]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} />;
  }

  return (
    <Router>
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
          <Route path="/features" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Features Coming Soon</h1></div>} />
          <Route path="/pricing" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Pricing Coming Soon</h1></div>} />
          <Route path="/about" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">About Coming Soon</h1></div>} />
          <Route path="/contact" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Contact Coming Soon</h1></div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
