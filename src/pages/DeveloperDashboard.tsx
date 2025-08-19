// src/pages/DeveloperDashboard.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../contexts/NotificationsContext';
import { supabase } from '../lib/supabase';
import fetchEndorsementsForDeveloper, { updateEndorsementVisibility } from '../lib/endorsementUtils';
import {
  DeveloperProfileForm,
  PortfolioManager,
  MessageList,
  MessageThread,
  JobRoleDetails,
  ProfileStrengthIndicator,
  RealGitHubChart,
  GitHubUserActivityDetails,
  GitHubConnectPrompt,
  OverviewTab,
  JobsTab,
} from '../components';
import EndorsementDisplay from '../components/EndorsementDisplay';

import { useGitHub } from '../hooks/useGitHub';
import { useFreshGitHubDataOnce } from '../hooks/useFreshGitHubDataOnce';
import {
  User, Briefcase, MessageSquare, Search, Github, Star, TrendingUp, Calendar,
  DollarSign, MapPin, Clock, Send, ExternalLink, Building, Eye, SearchCheck, Loader, AlertCircle, Code,
} from 'lucide-react';
import DeveloperTests from './DeveloperTests';
import {
  Developer,
  JobRole,
  MessageThread as MessageThreadType,
  PortfolioItem,
  Endorsement,
  SavedJob,
  AppliedJob,
  Message
} from '../types';

// Helper function to calculate calendar year contributions (YTD)
const calculateCalendarYearContributions = (gitHubData: any): number => {
  if (!gitHubData?.contributions) {
    console.log('[GitHubUtils] No contributions data available for calendar year calculation');
    return 0;
  }

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  
  console.log('[GitHubUtils] Calculating calendar year contributions for year:', currentYear);

  // Handle the new data structure with contributions.calendar
  if (gitHubData.contributions.calendar && Array.isArray(gitHubData.contributions.calendar)) {
    const calendarYearContributions = gitHubData.contributions.calendar
      .filter((day: any) => {
        const dayDate = day.date || day.occurredAt;
        return dayDate && dayDate >= yearStart;
      })
      .reduce((sum: number, day: any) => {
        const count = day.contributionCount || day.count || 0;
        return sum + count;
      }, 0);
    
    console.log('[GitHubUtils] Calendar year contributions from calendar data:', calendarYearContributions);
    return calendarYearContributions;
  }
  
  // Handle legacy contributions array format
  if (Array.isArray(gitHubData.contributions)) {
    const calendarYearContributions = gitHubData.contributions
      .filter((day: any) => {
        const dayDate = day.date || day.occurredAt;
        return dayDate && dayDate >= yearStart;
      })
      .reduce((sum: number, day: any) => {
        const count = day.contributionCount || day.count || 0;
        return sum + count;
      }, 0);
    
    console.log('[GitHubUtils] Calendar year contributions from legacy data:', calendarYearContributions);
    return calendarYearContributions;
  }
  
  console.warn('[GitHubUtils] No valid contribution data structure found for calendar year calculation');
  return 0;
};

interface SelectedMessageThreadDetails {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  lastMessage: any;
  unreadCount: number;
  jobContext?: {
    id: string;
    title: string;
  };
}

interface Commit {
  sha: string;
  message: string;
  repoName: string;
  date: string;
  url: string;
}

interface DashboardLocationState {
  freshGitHubHandle?: string;
  freshGitHubInstallationId?: string;
  isFreshGitHubSetup?: boolean;
  fromAuthCallback?: boolean;
  ghAppConnected?: boolean;
  focusGitHubHandle?: boolean;
  fromGitHubSetup?: boolean;
  [key: string]: any;
}

const initialStateForGitHubData = { user: null, repos: [], languages: {}, totalStars: 0, contributions: [] };
const validTabs = ['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs', 'endorsements', 'tests'];

