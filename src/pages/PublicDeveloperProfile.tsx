// src/pages/PublicDeveloperProfile.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useDeveloperProfile } from '@/hooks/useDeveloperProfile';
import { usePublicGitHub } from '@/hooks/usePublicGitHub';
import {
  DeveloperProfileDetails,
  PortfolioManager,
  RealGitHubChart,
  GitHubUserActivityDetails // <-- ADDED THIS IMPORT
} from '../components';
import {
  ArrowLeft,
  Loader,
  AlertCircle,
  User,
  Code,
  Briefcase,
  Star,
  Github // Ensure Github icon is imported for the "not connected" state
} from 'lucide-react';
import { Developer, Endorsement } from '../types';
import EndorsementDisplay from '../components/EndorsementDisplay';
import fetchEndorsementsForDeveloper from '../lib/endorsementUtils';

export const PublicDeveloperProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  // Original hooks for developer and GitHub data
  // Ensure useDeveloperProfile (in src/hooks/useDeveloperProfile.ts)
  // uses 'user:developers_user_id_fkey' in its select query.
  const { developer, user, loading: profileLoading, error: devError } = useDeveloperProfile(userId || '');
  // Ensure usePublicGitHub (in src/hooks/usePublicGitHub.ts)
  // calls 'github-proxy' and passes 'handle' not 'githubHandle'.
  const { gitHubData, loading: githubLoading, error: githubError } = usePublicGitHub(developer);

  // State for endorsements
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(true);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);

  // Corrected activeTab state to include 'endorsements'
  const [activeTab, setActiveTab] = useState<'profile' | 'portfolio' | 'github' | 'endorsements'>('profile');

  // Original logic to fetch userId by slug
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
        .select('user_id, public_profile_enabled') // Also select public_profile_enabled
        .eq('public_profile_slug', slug)
        .single();

      if (error || !data || !data.public_profile_enabled) { // Check if profile is enabled
        console.error('Error fetching user_id by slug:', error);
        setProfileError('Developer profile not found or is private.');
        setUserId(null);
      } else {
        setUserId(data.user_id);
        setProfileError('');
      }
      setInitialLoading(false);
    };

    fetchUserIdBySlug();
  }, [slug]);

  // New effect to fetch endorsements once developer data is available
  useEffect(() => {
    const loadEndorsements = async () => {
      if (developer?.user_id) {
        setIsLoadingEndorsements(true);
        setEndorsementError(null);
        try {
          // Pass true for `isPublic` to fetch only public endorsements
          const fetchedEndorsements = await fetchEndorsementsForDeveloper(developer.user_id, true);
          if (fetchedEndorsements) {
            setEndorsements(fetchedEndorsements);
          } else {
            setEndorsementError("Failed to load endorsements.");
          }
        } catch (err: any) {
          setEndorsementError(err.message || "An error occurred while loading endorsements.");
        } finally {
          setIsLoadingEndorsements(false);
        }
      }
    };
    if (!profileLoading && developer) { // Only attempt to load endorsements if developer data is loaded
      loadEndorsements();
    }
  }, [developer, profileLoading]); // Dependency on developer and profileLoading

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
      {/* Restored max-w-7xl for the main content wrapper */}
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
              {developer.profile_pic_url ? (
                <img
                  src={developer.profile_pic_url}
                  alt={user?.name || developer.github_handle}
                  className="w-24 h-24 rounded-2xl object-cover shadow-lg border-4 border-white"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg border-4 border-white">
                  {(user?.name || developer.github_handle)?.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-black mb-2">
                  {user?.name || developer.github_handle}
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
                { id: 'endorsements', label: 'Endorsements', icon: Star }, // Added Endorsements tab
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'profile' | 'portfolio' | 'github' | 'endorsements')}
                    className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm ${activeTab === tab.id ? 'border-blue-500 text-blue-600 bg-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
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
            // Using your original DeveloperProfileDetails component
            <DeveloperProfileDetails developerId={developer.user_id} />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioManager developerId={developer.user_id} isEditable={false} />
          )}
          {/* START: GitHub Activity Tab Content (Mirrored from DeveloperDashboard.tsx) */}
          {activeTab === 'github' && developer.github_handle && (
            developer?.github_installation_id ? (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Column: GitHub Chart */}
                <div className="lg:w-2/5 flex-shrink-0">
                  <div className="max-w-md mx-auto lg:mx-0 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                    <RealGitHubChart
                      githubHandle={developer.github_handle}
                      gitHubData={gitHubData}
                      loading={githubLoading}
                      error={githubError}
                      className="w-full"
                      displayMode="dashboardSnippet" // Keep this for the chart display
                      isGitHubAppInstalled={!!developer?.github_installation_id}
                    />
                  </div>
                </div>

                {/* Right Column: GitHub Details and States */}
                <div className="lg:w-3/5 flex-grow bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                  {githubLoading && (
                    <div className="flex flex-col items-center justify-center h-64">
                      <Loader className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                      <p className="text-gray-600">Loading GitHub activity...</p>
                    </div>
                  )}
                  {!githubLoading && githubError && (
                    <div className="text-center py-10 px-6 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-red-700">Error Loading GitHub Details</h3>
                      <p className="text-red-600 mt-2 text-sm">
                        {typeof githubError === 'string' ? githubError : (githubError as Error)?.message || 'An unknown error occurred.'}
                      </p>
                      {/* On a public profile, there's no "Re-check" button as the user can't fix it directly */}
                    </div>
                  )}
                  {!githubLoading && !githubError && gitHubData?.user && (
                    <GitHubUserActivityDetails gitHubData={gitHubData} />
                  )}
                  {!githubLoading && !githubError && !gitHubData?.user && (
                    <div className="text-center py-10 px-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <Github className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold">No GitHub Data Available</h3>
                      <p className="text-gray-600 mt-2 text-sm">Could not retrieve public GitHub activity for this profile.</p>
                      {/* On a public profile, there's no "Refresh" button as the visitor can't trigger it */}
                    </div>
                  )}
                </div>
              </div>
            ) : ( // This block handles the case where GitHub handle exists but app isn't connected
              <div className="text-center p-8">
                <Github className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                <h3 className="text-2xl font-semibold">GitHub App Not Connected</h3>
                <p className="mt-2 text-lg text-gray-600">
                  This developer has linked their GitHub handle but has not yet connected the GitHub App to display activity.
                </p>
              </div>
            )
          )}
          {/* END: GitHub Activity Tab Content */}
          {activeTab === 'endorsements' && (
            <section className="mt-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Endorsements</h2>
              <EndorsementDisplay
                endorsements={endorsements}
                isLoading={isLoadingEndorsements}
                error={endorsementError}
                canManageVisibility={false} // Public profile, so no management
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
