import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GitBranch, Code } from 'lucide-react';
import { DeveloperProfileForm } from '../Profile/DeveloperProfileForm';

export const DeveloperOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // CRITICAL DEBUG: Log onboarding component state
  useEffect(() => {
    console.log('🚀 [ONBOARDING] ===== DEVELOPER ONBOARDING COMPONENT MOUNTED =====');
    console.log('🔍 [ONBOARDING] User data:', {
      hasUser: !!user,
      userId: user?.id,
      userMetadata: user?.user_metadata ? {
        keys: Object.keys(user.user_metadata),
        user_name: user.user_metadata.user_name,
        login: user.user_metadata.login,
        bio: `"${user.user_metadata.bio || ''}"`,
        location: `"${user.user_metadata.location || ''}"`,
        bio_length: user.user_metadata.bio?.length || 0,
        location_length: user.user_metadata.location?.length || 0,
        avatar_url: user.user_metadata.avatar_url ? 'present' : 'missing',
        github_installation_id: user.user_metadata.github_installation_id ? 'present' : 'missing',
        installation_id: user.user_metadata.installation_id ? 'present' : 'missing'
      } : 'none'
    });
  }, [user]);

  const handleSuccess = () => {
    console.log('🎉 [ONBOARDING] Profile form success - navigating to dashboard');
    navigate('/developer', { replace: true });
  };

  // CRITICAL DEBUG: Prepare initial data with comprehensive logging
  const initialDataForForm = {
    github_handle: user?.user_metadata?.user_name || user?.user_metadata?.login || '',
    bio: user?.user_metadata?.bio || '',
    location: user?.user_metadata?.location || '',
    profile_pic_url: user?.user_metadata?.avatar_url || '',
    github_installation_id: user?.user_metadata?.github_installation_id || user?.user_metadata?.installation_id || ''
  };

  console.log('📝 [ONBOARDING] Initial data for form:', {
    github_handle: `"${initialDataForForm.github_handle}"`,
    github_handle_length: initialDataForForm.github_handle.length,
    bio: `"${initialDataForForm.bio}"`,
    bio_length: initialDataForForm.bio.length,
    location: `"${initialDataForForm.location}"`,
    location_length: initialDataForForm.location.length,
    profile_pic_url: initialDataForForm.profile_pic_url ? 'present' : 'missing',
    github_installation_id: initialDataForForm.github_installation_id ? 'present' : 'missing'
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Code className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4">
            Complete Your Developer Profile
          </h1>
          <p className="text-xl text-gray-600 max-w-lg mx-auto">
            Welcome! Let's set up your developer profile to start receiving job opportunities.
          </p>
        </div>

        {/* CRITICAL DEBUG: Onboarding debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm">
            <details>
              <summary className="font-medium text-purple-800 cursor-pointer">🔍 Onboarding Debug Info (Click to expand)</summary>
              <div className="mt-2 text-purple-600 space-y-1">
                <p><strong>Component:</strong> DeveloperOnboarding</p>
                <p><strong>Has User:</strong> {user ? 'Yes' : 'No'}</p>
                <p><strong>User ID:</strong> {user?.id || 'Not available'}</p>
                <p><strong>Initial Bio:</strong> "{initialDataForForm.bio}" (length: {initialDataForForm.bio.length})</p>
                <p><strong>Initial Location:</strong> "{initialDataForForm.location}" (length: {initialDataForForm.location.length})</p>
                <p><strong>Initial GitHub Handle:</strong> "{initialDataForForm.github_handle}" (length: {initialDataForForm.github_handle.length})</p>
                <p><strong>Has GitHub Installation ID:</strong> {initialDataForForm.github_installation_id ? 'Yes' : 'No'}</p>
                <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
              </div>
            </details>
          </div>
        )}

        {/* Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8">
          <DeveloperProfileForm 
            initialData={initialDataForForm}
            onSuccess={handleSuccess}
            isOnboarding={true}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            Your profile information helps us match you with the best job opportunities.
            You can always update this information later from your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
};
