import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Lock, AlertCircle, Eye, EyeOff, Github, Loader, GitBranch, RefreshCw } from 'lucide-react';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const { signIn, signInWithGitHub, user, loading: authLoading, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      console.log('✅ User authenticated, redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // If there's an auth error from the context, show it
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      // Navigation will happen via useEffect when auth state changes
      console.log('✅ Sign in successful, waiting for auth state change...');
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setError('');
    setGithubLoading(true);

    try {
      await signInWithGitHub();
      // Navigation will happen via redirect URL
    } catch (error: any) {
      console.error('GitHub login error:', error);
      setError(error.message || 'An error occurred with GitHub login');
      setTimeout(() => {
        setGithubLoading(false);
      }, 500);
    }
  };

  // Show loading state while checking authentication status
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-3 mb-8">
            <img 
              src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/sign/logo/GitTalentLogo%20(2).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNzQ0ZjQ0OC0yOTg1LTQyNmYtYWVmMy1lYmVmMTRlZGRmNWIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL0dpdFRhbGVudExvZ28gKDIpLnBuZyIsImlhdCI6MTc1MTMxNzQ1OSwiZXhwIjoxNzgyODUzNDU5fQ.PK6RssY3w4Sqwr6wc2AlFy7OwRyq4iMTmxAH1MMaKvs"
              alt="GitTalent"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                // Fallback to icon if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center hidden">
              <GitBranch className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black text-gray-900">GitTalent</span>
          </Link>
          <h2 className="text-3xl font-black text-gray-900 mb-3">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-semibold text-blue-600 hover:text-blue-500 transition-colors"
            >
              Sign up for free
            </Link>
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8">
          {/* GitHub Sign In Button */}
          <button
            onClick={handleGitHubSignIn}
            disabled={githubLoading || loading}
            className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-300 rounded-2xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 font-bold mb-6 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {githubLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-3"></div>
                Connecting to GitHub...
              </div>
            ) : (
              <>
                <Github className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                Continue with GitHub
              </>
            )}
          </button>
          
          <p className="text-center text-sm text-blue-600 mb-6">
            <Github className="w-4 h-4 inline mr-1" />
            Developers: Sign in with GitHub to access your account
          </p>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">Or continue with email</span>
            </div>
            {error && error.includes('session') && (
              <div className="mt-2">
                <button
                  onClick={() => window.location.reload()}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh page to try again
                </button>
              </div>
            )}
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                  Email address
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
                    className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    disabled={loading || githubLoading}
                    className="appearance-none relative block w-full pl-12 pr-12 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={loading || githubLoading}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
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
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  disabled={loading || githubLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                  Forgot password?
                </a>
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
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            By signing in, you agree to our{' '}
            <a href="#" className="font-semibold text-blue-600 hover:text-blue-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="font-semibold text-blue-600 hover:text-blue-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};