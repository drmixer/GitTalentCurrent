import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GitBranch, Code } from 'lucide-react';
import { DeveloperProfileForm } from '../Profile/DeveloperProfileForm';

export const DeveloperOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/developer', { replace: true });
  };

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

        {/* Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8">
          <DeveloperProfileForm 
            initialData={{
              github_handle: user?.user_metadata?.user_name || '',
              bio: user?.user_metadata?.bio || '',
              location: user?.user_metadata?.location || '',
            }}
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