// src/pages/PublicDeveloperProfile.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // MODIFIED: Added useMemo
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Loader,
  Github,
  Mail,
  MapPin,
  ExternalLink,
  Linkedin,
  Globe,
  Star,
  Award,
} from 'lucide-react';
import { Developer, PortfolioItem, Endorsement } from '../types';
import { RealGitHubChart } from '../components/GitHub/RealGitHubChart';
import { GitHubUserActivityDetails } from '../components/GitHub/GitHubUserActivityDetails';
import { PortfolioManager } from '../components/Portfolio/PortfolioManager';
import EndorsementDisplay from '../components/EndorsementDisplay';
import { fetchEndorsementsForDeveloper } from '../lib/endorsementUtils';

// Define valid tabs for the public profile
const validTabs = ['profile', 'portfolio', 'github-activity', 'endorsements'];

export const PublicDeveloperProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [gitHubData, setGitHubData] = useState<any>(null);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState<string | null>(null);

  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(true);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);

  // NEW: State for active tab, default to 'profile'
  const [activeTab, setActiveTab] = useState<(typeof validTabs)[number]>('profile');

  const fetchDeveloperAndData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGitHubData(null);
    setGithubLoading(true);
    setGithubError(null);
    setEndorsements([]);
    setIsLoadingEndorsements(true);
    setEndorsementError(null);

    try {
      const { data: devData, error: devError } = await supabase
        .from('developers')
        .select('*, user:users(name, email, avatar_url)')
        .eq('public_profile_slug', slug)
        .eq('public_profile_enabled', true)
        .single();

      if (devError) {
        if (devError.code === 'PGRST116') {
          setError('Developer profile not found or is private.');
        } else {
          setError(`Error fetching developer profile: ${devError.message}`);
        }
        setIsLoading(false);
        setGithubLoading(false);
        setIsLoadingEndorsements(false);
        return;
      }
      if (!devData) {
        setError('Developer profile not found or is private.');
        setIsLoading(false);
        setGithubLoading(false);
        setIsLoadingEndorsements(false);
        return;
      }

      setDeveloper(devData as Developer);

      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('developer_id', devData.user_id)
        .order('created_at', { ascending: false });

      if (portfolioError) {
        console.error('Error fetching portfolio items:', portfolioError);
      } else {
        setPortfolioItems(portfolioData || []);
      }

      if (devData.github_handle) {
        try {
          const response = await fetch(`${import.meta.env.VITE_FUNCTIONS_URL}/get-github-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Note: Public profiles usually don't send auth tokens to backend functions
              // unless the function is specifically secured to allow public access.
              // If your get-github-data function requires auth, it might fail here
              // for public users unless it's designed to be publicly accessible or
              // uses a different API key.
              'Authorization': `Bearer ${supabase.auth.getSession() ? (await supabase.auth.getSession())?.access_token : ''}`
            },
            body: JSON.stringify({
              githubHandle: devData.github_handle,
              installationId: devData.github_installation_id,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch GitHub data: ${response.status} ${response.statusText} - ${errorText}`);
          }
          const data = await response.json();
          setGitHubData(data);
        } catch (gitErr: any) {
          setGithubError(gitErr.message || 'Failed to fetch GitHub data');
          console.error("Error fetching GitHub data:", gitErr);
        } finally {
          setGithubLoading(false);
        }
      } else {
        setGithubLoading(false);
      }

      const fetchedEndorsements = await fetchEndorsementsForDeveloper(devData.user_id, true);
      if (fetchedEndorsements) {
        setEndorsements(fetchedEndorsements);
      } else {
        setEndorsementError("Failed to load endorsements.");
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setGithubLoading(false);
    } finally {
      setIsLoading(false);
      setIsLoadingEndorsements(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchDeveloperAndData();
  }, [fetchDeveloperAndData]);

  // Derive display names and URLs once developer data is available
  const displayName = useMemo(() => developer?.user?.name || developer?.name || 'Developer', [developer]);
  const avatarUrl = useMemo(() => developer?.user?.avatar_url || developer?.profile_pic_url, [developer]);


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader className="animate-spin h-10 w-10 text-blue-500" />
        <p className="ml-3 text-gray-600">Loading profile...</p>
      </div>
    );
  }

  if (error || !developer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-8 text-center">
        <Award className="h-20 w-20 text-gray-400 mb-6" />
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Profile Not Found or Private</h1>
        <p className="text-lg text-gray-600 mb-6">{error || 'The developer profile you are looking for does not exist or is not set to public.'}</p>
        <p className="text-sm text-gray-500">Please check the URL or contact the developer if you believe this is an error.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg p-6 md:p-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-6 sm:space-y-0 sm:space-x-8 pb-6 border-b border-gray-200 mb-6">
          <img src={avatarUrl || '/path/to/default-avatar.png'} alt={displayName} className="w-32 h-32 rounded-full object-cover border-4 border-blue-200 shadow-md" />
          <div className="text-center sm:text-left">
            <h1 className="text-4xl font-extrabold text-gray-900">{displayName}</h1>
            {developer.title && <p className="text-xl text-blue-600 font-semibold mt-1">{developer.title}</p>}
            <div className="flex flex-wrap justify-center sm:justify-start items-center space-x-4 mt-3 text-gray-600 text-sm">
              {developer.location && (
                <span className="flex items-center">
                  <MapPin size={18} className="mr-1 text-gray-500" /> {developer.location}
                </span>
              )}
              {developer.email && (
                <a href={`mailto:${developer.email}`} className="flex items-center hover:text-blue-700 transition-colors">
                  <Mail size={18} className="mr-1 text-gray-500" /> {developer.email}
                </a>
              )}
              {developer.github_handle && (
                <a href={`https://github.com/${developer.github_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-700 transition-colors">
                  <Github size={18} className="mr-1 text-gray-500" /> {developer.github_handle}
                </a>
              )}
              {developer.linkedin_url && (
                <a href={developer.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-700 transition-colors">
                  <Linkedin size={18} className="mr-1 text-gray-500" /> LinkedIn
                </a>
              )}
              {developer.website_url && (
                <a href={developer.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-700 transition-colors">
                  <Globe size={18} className="mr-1 text-gray-500" /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
            {validTabs.map((tabName) => (
              <button
                key={tabName}
                onClick={() => setActiveTab(tabName)}
                className={`whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                  activeTab === tabName ? 'border-blue-600 text-blue-700 bg-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tabName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'profile' && (
            <>
              {developer.bio && (
                <section className="mt-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">About Me</h2>
                  <p className="text-gray-700 leading-relaxed">{developer.bio}</p>
                </section>
              )}

              {developer.skills?.length > 0 && (
                <section className="mt-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Skills & Technologies</h2>
                  <div className="flex flex-wrap gap-3">
                    {developer.skills.map(skill => (
                      <span key={skill} className="px-4 py-2 bg-blue-100 text-blue-800 font-medium rounded-full text-base">
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {(!developer.bio && !developer.skills?.length) && (
                <p className="text-gray-500 italic mt-6">This developer has not provided public profile details yet.</p>
              )}
            </>
          )}

          {activeTab === 'portfolio' && (
            <section className="mt-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Portfolio</h2>
              <PortfolioManager
                developerId={developer.user_id}
                isEditable={false}
                itemsPerPage={5} // Adjust as needed
              />
              {portfolioItems.length === 0 && !isLoading && (
                  <p className="text-gray-500 italic">No public portfolio items yet.</p>
              )}
            </section>
          )}

          {activeTab === 'github-activity' && (
            <section className="mt-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">GitHub Activity</h2>
              <div className="flex flex-col lg:flex-row gap-6">
                {githubLoading ? (
                  <div className="flex items-center justify-center h-48 w-full">
                    <Loader className="animate-spin h-8 w-8 text-blue-600" />
                    <p className="ml-3 text-gray-600">Loading GitHub data...</p>
                  </div>
                ) : githubError ? (
                  <div className="text-center text-red-600 w-full p-8 border rounded-lg bg-red-50">
                    <Github className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p>Error loading GitHub data: {githubError}</p>
                    <p className="text-sm text-red-500 mt-2">The GitHub app may not be installed or configured for this user.</p>
                  </div>
                ) : developer.github_handle && gitHubData?.user ? (
                  <>
                    <div className="lg:w-2/5 flex-shrink-0">
                      <div className="bg-white p-4 rounded-lg shadow-md border">
                        <RealGitHubChart
                          githubHandle={developer.github_handle}
                          gitHubData={gitHubData}
                          loading={false}
                          error={null}
                          isGitHubAppInstalled={!!developer.github_installation_id}
                          className="w-full"
                          displayMode="public" // Use 'public' if you have a specific public chart display
                        />
                      </div>
                    </div>
                    <div className="lg:w-3/5 flex-grow bg-white p-4 rounded-lg shadow-md border">
                      <GitHubUserActivityDetails gitHubData={gitHubData} />
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 w-full p-8 border rounded-lg bg-gray-50">
                    <Github className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p>No public GitHub data available for this developer.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'endorsements' && (
            <section className="mt-6">
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
