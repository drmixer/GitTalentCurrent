import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GitBranch, LogOut, User, MessageSquare, Briefcase, Menu, X, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { NotificationBadge } from '../Notifications/NotificationBadge';

export const Header = () => {
  const { user, userProfile, developerProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user && userProfile) {
      fetchUnreadCount();
    }
  }, [user, userProfile]);

  const fetchUnreadCount = async () => {
    try {
      if (!userProfile?.id) return;

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userProfile.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Header: Initiating sign out process...');
      await signOut();
      console.log('Header: Sign out completed, redirecting...');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      // Force navigation to login page if there's an error with sign out
      navigate('/login', { replace: true });
    }
  };

  const getDashboardPath = () => {
    if (!userProfile) return '/login';
    switch (userProfile.role) {
      case 'admin':
        return '/admin';
      case 'recruiter':
        return '/recruiter';
      case 'developer':
        return '/developer';
      default:
        return '/dashboard';
    }
  };

  const isPublicPage = ['/', '/features', '/pricing', '/about', '/contact', '/login', '/signup'].includes(location.pathname);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Format display name for developers
  const getDisplayName = () => {
    if (userProfile?.role === 'developer' && developerProfile?.github_handle) {
      return `${userProfile.name.split(' ')[0]} (${developerProfile.github_handle})`;
    }
    return userProfile?.name || '';
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-48">
          {/* Logo */}
          <Link to="/" className="flex items-center group py-8">
            <div className="h-32 w-auto flex items-center justify-center group-hover:scale-105 transition-all duration-300">
              <img 
                src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/sign/logo/GitTalentLogo%20(2).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNzQ0ZjQ0OC0yOTg1LTQyNmYtYWVmMy1lYmVmMTRlZGRmNWIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL0dpdFRhbGVudExvZ28gKDIpLnBuZyIsImlhdCI6MTc1MTMxNzQ1OSwiZXhwIjoxNzgyODUzNDU5fQ.PK6RssY3w4Sqwr6wc2AlFy7OwRyq4iMTmxAH1MMaKvs"
                alt="GitTalent Logo"
                className="h-full w-auto object-contain"
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
            </div>
          </Link>

          {/* Desktop Navigation */}
          {isPublicPage ? (
            <nav className="hidden md:flex items-center space-x-8">
              {[
                { label: 'Features', id: 'features' },
                { label: 'Pricing', id: 'pricing' },
                { label: 'About', id: 'about' },
                { label: 'Contact', id: 'contact' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 hover:scale-105"
                >
                  {item.label}
                </button>
              ))}
              
              {user ? (
                <div className="flex items-center space-x-4">
                  {userProfile?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    to={getDashboardPath()}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-bold shadow-lg hover:shadow-xl hover:scale-105 duration-300"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 px-4 py-2"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-bold shadow-lg hover:shadow-xl hover:scale-105 duration-300"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </nav>
          ) : (
            user && userProfile && (
              <nav className="hidden md:flex items-center space-x-6">
                <Link
                  to={getDashboardPath()}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors font-medium px-3 py-2 rounded-lg hover:bg-gray-100"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                <div className="flex items-center space-x-4">
                  <Link
                    to={`${getDashboardPath()}?tab=profile`} // Changed to navigate to profile tab
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors font-medium px-3 py-2 rounded-lg hover:bg-gray-100"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm font-semibold">{getDisplayName()}</span>
                  </Link>
                  <Link
                    to={`${getDashboardPath()}?tab=messages`} // Changed to navigate to messages tab
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors font-medium px-3 py-2 rounded-lg hover:bg-gray-100 relative"
                  >
                    <NotificationBadge />
                    <Bell className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100 flex items-center"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </nav>
            )
          )}

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-48 left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
            <div className="px-4 py-6 space-y-4">
              {isPublicPage ? (
                <>
                  {[
                    { label:  'Features', id: 'features' },
                    { label: 'Pricing', id: 'pricing' },
                    { label: 'About', id: 'about' },
                    { label: 'Contact', id: 'contact' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="block w-full text-left text-gray-600 hover:text-gray-900 font-medium py-2"
                    >
                      {item.label}
                    </button>
                  ))}
                  
                  {user ? (
                    <div className="pt-4 border-t border-gray-200 space-y-4">
                      <Link
                        to={getDashboardPath()}
                        className="block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-bold text-center"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left text-gray-600 hover:text-gray-900 py-2 flex items-center"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-gray-200 space-y-4">
                      <Link
                        to="/login"
                        className="block text-gray-600 hover:text-gray-900 font-medium py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Login
                      </Link>
                      <Link
                        to="/signup"
                        className="block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-bold text-center"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Sign Up
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                user && userProfile && (
                  <div className="space-y-4">
                    <Link
                      to={getDashboardPath()}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Briefcase className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      <span>{getDisplayName()}</span>
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 py-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};