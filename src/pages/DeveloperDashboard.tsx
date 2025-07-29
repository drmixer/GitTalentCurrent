// src/pages/DeveloperDashboard.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
// CORRECTED: fetchEndorsementsForDeveloper is now a default import
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
import EndorsementDisplay from '../components/EndorsementDisplay'; // Corrected: Imported as default

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

  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as DashboardLocationState | null;

  const getInitialActiveTab = useCallback(() => {
      const currentLocState = location.state as DashboardLocationState | null;
      if (currentLocState?.fromGitHubSetup && currentLocState?.isFreshGitHubSetup) {
          console.log("[Dashboard] Initializing activeTab to 'github-activity' due to fresh setup state.");
          return 'github-activity';
      }
      const params = new URLSearchParams(location.search);
      const tabFromUrl = params.get('tab') as typeof activeTab | null;
      if (tabFromUrl && validTabs.includes(tabFromUrl)) {
          console.log(`[Dashboard] Initializing activeTab to '${tabFromUrl}' from URL.`);
          return tabFromUrl;
      }
      console.log("[Dashboard] Initializing activeTab to 'overview' by default.");
      return 'overview';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.search]);

  const [activeTab, setActiveTab] = useState(getInitialActiveTab);

  const [developerData, setDeveloperData] = useState<Developer | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(true);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [recentCommits, setRecentCommits] = useState<Commit[]>([]);

  const [fetchedSavedJobsCount, setFetchedSavedJobsCount] = useState<number | null>(null);
  const [fetchedAppliedJobsCount, setFetchedAppliedJobsCount] = useState<number | null>(null);
  const [unreadTestAssignmentCount, setUnreadTestAssignmentCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const [selectedMessageThreadDetails, setSelectedMessageThreadDetails] = useState<SelectedMessageThreadDetails | null>(null);

  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [showGitHubConnectModal, setShowGitHubConnectModal] = useState(false);

  const [dashboardPageLoading, setDashboardPageLoading] = useState(true);
  const [hasFreshDataBeenProcessed, setHasFreshDataBeenProcessed] = useState(false);
  const [latchedSuccessfullyFetchedFreshData, setLatchedSuccessfullyFetchedFreshData] = useState<typeof initialStateForGitHubData | null>(null);

  const freshLoadParams = useMemo(() => {
    if (locationState?.isFreshGitHubSetup && locationState?.freshGitHubInstallationId) {
      const handle = contextDeveloperProfile?.github_handle || locationState.freshGitHubHandle;
      if (handle) { return { handle, installId: locationState.freshGitHubInstallationId }; }
    }
    return null;
  }, [locationState?.isFreshGitHubSetup, locationState?.freshGitHubInstallationId, locationState?.freshGitHubHandle, contextDeveloperProfile?.github_handle]);

  const {
    gitHubData: freshGitHubDataFromHook, loading: freshGitHubLoading, error: freshGitHubError
  } = useFreshGitHubDataOnce({ handle: freshLoadParams?.handle, installationId: freshLoadParams?.installId, active: !!freshLoadParams });

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
      // Pass 'false' for publicOnly to fetch ALL endorsements for the dashboard view
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
        setFetchedSavedJobsCount(0);
      } else {
        setFetchedSavedJobsCount(savedCount ?? 0);
        console.log('[Dashboard] Saved jobs count fetched:', savedCount);
      }
      setSavedJobs([]);

      const { count: appliedCount, error: appliedJobsError } = await supabase
        .from('applied_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('developer_id', authUser.id);

      if (appliedJobsError) {
        console.error('[Dashboard] Error fetching applied jobs count:', appliedJobsError);
        setFetchedAppliedJobsCount(0);
      } else {
        setFetchedAppliedJobsCount(appliedCount ?? 0);
        console.log('[Dashboard] Applied jobs count fetched:', appliedCount);
      }
      setAppliedJobs([]);

      const { count: unreadTestAssignmentCount, error: unreadTestAssignmentCountError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('type', 'test_assignment')
        .eq('is_read', false);

      if (unreadTestAssignmentCountError) {
        console.error('[Dashboard] Error fetching unread test assignment count:', unreadTestAssignmentCountError);
      } else {
        setUnreadTestAssignmentCount(unreadTestAssignmentCount ?? 0);
      }

      const { count: unreadMessageCount, error: unreadMessageCountError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('type', 'message')
        .eq('is_read', false);

      if (unreadMessageCountError) {
        console.error('[Dashboard] Error fetching unread message count:', unreadMessageCountError);
      } else {
        setUnreadMessageCount(unreadMessageCount ?? 0);
      }

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
    setIsLoadingEndorsements(true); // Show loading while updating
    setEndorsementError(null);

    const success = await updateEndorsementVisibility(endorsementId, !currentIsPublic);
    if (success) {
      // Optimistically update the state or refetch to reflect the change
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

  useEffect(() => {
    if (shouldUseFreshDataSource && !freshGitHubLoading && dashboardPageLoading) setDashboardPageLoading(false);
  }, [shouldUseFreshDataSource, freshGitHubLoading, dashboardPageLoading]);

  useEffect(() => {
    const state = location.state as DashboardLocationState | null;
    if (state?.fromGitHubSetup) {
      console.log("[Dashboard] Initial Setup Effect: Clearing fromGitHubSetup flag from location.state.");
      const { fromGitHubSetup, ...restOfState } = state;
      navigate(location.pathname + location.search, {
        replace: true,
        state: Object.keys(restOfState).length > 0 ? restOfState : null
      });
    }
  }, [locationState?.fromGitHubSetup, navigate, location.pathname, location.search]);

  useEffect(() => {
    const currentParams = new URLSearchParams(location.search);
    const currentTabInUrl = currentParams.get('tab');
    const targetTabForUrl = activeTab === 'overview' ? null : activeTab;

    if (currentTabInUrl !== targetTabForUrl) {
      if (targetTabForUrl) {
        currentParams.set('tab', targetTabForUrl);
      } else {
        currentParams.delete('tab');
      }
      const newSearchString = currentParams.toString() ? `?${currentParams.toString()}` : '';
      const { fromGitHubSetup, ...restOfState } = locationState || {};
      navigate(`${location.pathname}${newSearchString}`, {
        replace: true,
        state: Object.keys(restOfState).length > 0 ? restOfState : null
      });
    }
  }, [activeTab, location.pathname, navigate]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabFromUrl = queryParams.get('tab') as typeof activeTab | null;

    if (locationState?.fromGitHubSetup) return;

    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      if (activeTab !== tabFromUrl) {
        console.log(`[Dashboard] URL to State Sync: Setting activeTab to '${tabFromUrl}' from URL.`);
        setActiveTab(tabFromUrl);
      }
    } else if (!tabFromUrl && activeTab !== 'overview') {
      console.log(`[Dashboard] URL to State Sync: No tab in URL, setting activeTab to 'overview'.`);
      setActiveTab('overview');
    }
  }, [location.search]);

  useEffect(() => {
    if (shouldUseFreshDataSource && !freshGitHubLoading && freshGitHubDataFromHook?.user && !hasFreshDataBeenProcessed) {
      setLatchedSuccessfullyFetchedFreshData(freshGitHubDataFromHook);
      setHasFreshDataBeenProcessed(true);
    } else if (shouldUseFreshDataSource && !freshGitHubLoading && freshGitHubError && !hasFreshDataBeenProcessed) {
      setHasFreshDataBeenProcessed(true);
    }
  }, [shouldUseFreshDataSource, freshGitHubLoading, freshGitHubDataFromHook, freshGitHubError, hasFreshDataBeenProcessed]);

  useEffect(() => {
    if (locationState?.isFreshGitHubSetup && hasFreshDataBeenProcessed) {
      console.log('[Dashboard] Clearing isFreshGitHubSetup flag from location.state.');
      const { freshGitHubHandle, freshGitHubInstallationId, isFreshGitHubSetup, fromGitHubSetup, ...restOfState } = locationState;
      navigate(location.pathname + location.search, { replace: true, state: Object.keys(restOfState).length > 0 ? restOfState : null });
    }
  }, [locationState?.isFreshGitHubSetup, hasFreshDataBeenProcessed, navigate, location.pathname, location.search]);

  useEffect(() => {
    const show = activeTab === 'github-activity' && !!contextDeveloperProfile?.github_handle && !contextDeveloperProfile?.github_installation_id;
    if (showGitHubConnectModal !== show) setShowGitHubConnectModal(show);
  }, [contextDeveloperProfile?.github_handle, contextDeveloperProfile?.github_installation_id, activeTab, showGitHubConnectModal]);

  useEffect(() => {
    if (finalGitHubDataToShow?.contributions && Array.isArray(finalGitHubDataToShow.contributions)) {
      const formattedCommits = finalGitHubDataToShow.contributions.slice(0, 3).map((contrib: any) => ({
        sha: contrib.oid || contrib.id || Math.random().toString(36).substring(7),
        message: contrib.messageHeadline || contrib.message || 'Commit message unavailable',
        repoName: contrib.repository?.nameWithOwner || contrib.repo?.name || 'Unknown Repo',
        date: contrib.occurredAt || contrib.created_at || new Date().toISOString(),
        url: contrib.commitUrl || contrib.url || '#',
      }));
      setRecentCommits(formattedCommits);
      console.log('[Dashboard] Recent commits extracted and formatted:', formattedCommits);
    }
  }, [finalGitHubDataToShow]);

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
        savedJobsCountOverride={fetchedSavedJobsCount}
        appliedJobsCountOverride={fetchedAppliedJobsCount}
        savedJobs={[]}
        appliedJobs={[]}
        endorsements={endorsements}
        endorsementsLoading={isLoadingEndorsements}
        endorsementsError={endorsementError}
        recentCommits={recentCommits}
        githubProfileUrl={currentDeveloperProfile.github_handle ? `https://github.com/${currentDeveloperProfile.github_handle}` : undefined}
        loading={dashboardPageLoading || authContextLoading || gitHubDataLoadingToShow}
        onNavigateToTab={(tab) => setActiveTab(tab as typeof activeTab)}
      />
    );
  };

  console.log('[Dashboard RENDER]', { activeTab, dashboardPageLoading, authContextLoading, authUser, userProfile, developerData, contextDeveloperProfile, endorsements, isLoadingEndorsements, endorsementError });

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
      {showGitHubConnectModal && currentDeveloperProfile?.github_handle && ( <GitHubConnectPrompt githubHandle={currentDeveloperProfile.github_handle} onClose={() => setShowGitHubConnectModal(false)} onConnect={() => navigate('/github-setup')} /> )}
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
          {validTabs.map((tabName) => (
            <button key={tabName} onClick={() => setActiveTab(tabName as typeof activeTab)}
              className={`whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${activeTab === tabName ? 'border-blue-600 text-blue-700 bg-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tabName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              {tabName === 'tests' && unreadTestAssignmentCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadTestAssignmentCount}
                </span>
              )}
              {tabName === 'messages' && unreadMessageCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadMessageCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'profile' && (displayDeveloperProfileForForm ? <DeveloperProfileForm initialData={displayDeveloperProfileForForm} onSuccess={async () => { if(refreshProfile) await refreshProfile(); await fetchDeveloperPageData();}} isOnboarding={false} /> : <div className="text-center p-8">Loading...</div>)}
      {activeTab === 'portfolio' && <PortfolioManager developerId={authUser?.id || ''} />}
      {activeTab === 'github-activity' && (
        currentDeveloperProfile?.github_handle && currentDeveloperProfile?.github_installation_id ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5 flex-shrink-0"><div className="max-w-md mx-auto lg:mx-0 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                <RealGitHubChart githubHandle={currentDeveloperProfile.github_handle} gitHubData={finalGitHubDataToShow} loading={gitHubDataLoadingToShow} error={gitHubDataErrorToShow as Error | null} className="w-full" displayMode='dashboardSnippet' isGitHubAppInstalled={!!currentDeveloperProfile?.github_installation_id} />
            </div></div>
            <div className="lg:w-3/5 flex-grow bg-white p-4 sm:p-6 rounded-lg shadow-md border">
              {gitHubDataLoadingToShow && (<div className="flex flex-col items-center justify-center h-64"><Loader className="animate-spin h-10 w-10 text-blue-500 mb-4" /><p className="text-gray-600">{shouldUseFreshDataSource ? "Fetching latest GitHub activity..." : "Loading GitHub activity..."}</p></div>)}
              {!gitHubDataLoadingToShow && gitHubDataErrorToShow && (<div className="text-center py-10 px-6 bg-red-50 border border-red-200 rounded-lg"><AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" /><h3 className="text-lg font-semibold text-red-700">Error Loading GitHub Details</h3><p className="text-red-600 mt-2 text-sm">{typeof gitHubDataErrorToShow === 'string' ? gitHubDataErrorToShow : (gitHubDataErrorToShow as Error)?.message || 'An unknown error occurred.'}</p><button onClick={() => navigate('/github-setup')} className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Re-check</button></div>)}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && finalGitHubDataToShow?.user && (
                <GitHubUserActivityDetails gitHubData={finalGitHubDataToShow} />
              )}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && !finalGitHubDataToShow?.user && (<div className="text-center py-10 px-6 bg-yellow-50 border border-yellow-200 rounded-lg"><Github className="w-12 h-12 text-yellow-500 mx-auto mb-3" /><h3 className="text-lg font-semibold">No GitHub Data Available</h3><p className="text-gray-600 mt-2 text-sm">Could not retrieve GitHub activity.</p><button onClick={async () => { setLatchedSuccessfullyFetchedFreshData(null); setHasFreshDataBeenProcessed(false); if(refreshProfile) await refreshProfile();}} className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Refresh</button></div>)}
            </div>
          </div>
        ) : (<div className="text-center p-8"><Github className="w-16 h-16 text-gray-300 mx-auto mb-6" /><h3 className="text-2xl font-semibold">Connect GitHub Account</h3><button onClick={() => { if (!currentDeveloperProfile?.github_handle) { setActiveTab('profile'); navigate('/developer?tab=profile', { state: { ...(locationState || {}), focusGitHubHandle: true } }); } else { navigate('/github-setup');}}} className="px-8 py-3 bg-blue-600 text-white rounded-lg"> {currentDeveloperProfile?.github_handle ? 'Connect GitHub App' : 'Add GitHub Handle in Profile'} </button></div>)
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
