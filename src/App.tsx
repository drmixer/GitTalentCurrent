import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// AuthContext: Named export
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { NotificationsProvider } from './contexts/NotificationsContext.tsx';

// Components: All confirmed as Named Exports
import { Header } from './components/Layout/Header';
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { DeveloperOnboarding } from './components/Onboarding/DeveloperOnboarding';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages: Mixed exports - Pay close attention!
import { LandingPage } from './pages/LandingPage';
import { AdminDashboard } from './pages/AdminDashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';
import RecruiterProfilePage from './pages/RecruiterProfilePage';
import CompanyProfilePage from './pages/CompanyProfilePage';
import { DeveloperDashboard } from './pages/DeveloperDashboard';
import { PublicDeveloperProfile } from './pages/PublicDeveloperProfile';
import { GitHubAppSetup } from './pages/GitHubAppSetup';
import { AuthCallback } from './pages/AuthCallback';
import { GitHubCallback } from './pages/GitHubCallback';
import { ApplyForJob } from './pages/ApplyForJob';
import TestPage from './pages/TestPage';
import AdminTests from './pages/AdminTests';
import DeveloperTests from './pages/DeveloperTests';
import TestResultsPage from './pages/TestResultsPage';
import TestSandpackPage from './pages/TestSandpackPage';
import TestSandpackSimplePage from './pages/TestSandpackSimplePage';
import TestJavaScriptPage from './pages/TestJavaScriptPage';
import TestVuePage from './pages/TestVuePage';
import EndorsementPage from './pages/EndorsementPage';

// Helper component to redirect users from a generic /dashboard
const RoleBasedRedirect = () => {
  const { userProfile } = useAuth();
  if (userProfile?.role === 'developer') return <Navigate to="/developer" replace />;
  if (userProfile?.role === 'recruiter') return <Navigate to="/recruiter" replace />;
  if (userProfile?.role === 'admin') return <Navigate to="/admin" replace />;
  // Fallback while profile is loading or for unknown roles
  return <Navigate to="/" replace />; 
};

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <Routes>
            {/* Main Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/signup" element={<SignupForm />} />
            
            {/* Dashboard redirect */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['developer', 'recruiter', 'admin']}>
                  <RoleBasedRedirect />
                </ProtectedRoute>
              } 
            />

            <Route path="/onboarding" element={<DeveloperOnboarding />} />

            {/* Protected Role-Specific Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/tests" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminTests />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/recruiter" 
              element={
                <ProtectedRoute allowedRoles={['recruiter']}>
                  <RecruiterDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/developer" 
              element={
                <ProtectedRoute allowedRoles={['developer']}>
                  <DeveloperDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/developer/tests" 
              element={
                <ProtectedRoute allowedRoles={['developer']}>
                  <DeveloperTests />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/recruiter/results/:assignmentId" 
              element={
                <ProtectedRoute allowedRoles={['recruiter']}>
                  <TestResultsPage />
                </ProtectedRoute>
              } 
            />

            {/* Navigation Redirects */}
            <Route path="/dashboard/jobs" element={<Navigate to="/developer?tab=jobs" />} />

            {/* Authentication & GitHub Setup */}
            <Route path="/github-setup" element={<GitHubAppSetup />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* UPDATED: GitHub App callback with better error handling */}
            <Route path="/auth/github-callback" element={<GitHubCallback />} />

            {/* Company & Recruiter Profiles */}
            <Route path="/recruiters/:id" element={<RecruiterProfilePage />} />
            <Route path="/company/:id" element={<CompanyProfilePage />} />
            <Route path="/apply/job/:jobId" element={<ApplyForJob />} />
            <Route path="/test/:assignmentId" element={<TestPage />} />

            {/* Endorsement Routes */}
            <Route path="/u/:userId/endorse" element={<EndorsementPage />} />
            <Route path="/u/:slug" element={<PublicDeveloperProfile />} />

            {/* Placeholder Pages */}
            <Route path="/features" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Features Coming Soon</h1></div>} />
            <Route path="/pricing" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Pricing Coming Soon</h1></div>} />
            <Route path="/about" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">About Coming Soon</h1></div>} />
            <Route path="/contact" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Contact Coming Soon</h1></div>} />

            {/* Test Sandpack Pages - Demo */}
            <Route path="/test-sandpack" element={<TestSandpackPage />} />
            <Route path="/test-sandpack-simple" element={<TestSandpackSimplePage />} />
            <Route path="/test-javascript" element={<TestJavaScriptPage />} />
            <Route path="/test-vue" element={<TestVuePage />} />

            {/* Fallback 404 Route */}
            <Route path="*" element={<div className="min-h-screen flex flex-col items-center justify-center p-8 text-gray-700">
              <h1 className="text-4xl font-bold mb-4">404 - Not Found</h1>
              <p className="text-lg">The page you are looking for does not exist.</p>
              <p className="text-md mt-2">Please check the URL or go back to the <a href="/" className="text-blue-600 hover:underline">homepage</a>.</p>
            </div>} />
          </Routes>
        </div>
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default App;
