import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Lock, User, Building, AlertCircle, Eye, EyeOff, GitBranch, Code, Users, Github, CheckCircle, RefreshCw } from 'lucide-react';

export const SignupForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'developer' as 'developer' | 'recruiter',
    company_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const { signUp, signInWithGitHub, user, userProfile, loading: authLoading, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If there's an auth error from the context, show it
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // Redirect to dashboard if user is already authenticated and has a profile
  useEffect(() => {
    if (!authLoading && user) {
      console.log('✅ User authenticated, redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For developers, only GitHub signup is allowed
    if (formData.role === 'developer') {
      handleGitHubSignUp();
      return;
    }
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate form data
      if (!formData.name.trim()) {
        throw new Error('Name is required');
      }
      if (!formData.email.trim()) {
        throw new Error('Email is required');
      }
      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      if (formData.role === 'recruiter' && !formData.company_name.trim()) {
        throw new Error('Company name is required for recruiters');
      }
      
      // Store role and company name in local storage to ensure it's available in the AuthContext
      localStorage.setItem('gittalent_signup_role', formData.role);
      if (formData.role === 'recruiter') {
        localStorage.setItem('gittalent_signup_company_name', formData.company_name.trim());
      }

      const userData = {
        name: formData.name.trim(),
        role: formData.role,
        is_approved: formData.role === 'developer', // Auto-approve developers
        company_name: formData.role === 'recruiter' ? formData.company_name.trim() : undefined,
      };

      await signUp(formData.email.trim(), formData.password, userData);
      
      if (formData.role === 'recruiter') {
        setSuccess('Your account has been created and is pending admin approval.');
        // Navigation will happen automatically via useEffect when user loads
      } else {
        setSuccess('Account created successfully! Redirecting to dashboard...');
        // Navigation will happen automatically via useEffect when user loads
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignUp = async () => {
    if (!formData.name.trim()) {
      setError('Please enter your name first');
      return;
    }

    setError('');
    setGithubLoading(true);
    
    try {
      console.log('Starting GitHub signup for:', formData.name, 'with role:', formData.role);
      
      // Store the name and role in localStorage so we can use it after redirect
      localStorage.setItem('gittalent_signup_name', formData.name);
      localStorage.setItem('gittalent_signup_role', formData.role);
      
      // Call signInWithGitHub which will handle the redirect to GitHub App installation
      await signInWithGitHub();
      // Navigation will be handled by the redirect
    } catch (error: any) {
      console.error('GitHub signup error:', error);
      setError(error.message || 'An error occurred with GitHub signup');
      setTimeout(() => {
        setGithubLoading(false);
      }, 500);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 dark:from-dark-background dark:via-gray-900/30 dark:to-blue-900/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-3 mb-8">
            <img 
              src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/sign/logo/GitTalentLogo%20(2).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNzQ0ZjQ0OC0yOTg1LTQyNmYtYWVmMy1lYmVmMTRlZGRmNWIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL0dpdFRhbGVudExvZ28gKDIpLnBuZyIsImlhdCI6MTc1MTMxNzQ1OSwiZXhwIjoxNzgyODUzNDU5fQ.PK6RssY3w4Sqwr6wc2AlFy7OwRyq4iMTmxAH1MMaKvs"
              alt="GitTalent"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hidden">
              <GitBranch className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-black text-gray-900 dark:text-dark-text">GitTalent</span>
          </Link>
          <h2 className="text-3xl font-black text-gray-900 dark:text-dark-text mb-3">
            Create your account
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              Sign in here
            </Link>
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 dark:border-dark-border/50 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 rounded-2xl p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300 mr-3" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                </div>
                {error && error.includes('session') && (
                  <div className="mt-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium flex items-center"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh page to try again
                    </button>
                  </div>
                )}
              </div>
            )}

            {success && (
              <div className="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-500/50 rounded-2xl p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300 mr-3" />
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">{success}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-5">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  I am a
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={loading || githubLoading}
                    onClick={() => setFormData(prev => ({ ...prev, role: 'developer' }))}
                    className={`flex items-center justify-center p-4 rounded-2xl border-2 transition-all disabled:opacity-50 ${
                      formData.role === 'developer'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Code className="w-5 h-5 mr-2" />
                    <span className="font-semibold">Developer</span>
                  </button>
                  <button
                    type="button"
                    disabled={loading || githubLoading}
                    onClick={() => setFormData(prev => ({ ...prev, role: 'recruiter' }))}
                    className={`flex items-center justify-center p-4 rounded-2xl border-2 transition-all disabled:opacity-50 ${
                      formData.role === 'recruiter'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Users className="w-5 h-5 mr-2" />
                    <span className="font-semibold">Recruiter</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Full name *
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    disabled={loading || githubLoading}
                    className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-dark-border placeholder-gray-500 text-gray-900 dark:text-dark-text rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-dark-card"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {formData.role === 'developer' ? (
                // For developers, show GitHub signup option only
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-dark-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white dark:bg-dark-card text-gray-500 dark:text-gray-400 font-medium">Sign up with GitHub</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGitHubSignUp}
                    disabled={githubLoading || !formData.name.trim() || loading}
                    className={`w-full flex items-center justify-center px-6 py-4 border-2 rounded-2xl font-bold transition-all duration-300 group ${
                      !formData.name.trim() || loading
                        ? 'border-gray-200 dark:border-dark-border text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
                        : 'border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
                    }`}
                  >
                    {githubLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 dark:border-dark-text mr-3"></div>
                        Connecting to GitHub...
                      </div>
                    ) : (
                      <>
                        <Github className={`w-5 h-5 mr-3 transition-transform ${!formData.name.trim() || loading ? '' : 'group-hover:scale-110'}`} />
                        Continue with GitHub
                      </>
                    )}
                  </button>
                  
                  {!formData.name.trim() && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center font-medium">
                      ⚠️ Please enter your name above to continue with GitHub
                    </p>
                  )}
                  
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                    <p>Developers must sign up with GitHub to verify their identity and sync their coding activity.</p>
                  </div>
                </div>
              ) : (
                // For recruiters, show email/password signup form
                <>
                  {/* Email Input */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Email address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        disabled={loading || githubLoading}
                        className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-dark-border placeholder-gray-500 text-gray-900 dark:text-dark-text rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-dark-card"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="company_name" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Company name *
                    </label>
                    <div className="relative">
                      <Building className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="company_name"
                        name="company_name"
                        type="text"
                        required
                        disabled={loading || githubLoading}
                        className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-dark-border placeholder-gray-500 text-gray-900 dark:text-dark-text rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-dark-card"
                        placeholder="Enter your company name"
                        value={formData.company_name}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={loading || githubLoading}
                        className="appearance-none relative block w-full pl-12 pr-12 py-4 border border-gray-300 dark:border-dark-border placeholder-gray-500 text-gray-900 dark:text-dark-text rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-dark-card"
                        placeholder="Create a strong password (min 6 characters)"
                        value={formData.password}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        disabled={loading || githubLoading}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading || githubLoading}
                      className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-2xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          Creating account...
                        </div>
                      ) : (
                        'Create account'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {formData.role === 'recruiter' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-500/50 rounded-2xl p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-400 dark:text-yellow-300 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Approval Required</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Recruiter accounts require admin approval before you can access the platform. 
                      You'll be notified once your account is approved.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            By creating an account, you agree to our{' '}
            <a href="#" className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};