// src/pages/PublicDeveloperProfile.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Developer, Endorsement } from '../types'; // Added Endorsement type
import EndorsementDisplay from '../components/EndorsementDisplay'; // Component for endorsements
// CORRECTED: fetchEndorsementsForDeveloper is now a default import
import fetchEndorsementsForDeveloper from '../lib/endorsementUtils'; // Utility for fetching endorsements
import { Loader, Github, MessageCircle, Briefcase, Award, MapPin, DollarSign, Calendar, Zap, RefreshCcw, AlertCircle, Star, GitFork } from 'lucide-react'; // Added more icons
import { RealGitHubChart } from '../components/GitHub/RealGitHubChart'; // Import RealGitHubChart
import { formatNumber, calculateProfileStrength } from '../lib/utils'; // Import utility functions
import DOMPurify from 'dompurify'; // Import DOMPurify

export const PublicDeveloperProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>(); // Get the public_profile_slug from the URL
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gitHubData, setGitHubData] = useState<any>(null); // State for GitHub data
  const [gitHubLoading, setGitHubLoading] = useState(true); // Loading state for GitHub data
  const [gitHubError, setGitHubError] = useState<string | null>(null); // Error state for GitHub data
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [endorsementLoading, setEndorsementLoading] = useState(true);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);

  const fetchDeveloperData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: devError } = await supabase
        .from('developers')
        .select(`
          *,
          user:developers_user_id_fkey(name, email, profile_pic_url) // --- THIS LINE WAS CHANGED ---
        `)
        .eq('public_profile_slug', slug)
        .single();

      if (devError) {
        if (devError.code === 'PGRST116') { // No rows found
          setError("Developer profile not found.");
        } else {
          console.error("Error fetching developer profile:", JSON.stringify(devError, null, 2));
          setError("Failed to load developer profile.");
        }
        setDeveloper(null);
      } else if (data) {
        setDeveloper(data as Developer);
        // Recalculate and update profile strength
        const strength = calculateProfileStrength(data as Developer);
        if (strength !== data.profile_strength) {
          await supabase
            .from('developers')
            .update({ profile_strength: strength })
            .eq('user_id', data.user_id);
          setDeveloper(prev => prev ? { ...prev, profile_strength: strength } : null);
        }
      } else {
        setError("Developer profile not found.");
        setDeveloper(null);
      }
    } catch (err) {
      console.error("Unexpected error fetching developer profile:", err);
      setError("An unexpected error occurred.");
      setDeveloper(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchGitHubProfileData = useCallback(async (githubHandle: string, installationId: string | null) => {
    setGitHubLoading(true);
    setGitHubError(null);
    try {
      // Use the new endpoint for fetching GitHub data
      const { data, error } = await supabase.functions.invoke('get-github-profile-data', {
        body: JSON.stringify({ githubHandle, installationId }),
      });

      if (error) {
        console.error('Error fetching GitHub profile data:', error);
        setGitHubError(error.message || 'Failed to fetch GitHub data.');
        setGitHubData(null);
      } else {
        setGitHubData(data);
        // console.log("Fetched GitHub Data:", data);
      }
    } catch (err) {
      console.error('Unexpected error fetching GitHub profile data:', err);
      setGitHubError('An unexpected error occurred while fetching GitHub data.');
      setGitHubData(null);
    } finally {
      setGitHubLoading(false);
    }
  }, []);

  const fetchPublicEndorsements = useCallback(async (devId: string) => {
    setEndorsementLoading(true);
    setEndorsementError(null);
    try {
      // Pass 'true' for publicOnly to fetch only public endorsements
      const fetchedEndorsements = await fetchEndorsementsForDeveloper(devId, true);
      if (fetchedEndorsements) {
        setEndorsements(fetchedEndorsements);
      } else {
        setEndorsementError("Failed to load public endorsements.");
      }
    } catch (err) {
      console.error("Error fetching public endorsements:", err);
      setEndorsementError("An error occurred while loading public endorsements.");
    } finally {
      setEndorsementLoading(false);
    }
  }, []);

  useEffect(() => {
    if (slug) {
      fetchDeveloperData();
    }
  }, [slug, fetchDeveloperData]);

  useEffect(() => {
    if (developer && developer.github_handle) {
      fetchGitHubProfileData(developer.github_handle, developer.github_installation_id);
    }
    if (developer?.user_id) {
      fetchPublicEndorsements(developer.user_id);
    }
  }, [developer, fetchGitHubProfileData, fetchPublicEndorsements]);

  const sanitizedBio = developer?.bio ? DOMPurify.sanitize(developer.bio) : '';

  const renderSection = (title: string, content: React.ReactNode, icon: React.ElementType, isLoaded: boolean = true) => {
    if (!content && isLoaded) return null; // Don't render section if content is empty and loaded

    return (
      <div className="bg-gray-50 p-4 rounded-lg shadow-inner border border-gray-200">
        <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
          {React.createElement(icon, { className: "w-5 h-5 mr-2 text-blue-600" })}
          {title}
        </h3>
        {loading && !content ? (
          <div className="flex items-center text-gray-500 text-sm">
            <Loader className="animate-spin mr-2 w-4 h-4" /> Loading...
          </div>
        ) : content}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader className="animate-spin h-10 w-10 text-blue-500" />
        <p className="ml-3 text-lg text-gray-600">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-8 text-red-600">
        <AlertCircle className="h-12 w-12 mb-4" />
        <p className="font-semibold text-xl">Error: {error}</p>
        <p className="text-md mt-2">Please check the URL or try again later.</p>
      </div>
    );
  }

  if (!developer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-8 text-gray-600">
        <AlertCircle className="h-12 w-12 mb-4" />
        <p className="font-semibold text-xl">Profile Not Found</p>
        <p className="text-md mt-2">The developer profile you are looking for does not exist or is not public.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-8 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-6">
            <img
              src={developer.user?.profile_pic_url || `/api/placeholder/150/150`}
              alt={developer.user?.name || 'Developer'}
              className="w-28 h-28 rounded-full object-cover border-4 border-blue-300 shadow-md"
            />
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900">{developer.user?.name || 'Developer'}</h1>
              <p className="text-xl text-gray-700 font-semibold mt-1">{developer.title || 'Developer'}</p>
              <div className="flex items-center text-gray-600 text-sm mt-2">
                <MapPin className="w-4 h-4 mr-1" /> {developer.location || 'Location Not Specified'}
                <span className="mx-2">|</span>
                <Award className="w-4 h-4 mr-1" /> {developer.profile_strength || 0}% Profile Strength
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column (Main Info) */}
          <div className="md:col-span-2 space-y-8">
            {renderSection("Bio",
              developer.bio ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizedBio }}></div> : <p className="text-gray-500 italic">No bio provided.</p>,
              MessageCircle
            )}

            {renderSection("Skills",
              developer.skills_categories && Object.keys(developer.skills_categories).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(developer.skills_categories).map(([category, data]) => (
                    <div key={category}>
                      <h4 className="font-semibold text-gray-700 mb-1">{category} ({data.proficiency})</h4>
                      <div className="flex flex-wrap gap-2">
                        {data.skills.map(skill => (
                          <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 italic">No skills listed.</p>,
              Zap
            )}

            {renderSection("Languages",
              developer.top_languages && developer.top_languages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {developer.top_languages.map(lang => (
                    <span key={lang} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {lang}
                    </span>
                  ))}
                </div>
              ) : <p className="text-gray-500 italic">No top languages listed.</p>,
              GitFork
            )}

            {renderSection("Endorsements",
              <EndorsementDisplay
                endorsements={endorsements}
                isLoading={endorsementLoading}
                error={endorsementError}
                canManageVisibility={false} // Public profile, so cannot manage visibility here
              />,
              Award,
              !endorsementLoading
            )}
          </div>

          {/* Right Column (GitHub, Availability, Salary) */}
          <div className="md:col-span-1 space-y-8">
            {renderSection("GitHub Activity",
              <>
                {developer.github_handle ? (
                  <>
                    <p className="text-sm text-gray-600 mb-3 flex items-center">
                      <Github className="w-4 h-4 mr-2" />
                      <a href={`https://github.com/${developer.github_handle}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        @{developer.github_handle}
                      </a>
                    </p>
                    <RealGitHubChart
                      githubHandle={developer.github_handle}
                      gitHubData={gitHubData}
                      loading={gitHubLoading}
                      error={gitHubError as Error | null}
                      className="w-full h-auto"
                      displayMode='modal' // Or 'publicProfile' if you have a specific style
                      isGitHubAppInstalled={!!developer.github_installation_id}
                    />
                    {!gitHubLoading && gitHubData && (
                      <div className="mt-4 space-y-2 text-sm text-gray-700">
                        <p className="flex items-center"><Star className="w-4 h-4 mr-2 text-yellow-500" /> Stars: {formatNumber(gitHubData.totalStars)}</p>
                        <p className="flex items-center"><GitFork className="w-4 h-4 mr-2 text-purple-500" /> Public Repos: {formatNumber(gitHubData.repos?.length || 0)}</p>
                        <p className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-green-500" /> Contributions (Last Year): {formatNumber(gitHubData.contributions?.length || 0)}</p>
                      </div>
                    )}
                    {!gitHubLoading && gitHubError && (
                      <div className="text-center mt-4 text-red-600 bg-red-50 p-3 rounded-md">
                        <AlertCircle className="inline w-5 h-5 mr-2" /> {gitHubError}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">No GitHub handle provided by this developer.</p>
                )}
              </>,
              Github,
              !gitHubLoading
            )}

            {renderSection("Availability",
              developer.availability ? (
                <p className="text-green-600 font-semibold flex items-center">
                  <Calendar className="w-4 h-4 mr-2" /> Available for work
                </p>
              ) : (
                <p className="text-red-600 font-semibold flex items-center">
                  <Calendar className="w-4 h-4 mr-2" /> Currently unavailable
                </p>
              ),
              Calendar
            )}

            {renderSection("Desired Salary",
              developer.desired_salary ? (
                <p className="text-gray-700 flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(developer.desired_salary)} / year
                </p>
              ) : <p className="text-gray-500 italic">Not specified.</p>,
              DollarSign
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