export const DeveloperDashboard: React.FC = () => {
  const {
    user: authUser,
    userProfile,
    developerProfile: contextDeveloperProfile,
    loading: authContextLoading,
    refreshProfile,
  } = useAuth();
  const { notifications: ctxNotifications, markAsReadByType } = useNotifications();

  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as DashboardLocationState | null;

  const params = new URLSearchParams(location.search);
  const activeTab = validTabs.includes(params.get('tab') || '') ? params.get('tab') : 'overview';

  const [developerData, setDeveloperData] = useState<Developer | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(true);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [recentCommits, setRecentCommits] = useState<Commit[]>([]);

  const [selectedMessageThreadDetails, setSelectedMessageThreadDetails] = useState<SelectedMessageThreadDetails | null>(null);

  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [showGitHubConnectModal, setShowGitHubConnectModal] = useState(false);

  const [dashboardPageLoading, setDashboardPageLoading] = useState(true);
  const [hasFreshDataBeenProcessed, setHasFreshDataBeenProcessed] = useState(false);
  const [latchedSuccessfullyFetchedFreshData, setLatchedSuccessfullyFetchedFreshData] = useState<typeof initialStateForGitHubData | null>(null);

  // NEW: State to track calendar year contributions for YTD display
  const [calendarYearContributions, setCalendarYearContributions] = useState<number>(0);

  // Badge counts derived directly from NotificationsContext so they clear instantly
  const unreadTestsBadge = useMemo(
    () =>
      (ctxNotifications || []).filter(
        (n: any) => !n.is_read && (n.type || '').toLowerCase() === 'test_assignment'
      ).length,
    [ctxNotifications]
  );

  const unreadMessagesBadge = useMemo(
    () =>
      (ctxNotifications || []).filter(
        (n: any) => !n.is_read && (n.type || '').toLowerCase().includes('message')
      ).length,
    [ctxNotifications]
  );

  // Determine if we should fetch "fresh" GitHub data (e.g., right after a new install)
  const freshLoadParams = useMemo(() => {
    if (locationState?.isFreshGitHubSetup && locationState?.freshGitHubInstallationId) {
      const handle = contextDeveloperProfile?.github_handle || locationState.freshGitHubHandle;
      if (handle) { return { handle, installId: locationState.freshGitHubInstallationId }; }
    }
    return null;
  }, [locationState?.isFreshGitHubSetup, locationState?.freshGitHubInstallationId, locationState?.freshGitHubHandle, contextDeveloperProfile?.github_handle]);

  // Fetch GitHub data (fresh vs standard)
  const {
    gitHubData: freshGitHubDataFromHook, loading: freshGitHubLoading, error: freshGitHubError
  } = useFreshGitHubDataOnce({ handle: freshLoadParams?.handle, installationId: freshLoadParams?.installId });

  const {
    gitHubData: standardGitHubData, loading: standardGitHubLoading, error: standardGitHubError
  } = useGitHub();

  const shouldUseFreshDataSource = !!freshLoadParams;

  let finalGitHubDataToShow = standardGitHubData;
  let gitHubDataLoadingToShow = standardGitHubLoading;
  let gitHubDataErrorToShow = standardGitHubError;

  if (latchedSuccessfullyFetchedFreshData) {
    finalGitHubDataToShow = latchedSuccessfullyFetchedFreshData;
    gitHubDataLoadingToShow = false;
    gitHubDataErrorToShow = null;
  } else if (shouldUseFreshDataSource) {
    finalGitHubDataToShow = freshGitHubDataFromHook;
    gitHubDataLoadingToShow = freshGitHubLoading;
    gitHubDataErrorToShow = freshGitHubError;
  }

  const fetchDeveloperPageData = useCallback(async () => {
    if (!authUser?.id) {
      setDashboardPageLoading(false);
      setIsLoadingEndorsements(false);
      setEndorsementError("User not logged in.");
      return;
    }
    setDashboardPageLoading(true);
    console.log('[Dashboard] Starting to fetch all developer page data...');
    try {
      const { data: devData, error: devError } = await supabase
        .from('developers')
        .select('*, user:users(name, email)')
        .eq('user_id', authUser.id)
        .single();
      if (devError && devError.code !== 'PGRST116') {
        console.error('[Dashboard] Error fetching local developer data:', devError);
      } else if (devData) {
        setDeveloperData(devData as Developer);
        console.log('[Dashboard] Developer data fetched:', devData);
      } else {
        setDeveloperData(null);
        console.log('[Dashboard] No specific developer data found, relying on context.');
      }

      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('developer_id', authUser.id)
        .order('created_at', { ascending: false });
      if (portfolioError) console.error('[Dashboard] Error fetching portfolio items:', portfolioError);
      else {
        setPortfolioItems(portfolioData || []);
        console.log('[Dashboard] Portfolio items fetched:', portfolioData);
      }

      // --- ENDORSEMENT FETCH LOGIC (using updated utility) ---
      setIsLoadingEndorsements(true);
      setEndorsementError(null);
      const fetchedEndorsements = await fetchEndorsementsForDeveloper(authUser.id, false);
      if (fetchedEndorsements) {
        setEndorsements(fetchedEndorsements);
        console.log('[Dashboard] Endorsements fetched using utility:', fetchedEndorsements);
      } else {
        setEndorsementError("Failed to load endorsements.");
      }
      setIsLoadingEndorsements(false);
      // --- END ENDORSEMENT FETCH LOGIC ---

      const { count: savedCount, error: savedJobsError } = await supabase
        .from('saved_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('developer_id', authUser.id);

      if (savedJobsError) {
        console.error('[Dashboard] Error fetching saved jobs count:', savedJobsError);
      } else {
        console.log('[Dashboard] Saved jobs count fetched:', savedCount);
      }
      setSavedJobs([]);

      const { count: appliedCount, error: appliedJobsError } = await supabase
        .from('applied_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('developer_id', authUser.id);

      if (appliedJobsError) {
        console.error('[Dashboard] Error fetching applied jobs count:', appliedJobsError);
      } else {
        console.log('[Dashboard] Applied jobs count fetched:', appliedCount);
      }
      setAppliedJobs([]);

    } catch (error) {
      console.error('[Dashboard] Critical error in fetchDeveloperPageData:', error);
      setIsLoadingEndorsements(false);
      setEndorsementError("An unexpected error occurred while loading endorsements.");
    } finally {
      setDashboardPageLoading(false);
      console.log('[Dashboard] Finished fetching all developer page data.');
    }
  }, [authUser?.id]);

  // Handler for toggling endorsement visibility
  const handleToggleEndorsementVisibility = useCallback(async (endorsementId: string, currentIsPublic: boolean) => {
    setIsLoadingEndorsements(true);
    setEndorsementError(null);

    const success = await updateEndorsementVisibility(endorsementId, !currentIsPublic);
    if (success) {
      setEndorsements(prev => prev.map(e =>
        e.id === endorsementId ? { ...e, is_public: !currentIsPublic } : e
      ));
      console.log(`Endorsement ${endorsementId} visibility toggled to ${!currentIsPublic}`);
    } else {
      setEndorsementError("Failed to update endorsement visibility.");
      console.error(`Failed to toggle visibility for endorsement ${endorsementId}`);
    }
    setIsLoadingEndorsements(false);
  }, []);

  useEffect(() => {
    if (!authContextLoading && authUser?.id) {
        fetchDeveloperPageData();
    } else if (!authContextLoading && !authUser?.id) {
        setDashboardPageLoading(false);
        setIsLoadingEndorsements(false);
        setEndorsementError("Not authenticated to load endorsements.");
    }
  }, [authUser, authContextLoading, fetchDeveloperPageData]);

  // Clear notifications when accessing relevant tabs
  useEffect(() => {
    if (userProfile?.id && activeTab) {
      console.log('🔄 DeveloperDashboard: Clearing notifications for tab:', activeTab);
      
      if (activeTab === 'tests') {
        // Clear test assignment notifications
        markAsReadByType('test_assignment');
      } else if (activeTab === 'messages') {
        // Messages notifications are cleared when specific message threads are opened
      } else if (activeTab === 'jobs') {
        // Clear job-related notifications for developers (if used)
        markAsReadByType('job_application');
        markAsReadByType('application_viewed'); 
        markAsReadByType('hired');
      }
    }
  }, [activeTab, userProfile, markAsReadByType]);

  // GitHub recent commits derivation
  useEffect(() => {
    if (finalGitHubDataToShow) {
      console.log('[Dashboard] Processing GitHub data:', finalGitHubDataToShow);
      
      if (finalGitHubDataToShow.recentCommits && Array.isArray(finalGitHubDataToShow.recentCommits)) {
        const formattedCommits = finalGitHubDataToShow.recentCommits.slice(0, 3).map((commit: any) => ({
          sha: commit.sha || Math.random().toString(36).substring(7),
          message: commit.message || 'Commit message unavailable',
          repoName: commit.repoName || 'Unknown Repo',
          date: commit.date || new Date().toISOString(),
          url: commit.url || '#',
        }));
        setRecentCommits(formattedCommits);
        console.log('[Dashboard] Set recent commits:', formattedCommits);
      } else if (finalGitHubDataToShow.contributions?.recentActivity && Array.isArray(finalGitHubDataToShow.contributions.recentActivity)) {
        const commitActivities = finalGitHubDataToShow.contributions.recentActivity
          .filter((activity: any) => activity.type === 'commit')
          .slice(0, 3)
          .map((activity: any) => ({
            sha: activity.sha || Math.random().toString(36).substring(7),
            message: `${activity.commitCount || 1} commits`,
            repoName: activity.repository || 'Unknown Repo',
            date: activity.occurredAt || new Date().toISOString(),
            url: '#',
          }));
        setRecentCommits(commitActivities);
        console.log('[Dashboard] Set commits from recentActivity:', commitActivities);
      } else if (finalGitHubDataToShow.contributions && Array.isArray(finalGitHubDataToShow.contributions)) {
        const formattedCommits = finalGitHubDataToShow.contributions.slice(0, 3).map((contrib: any) => ({
          sha: contrib.oid || contrib.id || Math.random().toString(36).substring(7),
          message: contrib.messageHeadline || contrib.message || 'Commit message unavailable',
          repoName: contrib.repository?.nameWithOwner || contrib.repo?.name || 'Unknown Repo',
          date: contrib.occurredAt || contrib.created_at || new Date().toISOString(),
          url: contrib.commitUrl || contrib.url || '#',
        }));
        setRecentCommits(formattedCommits);
        console.log('[Dashboard] Set commits from legacy contributions:', formattedCommits);
      } else {
        console.log('[Dashboard] No recent commits data found');
        setRecentCommits([]);
      }
    }
  }, [finalGitHubDataToShow]);

  // NEW: Calculate calendar year contributions for YTD display
  useEffect(() => {
    if (finalGitHubDataToShow) {
      const ytdContributions = calculateCalendarYearContributions(finalGitHubDataToShow);
      setCalendarYearContributions(ytdContributions);
      console.log('[Dashboard] Calendar year (YTD) contributions calculated:', ytdContributions);
    }
  }, [finalGitHubDataToShow]);

  // UPDATED: Annual contributions processing - sync ROLLING YEAR total to database
  useEffect(() => {
    if (finalGitHubDataToShow && developerData?.id) {
      let totalContributions = 0;
      
      console.log('[Dashboard] Processing GitHub data for annual contributions (rolling year for DB sync):', {
        hasContributions: !!finalGitHubDataToShow.contributions,
        contributionsType: typeof finalGitHubDataToShow.contributions,
        hasCalendar: !!finalGitHubDataToShow.contributions?.calendar,
        hasTotalContributions: !!finalGitHubDataToShow.contributions?.totalContributions,
        currentAnnualContributions: developerData.annual_contributions
      });
      
      if (finalGitHubDataToShow.contributions?.totalContributions && typeof finalGitHubDataToShow.contributions.totalContributions === 'number') {
        totalContributions = finalGitHubDataToShow.contributions.totalContributions;
        console.log('[Dashboard] Using totalContributions from API (rolling year):', totalContributions);
      } else if (finalGitHubDataToShow.contributions?.calendar && Array.isArray(finalGitHubDataToShow.contributions.calendar)) {
        totalContributions = finalGitHubDataToShow.contributions.calendar.reduce(
          (sum: number, day: any) => {
            const count = day.contributionCount || day.count || 0;
            return sum + count;
          }, 0
        );
        console.log('[Dashboard] Calculated from calendar data (rolling year):', totalContributions, 'days:', finalGitHubDataToShow.contributions.calendar.length);
      } else if (Array.isArray(finalGitHubDataToShow.contributions)) {
        totalContributions = finalGitHubDataToShow.contributions.reduce(
          (sum: number, day: any) => {
            const count = day.contributionCount || day.count || 0;
            return sum + count;
          }, 0
        );
        console.log('[Dashboard] Calculated from legacy contributions array (rolling year):', totalContributions);
      } else {
        console.warn('[Dashboard] No valid contribution data found for annual contributions calculation');
      }

      if (totalContributions >= 0 && totalContributions !== (developerData.annual_contributions || 0)) {
        console.log('[Dashboard] Updating annual_contributions (rolling year) from', developerData.annual_contributions, 'to', totalContributions);
        setDeveloperData(prev => prev ? { ...prev, annual_contributions: totalContributions } : prev);

        const updateAnnualContributions = async () => {
          try {
            const { error } = await supabase
              .from('developers')
              .update({ 
                annual_contributions: totalContributions,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', developerData.user_id || authUser?.id);
            
            if (error) {
              console.error('[Dashboard] Failed to update annual_contributions in database:', error);
            } else {
              console.log('[Dashboard] Successfully updated annual_contributions (rolling year) in database:', totalContributions);
            }
          } catch (updateError) {
            console.error('[Dashboard] Error updating annual_contributions:', updateError);
          }
        };

        updateAnnualContributions();
      } else if (totalContributions >= 0) {
        console.log('[Dashboard] Annual contributions (rolling year) already up to date:', totalContributions);
      }
    }
  }, [finalGitHubDataToShow, developerData?.id, developerData?.annual_contributions, authUser?.id]);

  const currentDeveloperProfile = useMemo(() => {
    if (contextDeveloperProfile) {
      return { ...developerData, ...contextDeveloperProfile, user: contextDeveloperProfile.user || developerData?.user };
    }
    return developerData;
  }, [contextDeveloperProfile, developerData]);

  const renderOverview = () => {
    if (!currentDeveloperProfile) {
      return <div className="p-6 text-center">Loading developer profile...</div>;
    }
    return (
      <OverviewTab
        developer={currentDeveloperProfile}
        portfolioItems={portfolioItems}
        messages={[]}
        savedJobsCountOverride={null}
        appliedJobsCountOverride={null}
        savedJobs={[]}
        appliedJobs={[]}
        endorsements={endorsements}
        endorsementsLoading={isLoadingEndorsements}
        endorsementsError={endorsementError}
        recentCommits={recentCommits}
        githubProfileUrl={currentDeveloperProfile.github_handle ? `https://github.com/${currentDeveloperProfile.github_handle}` : undefined}
        loading={dashboardPageLoading || authContextLoading || gitHubDataLoadingToShow}
        onNavigateToTab={(tab) => navigate(`/developer?tab=${tab}`)}
        calendarYearContributions={calendarYearContributions}
      />
    );
  };

  if (authContextLoading || (!authUser && !authContextLoading && !dashboardPageLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader className="animate-spin h-10 w-10 text-blue-500" />
        <p className="ml-3 text-gray-600">Loading user authentication...</p>
      </div>
    );
  }
  if (dashboardPageLoading && !authContextLoading && authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader className="animate-spin h-10 w-10 text-blue-500" />
        <p className="ml-3 text-gray-600">Loading your dashboard data...</p>
      </div>
    );
  }
  if (!userProfile && !authContextLoading && !dashboardPageLoading) {
    console.warn("User authenticated but no profile found. Redirecting to setup.");
    navigate('/onboarding', { replace: true });
    return null;
  }

  const displayDeveloperProfileForForm = currentDeveloperProfile;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-screen-xl mx-auto">
      {showGitHubConnectModal && currentDeveloperProfile?.github_handle && (
        <GitHubConnectPrompt
          githubHandle={currentDeveloperProfile.github_handle}
          onClose={() => setShowGitHubConnectModal(false)}
          onConnect={() => navigate('/github-setup')}
        />
      )}

      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
          {validTabs.map((tabName) => (
            <button
              key={tabName}
              onClick={() => navigate(`/developer?tab=${tabName}`)}
              className={`whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                activeTab === tabName ? 'border-blue-600 text-blue-700 bg-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tabName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              {tabName === 'tests' && unreadTestsBadge > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadTestsBadge}
                </span>
              )}
              {tabName === 'messages' && unreadMessagesBadge > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadMessagesBadge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'profile' && (
        displayDeveloperProfileForForm ? (
          <DeveloperProfileForm
            initialData={displayDeveloperProfileForForm}
            onSuccess={async () => { if (refreshProfile) await refreshProfile(); await fetchDeveloperPageData(); }}
            isOnboarding={false}
          />
        ) : (
          <div className="text-center p-8">Loading...</div>
        )
      )}
      {activeTab === 'portfolio' && <PortfolioManager developerId={authUser?.id || ''} />}
      {activeTab === 'github-activity' && (
        currentDeveloperProfile?.github_handle && currentDeveloperProfile?.github_installation_id ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5 flex-shrink-0">
              <div className="max-w-md mx-auto lg:mx-0 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                <RealGitHubChart
                  githubHandle={currentDeveloperProfile.github_handle}
                  gitHubData={finalGitHubDataToShow}
                  loading={gitHubDataLoadingToShow}
                  error={gitHubDataErrorToShow as Error | null}
                  className="w-full"
                  displayMode='dashboardSnippet'
                  isGitHubAppInstalled={!!currentDeveloperProfile?.github_installation_id}
                />
              </div>
            </div>
            <div className="lg:w-3/5 flex-grow bg-white p-4 sm:p-6 rounded-lg shadow-md border">
              {gitHubDataLoadingToShow && (
                <div className="flex flex-col items-center justify-center h-64">
                  <Loader className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                  <p className="text-gray-600">
                    {shouldUseFreshDataSource ? "Fetching latest GitHub activity..." : "Loading GitHub activity..."}
                  </p>
                </div>
              )}
              {!gitHubDataLoadingToShow && gitHubDataErrorToShow && (
                <div className="text-center py-10 px-6 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-red-700">Error Loading GitHub Details</h3>
                  <p className="text-red-600 mt-2 text-sm">
                    {typeof gitHubDataErrorToShow === 'string' ? gitHubDataErrorToShow : (gitHubDataErrorToShow as Error)?.message || 'An unknown error occurred.'}
                  </p>
                  <button
                    onClick={() => navigate('/github-setup')}
                    className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    Re-check
                  </button>
                </div>
              )}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && finalGitHubDataToShow?.user && (
                <GitHubUserActivityDetails gitHubData={finalGitHubDataToShow} />
              )}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && !finalGitHubDataToShow?.user && (
                <div className="text-center py-10 px-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Github className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold">No GitHub Data Available</h3>
                  <p className="text-gray-600 mt-2 text-sm">Could not retrieve GitHub activity.</p>
                  <button
                    onClick={async () => {
                      setLatchedSuccessfullyFetchedFreshData(null);
                      setHasFreshDataBeenProcessed(false);
                      if (refreshProfile) await refreshProfile();
                    }}
                    className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <Github className="w-16 h-16 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold">Connect GitHub Account</h3>
            <button
              onClick={() => {
                if (!currentDeveloperProfile?.github_handle) {
                  navigate(`/developer?tab=profile`, { state: { ...(locationState || {}), focusGitHubHandle: true } });
                } else {
                  navigate('/github-setup');
                }
              }}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg"
            >
              {currentDeveloperProfile?.github_handle ? 'Connect GitHub App' : 'Add GitHub Handle in Profile'}
            </button>
          </div>
        )
      )}
      {activeTab === 'messages' && (
        <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-250px)]">
          <div className="md:w-1/3 h-full">
            <MessageList
              onThreadSelect={(threadDetails) => {
                setSelectedMessageThreadDetails(threadDetails);
              }}
            />
          </div>
          <div className="md:w-2/3 h-full bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {selectedMessageThreadDetails ? (
              <MessageThread
                key={`${selectedMessageThreadDetails.otherUserId}-${selectedMessageThreadDetails.jobContext?.id || 'general'}`}
                otherUserId={selectedMessageThreadDetails.otherUserId}
                otherUserName={selectedMessageThreadDetails.otherUserName}
                otherUserRole={selectedMessageThreadDetails.otherUserRole}
                otherUserProfilePicUrl={selectedMessageThreadDetails.otherUserProfilePicUrl}
                jobContext={selectedMessageThreadDetails.jobContext}
                onBack={() => setSelectedMessageThreadDetails(null)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <MessageSquare size={48} className="mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold">Select a conversation</h3>
                <p className="text-sm">Choose a conversation from the list to view messages.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'jobs' && <JobsTab />}
      {activeTab === 'tests' && <DeveloperTests />}
      {activeTab === 'endorsements' && (
        <section className="endorsements-tab-content">
          <EndorsementDisplay
            endorsements={endorsements}
            isLoading={isLoadingEndorsements}
            error={endorsementError}
            canManageVisibility={true}
            onToggleVisibility={handleToggleEndorsementVisibility}
          />
        </section>
      )}
    </div>
  );
};
