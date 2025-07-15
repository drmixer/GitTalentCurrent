import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useDeveloperProfile } from '@/hooks/useDeveloperProfile';
import { useGitHub } from '@/hooks/useGitHub';
import {
  DeveloperProfileDetails,
  PortfolioManager,
  RealGitHubChart
} from '../components';
import {
  ArrowLeft,
  Loader,
  AlertCircle,
  User,
  Code,
  Briefcase
} from 'lucide-react';
import { Developer } from '../types';

export const PublicDeveloperProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const { developer, loading: profileLoading, error: devError } = useDeveloperProfile(userId || '');
  const { gitHubData, loading: githubLoading, error: githubError, refreshGitHubData } = useGitHub();

  const [activeTab, setActiveTab] = useState<'profile' | 'portfolio' | 'github'>('profile');

  useEffect(() => {
    if (developer?.github_handle) {
      refreshGitHubData(developer.github_handle);
    }
  }, [developer?.github_handle, refreshGitHubData]);

  useEffect(() => {
    const fetchUserIdBySlug = async () => {
      if (!slug) {
        setProfileError("No profile slug provided.");
        setInitialLoading(false);
        return;
      }

      setInitialLoading(true);
      const { data, error } = await supabase
        .from('developers')
        .select('user_id')
        .eq('public_profile_slug', slug)
        .single();

      if (error || !data) {
        console.error('Error fetching user_id by slug:', error);
        setProfileError('Developer profile not found.');
        setUserId(null);
      } else {
        setUserId(data.user_id);
        setProfileError('');
      }
      setInitialLoading(false);
    };

    fetchUserIdBySlug();
  }, [slug]);

  if (initialLoading || (profileLoading && !developer)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading developer profile...</p>
        </div>
      </div>
    );
  }

  if (profileError || devError || !developer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">
            {profileError || devError || "We couldn't find the developer profile you're looking for."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 mb-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-6 mb-6 md:mb-0">
              {developer.avatar_url ? (
                <img
                  src={developer.avatar_url}
                  alt={developer.name || developer.github_username}
                  className="w-24 h-24 rounded-2xl object-cover shadow-lg border-4 border-white"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg border-4 border-white">
                  {(developer.name || developer.github_username)?.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-black mb-2">
                  {developer.name || developer.github_username}
                </h1>
                <div className="flex items-center space-x-4 text-blue-100">
                  <div className="flex items-center">
                    <Code className="w-4 h-4 mr-1" />
                    {developer.preferred_title || 'No title specified'}
                  </div>
                  {developer.location && (
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      {developer.location}
                    </div>
                  )}
                  {typeof developer.experience_years === 'number' && (
                    <div className="flex items-center">
                      <Briefcase className="w-4 h-4 mr-1" />
                      {developer.experience_years} years experience
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${developer.availability ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${developer.availability ? 'bg-white' : 'bg-gray-500'}`}></div>
                {developer.availability ? 'Available for hire' : 'Not available'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-2xl shadow-sm border border-gray-100 mb-0">
          <div className="px-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
                { id: 'github', label: 'GitHub Activity', icon: Code },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'profile' | 'portfolio' | 'github')}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                    <Icon className={`mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 border-t-0 p-6">
          {activeTab === 'profile' && (
            <DeveloperProfileDetails developer={developer} />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioManager developerId={developer.user_id} isEditable={false} />
          )}
          {activeTab === 'github' && developer.github_username && (
            <RealGitHubChart
              githubHandle={developer.github_username}
              gitHubData={gitHubData}
              loading={githubLoading}
              error={githubError}
              className="w-full"
              displayMode="dashboardSnippet"
              isGitHubAppInstalled={!!developer?.github_installation_id}
            />
          )}
        </div>
      </div>
    </div>
  );
};