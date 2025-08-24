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
  GitHubUserActivityDetails
} from '../components';
import {
  ArrowLeft,
  Loader,
  AlertCircle,
  User,
  Code,
  Briefcase,
  Star,
  Github,
  Menu,
  X
} from 'lucide-react';
import { Developer, Endorsement } from '../types';
import EndorsementDisplay from '../components/EndorsementDisplay';
import fetchEndorsementsForDeveloper from '../lib/endorsementUtils';

export const PublicDeveloperProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Original hooks for developer and GitHub data
  const { developer, user, loading: profileLoading, error: devError } = useDeveloperProfile(userId || '');
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
        .select('user_id, public_profile_enabled')
        .eq('public_profile_slug', slug)
        .single();

      if (error || !data || !data.public_profile_enabled) {
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
    if (!profileLoading && developer) {
      loadEndorsements();
    }
  }, [developer, profileLoading]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'github', label: 'GitHub', icon: Code },
    { id: 'endorsements', label: 'Endorsements', icon: Star },
  ];

  const handleTabChange = (tabId: 'profile' | 'portfolio' | 'github' | 'endorsements') => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  if (initialLoading || (profileLoading && !developer)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
          <p className="text-gray-600 mb-6 text-sm sm:text-base">
            {profileError || devError || "We couldn't find the developer profile you're looking for."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm sm:text-base"
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8 lg:py-12">
        <div className="mb-4 sm:mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Mobile-optimized header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-8 text-white shadow-xl">
          <div className="flex flex-col space-y-4 sm:space-y-6">
            {/* Profile section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-6">
              {developer.profile_pic_url ? (
                <img
                  src={developer.profile_pic_url}
                  alt={user?.name || developer.github_handle}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl object-cover shadow-lg border-3 sm:border-4 border-white flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-lg border-3 sm:border-4 border-white flex-shrink-0">
                  {(user?.name || developer.github_handle)?.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <div className="text-center sm:text-left flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black mb-2 break-words">
                  {user?.name || developer.github_handle}
                </h1>
                <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-2 sm:space-y-0 sm:space-x-4 text-blue-100 text-sm sm:text-base">
                  <div className="flex items-center flex-shrink-0">
                    <Code className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">{developer.preferred_title || 'No title specified'}</span>
                  </div>
                  {developer.location && (
                    <div className="flex items-center flex-shrink-0">
                      <User className="w-4 h-4 mr-1 flex-shrink-0" />
                      <span className="truncate">{developer.location}</span>
                    </div>
                  )}
                  {typeof developer.experience_years === 'number' && (
                    <div className="flex items-center flex-shrink-0">
                      <Briefcase className="w-4 h-4 mr-1 flex-shrink-0" />
                      <span>{developer.experience_years} years</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Availability badge */}
            <div className="flex justify-center sm:justify-end">
              <span className={`inline-flex items-center px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold ${developer.availability ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${developer.availability ? 'bg-white' : 'bg-gray-500'}`}></div>
                {developer.availability ? 'Available for hire' : 'Not available'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile-optimized tabs */}
        <div className="bg-white rounded-t-2xl shadow-sm border border-gray-100 mb-0">
          {/* Desktop tab navigation */}
          <div className="hidden sm:block px-4 lg:px-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 lg:space-x-8 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as 'profile' | 'portfolio' | 'github' | 'endorsements')}
                    className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap ${
                      activeTab === tab.id 
                        ? 'border-blue-500 text-blue-600 bg-blue-50' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Mobile tab navigation */}
          <div className="sm:hidden border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-4">
              <h2 className="text-lg font-bold text-gray-800 capitalize">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h2>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {/* Mobile dropdown menu */}
            {mobileMenuOpen && (
              <div className="border-t border-gray-100 bg-gray-50">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id as 'profile' | 'portfolio' | 'github' | 'endorsements')}
                      className={`w-full flex items-center px-4 py-3 text-left ${
                        activeTab === tab.id 
                          ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-500' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className={`mr-3 h-5 w-5 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 border-t-0 p-3 sm:p-4 lg:p-6">
          {activeTab === 'profile' && (
            <DeveloperProfileDetails developerId={developer.user_id} />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioManager developerId={developer.user_id} isEditable={false} />
          )}
          {activeTab === 'github' && developer.github_handle && (
            developer?.github_installation_id ? (
              <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                {/* Mobile-first GitHub Chart */}
                <div className="w-full lg:w-2/5 lg:flex-shrink-0">
                  <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-md border">
                    <RealGitHubChart
                      githubHandle={developer.github_handle}
                      gitHubData={gitHubData}
                      loading={githubLoading}
                      error={githubError}
                      className="w-full"
                      displayMode="dashboardSnippet"
                      isGitHubAppInstalled={!!developer?.github_installation_id}
                    />
                  </div>
                </div>

                {/* Mobile-optimized GitHub Details */}
                <div className="w-full lg:w-3/5 lg:flex-grow bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-md border">
                  {githubLoading && (
                    <div className="flex flex-col items-center justify-center h-32 sm:h-64">
                      <Loader className="animate-spin h-8 w-8 sm:h-10 sm:w-10 text-blue-500 mb-4" />
                      <p className="text-gray-600 text-sm sm:text-base">Loading GitHub activity...</p>
                    </div>
                  )}
                  {!githubLoading && githubError && (
                    <div className="text-center py-6 sm:py-10 px-3 sm:px-6 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-red-500 mx-auto mb-3" />
                      <h3 className="text-base sm:text-lg font-semibold text-red-700">Error Loading GitHub Details</h3>
                      <p className="text-red-600 mt-2 text-xs sm:text-sm">
                        {typeof githubError === 'string' ? githubError : (githubError as Error)?.message || 'An unknown error occurred.'}
                      </p>
                    </div>
                  )}
                  {!githubLoading && !githubError && gitHubData?.user && (
                    <GitHubUserActivityDetails gitHubData={gitHubData} />
                  )}
                  {!githubLoading && !githubError && !gitHubData?.user && (
                    <div className="text-center py-6 sm:py-10 px-3 sm:px-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <Github className="w-8 h-8 sm:w-12 sm:h-12 text-yellow-500 mx-auto mb-3" />
                      <h3 className="text-base sm:text-lg font-semibold">No GitHub Data Available</h3>
                      <p className="text-gray-600 mt-2 text-xs sm:text-sm">Could not retrieve public GitHub activity for this profile.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 sm:p-8">
                <Github className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4 sm:mb-6" />
                <h3 className="text-xl sm:text-2xl font-semibold">GitHub App Not Connected</h3>
                <p className="mt-2 text-base sm:text-lg text-gray-600">
                  This developer has linked their GitHub handle but has not yet connected the GitHub App to display activity.
                </p>
              </div>
            )
          )}
          {activeTab === 'endorsements' && (
            <section className="mt-2 sm:mt-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Endorsements</h2>
              <EndorsementDisplay
                endorsements={endorsements}
                isLoading={isLoadingEndorsements}
                error={endorsementError}
                canManageVisibility={false}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
