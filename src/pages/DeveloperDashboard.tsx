import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
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
  JobsTab, // Import the new JobsTab component
} from '../components';
import { useGitHub } from '../hooks/useGitHub'; 
import { useFreshGitHubDataOnce } from '../hooks/useFreshGitHubDataOnce';
import {
  User, Briefcase, MessageSquare, Search, Github, Star, TrendingUp, Calendar,
  DollarSign, MapPin, Clock, Send, ExternalLink, Building, Eye, SearchCheck, Loader, AlertCircle,
} from 'lucide-react';
import {
  Developer,
  JobRole,
  MessageThread as MessageThreadType,
  PortfolioItem, // Added
  Endorsement,   // Added
  SavedJob,      // Added
  AppliedJob,     // Added
  Message // Make sure Message type is imported if needed for MessageThreadType details
} from '../types';


// Local MessageThread type from MessageList.tsx - for selected thread details
// This mirrors the structure MessageList provides when a thread is selected.
interface SelectedMessageThreadDetails {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  lastMessage: any; // Should be 'Message' type from a common source if possible
  unreadCount: number;
  jobContext?: {
    id: string;
    title: string;
  };
}

// Define a simple type for a commit for now, this should align with RecentGitHubActivity's expectation
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
const validTabs = ['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'];

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
  }, [location.state, location.search]); // Called once for useState, but deps for useCallback correctness if reused

  const [activeTab, setActiveTab] = useState(getInitialActiveTab);

  const [developerData, setDeveloperData] = useState<Developer | null>(null); // This will be merged with contextDeveloperProfile
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]); // Or JobRole[]
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]); // This will be changed to store count if only for Overview
  const [recentCommits, setRecentCommits] = useState<Commit[]>([]);

  const [fetchedSavedJobsCount, setFetchedSavedJobsCount] = useState<number | null>(null);
  const [fetchedAppliedJobsCount, setFetchedAppliedJobsCount] = useState<number | null>(null);

  // const [messages, setMessages] = useState<MessageThreadType[]>([]); // MessageList will fetch its own
  const [selectedMessageThreadDetails, setSelectedMessageThreadDetails] = useState<SelectedMessageThreadDetails | null>(null);

  // const [recommendedJobs, setRecommendedJobs] = useState<JobRole[]>([]); // This can be part of the JobsTab specific data
  // const [featuredPortfolioItem, setFeaturedPortfolioItem] = useState<any | null>(null); // This will be derived from portfolioItems

  // const [selectedMessageThreadId, setSelectedMessageThreadId] = useState<string | null>(null); // Replaced by selectedMessageThreadDetails
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [showGitHubConnectModal, setShowGitHubConnectModal] = useState(false);

  const [dashboardPageLoading, setDashboardPageLoading] = useState(true);
  const [hasFreshDataBeenProcessed, setHasFreshDataBeenProcessed] = useState(false);
  const [latchedSuccessfullyFetchedFreshData, setLatchedSuccessfullyFetchedFreshData] = useState<typeof initialStateForGitHubData | null>(null);

  const freshLoadParams = useMemo(() => {
    if (locationState?.isFreshGitHubSetup && locationState?.freshGitHubInstallationId) {
      const handle = locationState.freshGitHubHandle || contextDeveloperProfile?.github_handle;
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
      return;
    }
    setDashboardPageLoading(true);
    console.log('[Dashboard] Starting to fetch all developer page data...');
    try {
      // Fetch developer profile (already partially done by useAuth, but this can get more details)
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

      // Fetch portfolio items
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

      // Fetch endorsements
      const { data: endorsementData, error: endorsementError } = await supabase
        .from('endorsements')
        // Select only 'name' for the endorser, as 'title' and 'avatar_url' are not on the users table.
        .select('*, endorser:endorser_id(name)')
        .eq('developer_id', authUser.id)
        .order('created_at', { ascending: false });
      if (endorsementError) console.error('[Dashboard] Error fetching endorsements:', endorsementError);
      else {
        setEndorsements(endorsementData || []);
        console.log('[Dashboard] Endorsements fetched:', endorsementData);
      }

      // Fetch saved jobs count
      const { count: savedCount, error: savedJobsError } = await supabase
        .from('saved_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('developer_id', authUser.id);

      if (savedJobsError) {
        console.error('[Dashboard] Error fetching saved jobs count:', savedJobsError);
        setFetchedSavedJobsCount(0); // Default to 0 on error
      } else {
        setFetchedSavedJobsCount(savedCount ?? 0);
        console.log('[Dashboard] Saved jobs count fetched:', savedCount);
      }
      // Clear the old savedJobs array if it's no longer needed for detailed display in Overview
      setSavedJobs([]);


      // Fetch applied jobs count
      const { count: appliedCount, error: appliedJobsError } = await supabase
        .from('applied_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('developer_id', authUser.id);

      if (appliedJobsError) {
        console.error('[Dashboard] Error fetching applied jobs count:', appliedJobsError);
        setFetchedAppliedJobsCount(0); // Default to 0 on error
      } else {
        setFetchedAppliedJobsCount(appliedCount ?? 0);
        console.log('[Dashboard] Applied jobs count fetched:', appliedCount);
      }
      // Clear the old appliedJobs array
      setAppliedJobs([]);

    } catch (error) {
      console.error('[Dashboard] Critical error in fetchDeveloperPageData:', error);
    } finally {
      setDashboardPageLoading(false);
      console.log('[Dashboard] Finished fetching all developer page data.');
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (!authContextLoading && authUser?.id) {
        fetchDeveloperPageData();
    } else if (!authContextLoading && !authUser?.id) {
        setDashboardPageLoading(false); // Not logged in, stop loading
    }
  }, [authUser, authContextLoading, fetchDeveloperPageData]);

  useEffect(() => {
    if (shouldUseFreshDataSource && !freshGitHubLoading && dashboardPageLoading) setDashboardPageLoading(false);
  }, [shouldUseFreshDataSource, freshGitHubLoading, dashboardPageLoading]);

  // Effect to clear the fromGitHubSetup trigger flag from location.state after initial processing
  useEffect(() => {
    const state = location.state as DashboardLocationState | null;
    if (state?.fromGitHubSetup) { // Only care about fromGitHubSetup here
      console.log("[Dashboard] Initial Setup Effect: Clearing fromGitHubSetup flag from location.state.");
      const { fromGitHubSetup, ...restOfState } = state;
      navigate(location.pathname + location.search, {
        replace: true,
        state: Object.keys(restOfState).length > 0 ? restOfState : null
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationState?.fromGitHubSetup, navigate, location.pathname, location.search]); // Runs if fromGitHubSetup flag changes (i.e., present then removed)

  // Effect to update URL when activeTab state changes (e.g., from user click)
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
      const { fromGitHubSetup, ...restOfState } = locationState || {}; // fromGitHubSetup should be gone
      navigate(`${location.pathname}${newSearchString}`, {
        replace: true,
        state: Object.keys(restOfState).length > 0 ? restOfState : null
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, location.pathname, navigate]); // Removed locationState and location.search to simplify and make this purely activeTab driven

  // Effect to update activeTab state when URL changes (e.g., browser back/forward, direct URL edit)
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabFromUrl = queryParams.get('tab') as typeof activeTab | null;

    // Do not fight with the initial tab setting if fromGitHubSetup was just processed
    // The flag would have been cleared by the effect above, so locationState.fromGitHubSetup is likely null/undefined here.
    // This effect should primarily handle external URL changes.
    if (locationState?.fromGitHubSetup) return; // Skip if the initial setup flag is still somehow present (unlikely due to order)

    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      if (activeTab !== tabFromUrl) {
        console.log(`[Dashboard] URL to State Sync: Setting activeTab to '${tabFromUrl}' from URL.`);
        setActiveTab(tabFromUrl);
      }
    } else if (!tabFromUrl && activeTab !== 'overview') {
      console.log(`[Dashboard] URL to State Sync: No tab in URL, setting activeTab to 'overview'.`);
      setActiveTab('overview');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]); // Only depends on location.search; activeTab removed to avoid loops. locationState for the guard.

  useEffect(() => {
    if (shouldUseFreshDataSource && !freshGitHubLoading && freshGitHubDataFromHook?.user && !hasFreshDataBeenProcessed) {
      setLatchedSuccessfullyFetchedFreshData(freshGitHubDataFromHook);
      setHasFreshDataBeenProcessed(true);
    } else if (shouldUseFreshDataSource && !freshGitHubLoading && freshGitHubError && !hasFreshDataBeenProcessed) {
      setHasFreshDataBeenProcessed(true);
    }
  }, [shouldUseFreshDataSource, freshGitHubLoading, freshGitHubDataFromHook, freshGitHubError, hasFreshDataBeenProcessed]);

  useEffect(() => {
    if (locationState?.isFreshGitHubSetup && hasFreshDataBeenProcessed) { // isFreshGitHubSetup is the important one here
      console.log('[Dashboard] Clearing isFreshGitHubSetup flag from location.state.');
      const { freshGitHubHandle, freshGitHubInstallationId, isFreshGitHubSetup, fromGitHubSetup, ...restOfState } = locationState;
      navigate(location.pathname + location.search, { replace: true, state: Object.keys(restOfState).length > 0 ? restOfState : null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationState?.isFreshGitHubSetup, hasFreshDataBeenProcessed, navigate, location.pathname, location.search]);

  useEffect(() => {
    const show = activeTab === 'github-activity' && !!contextDeveloperProfile?.github_handle && !contextDeveloperProfile?.github_installation_id;
    if (showGitHubConnectModal !== show) setShowGitHubConnectModal(show);
  }, [contextDeveloperProfile?.github_handle, contextDeveloperProfile?.github_installation_id, activeTab, showGitHubConnectModal]);

  // Effect to extract recent commits from GitHub data
  useEffect(() => {
    if (finalGitHubDataToShow?.contributions && Array.isArray(finalGitHubDataToShow.contributions)) {
      const formattedCommits = finalGitHubDataToShow.contributions.slice(0, 3).map((contrib: any) => ({
        sha: contrib.oid || contrib.id || Math.random().toString(36).substring(7), // Ensure a unique key
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
    // Prioritize contextDeveloperProfile and merge with developerData if available.
    // This ensures we always have the latest from context (like GitHub handle after setup)
    // but also include details fetched directly in this component.
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
        // messages={messages} // OverviewTab might need a different structure or count for messages
        // For unread messages count, OverviewTab will need to derive it or receive a specific count prop.
        // Let's assume for now OverviewTab's 'messages' prop was for the count, we'll adjust if it needs full threads.
        // The `MessageList` component now handles its own data, so we don't pass `messages` from here to it.
        // The unread count for OverviewTab can be derived if `MessageList` exposes a way or if we fetch it separately.
        // For now, OverviewTab's unreadMessagesCount will be 0 or rely on developer.unread_message_count if such field existed.
        // To keep OverviewTab working, we can pass an empty array or adjust its props.
        // For now, I'll pass an empty array to messages for OverviewTab.
        // This needs to be revisited if OverviewTab's unread message logic is critical now.
        messages={[]} // This is for OverviewTab's internal unread message calculation from threads
        // Pass the fetched counts to OverviewTab. It will prioritize these over developer object's counts or array lengths.
        savedJobsCountOverride={fetchedSavedJobsCount}
        appliedJobsCountOverride={fetchedAppliedJobsCount}
        // The savedJobs/appliedJobs arrays below are now effectively unused by OverviewTab if counts are passed,
        // but kept for now to avoid breaking prop types if OverviewTab still expects them.
        // These arrays are now being cleared in fetchDeveloperPageData after counts are fetched.
        savedJobs={[]}
        appliedJobs={[]}
        endorsements={endorsements}
        recentCommits={recentCommits}
        githubProfileUrl={currentDeveloperProfile.github_handle ? `https://github.com/${currentDeveloperProfile.github_handle}` : undefined}
        loading={dashboardPageLoading || authContextLoading || gitHubDataLoadingToShow}
        onNavigateToTab={(tab) => setActiveTab(tab as typeof activeTab)}
      />
    );
  };
  
  console.log('[Dashboard RENDER]', /* ... */); // Keep this extensive log

  if (authContextLoading || (!authUser && !authContextLoading && !dashboardPageLoading)) { /* ... */ }
  if (dashboardPageLoading && !authContextLoading && authUser) { /* ... */ }
  if (!userProfile && !authContextLoading && !dashboardPageLoading) { /* ... */ }

  const displayDeveloperProfileForForm = currentDeveloperProfile; // Use the merged profile

  return (
    // ... Full JSX as previously provided, ensuring it uses *ToShow variables for GitHub data
    // and the corrected tab rendering logic.
    // For brevity, I'm not pasting the entire return() again but it should be the same as the last full version.
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-screen-xl mx-auto">
      {showGitHubConnectModal && contextDeveloperProfile?.github_handle && ( <GitHubConnectPrompt githubHandle={contextDeveloperProfile.github_handle} onClose={() => setShowGitHubConnectModal(false)} onConnect={() => navigate('/github-setup')} /> )}
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
          {validTabs.map((tabName) => (
            <button key={tabName} onClick={() => setActiveTab(tabName as typeof activeTab)}
              className={`whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${activeTab === tabName ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tabName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'profile' && (displayDeveloperProfileForForm ? <DeveloperProfileForm initialData={displayDeveloperProfileForForm} onSuccess={async () => { if(refreshProfile) await refreshProfile(); await fetchDeveloperPageData();}} isOnboarding={false} /> : <div className="text-center p-8">Loading...</div>)}
      {activeTab === 'portfolio' && <PortfolioManager developerId={authUser?.id || ''} />}
      {activeTab === 'github-activity' && (
        contextDeveloperProfile?.github_handle && contextDeveloperProfile?.github_installation_id ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5 flex-shrink-0"><div className="max-w-md mx-auto lg:mx-0 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                <RealGitHubChart githubHandle={contextDeveloperProfile.github_handle} gitHubData={finalGitHubDataToShow} loading={gitHubDataLoadingToShow} error={gitHubDataErrorToShow as Error | null} className="w-full" displayMode='dashboardSnippet' isGitHubAppInstalled={!!contextDeveloperProfile?.github_installation_id} />
            </div></div>
            <div className="lg:w-3/5 flex-grow bg-white p-4 sm:p-6 rounded-lg shadow-md border">
              {gitHubDataLoadingToShow && (<div className="flex flex-col items-center justify-center h-64"><Loader className="animate-spin h-10 w-10 text-blue-500 mb-4" /><p className="text-gray-600">{shouldUseFreshDataSource ? "Fetching latest GitHub activity..." : "Loading GitHub activity..."}</p></div>)}
              {!gitHubDataLoadingToShow && gitHubDataErrorToShow && (<div className="text-center py-10 px-6 bg-red-50 border border-red-200 rounded-lg"><AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" /><h3 className="text-lg font-semibold text-red-700">Error Loading GitHub Details</h3><p className="text-red-600 mt-2 text-sm">{typeof gitHubDataErrorToShow === 'string' ? gitHubDataErrorToShow : (gitHubDataErrorToShow as Error)?.message || 'An unknown error occurred.'}</p><button onClick={() => navigate('/github-setup')} className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Re-check</button></div>)}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && finalGitHubDataToShow?.user && (<GitHubUserActivityDetails gitHubData={finalGitHubDataToShow} />)}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && !finalGitHubDataToShow?.user && (<div className="text-center py-10 px-6 bg-yellow-50 border border-yellow-200 rounded-lg"><Github className="w-12 h-12 text-yellow-500 mx-auto mb-3" /><h3 className="text-lg font-semibold text-yellow-700">No GitHub Data Available</h3><p className="text-gray-600 mt-2 text-sm">Could not retrieve GitHub activity.</p><button onClick={async () => { setLatchedSuccessfullyFetchedFreshData(null); setHasFreshDataBeenProcessed(false); if(refreshProfile) await refreshProfile();}} className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Refresh</button></div>)}
            </div>
          </div>
        ) : (<div className="text-center p-8"><Github className="w-16 h-16 text-gray-300 mx-auto mb-6" /><h3 className="text-2xl font-semibold">Connect GitHub Account</h3><button onClick={() => { if (!currentDeveloperProfile?.github_handle) { setActiveTab('profile'); navigate('/developer?tab=profile', { state: { ...(locationState || {}), focusGitHubHandle: true } }); } else { navigate('/github-setup');}}} className="px-8 py-3 bg-blue-600 text-white rounded-lg"> {currentDeveloperProfile?.github_handle ? 'Connect GitHub App' : 'Add GitHub Handle in Profile'} </button></div>)
      )}
      {activeTab === 'messages' && (
        <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-250px)]"> {/* Ensure sufficient height */}
          <div className="md:w-1/3 h-full">
            <MessageList
              onThreadSelect={(threadDetails) => {
                setSelectedMessageThreadDetails(threadDetails);
                // Potentially trigger a refetch/update in MessageList if marking read is handled here
              }}
            />
          </div>
          <div className="md:w-2/3 h-full bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {selectedMessageThreadDetails ? (
              <MessageThread
                key={`${selectedMessageThreadDetails.otherUserId}-${selectedMessageThreadDetails.jobContext?.id || 'general'}`} // Key to re-mount component on thread change
                otherUserId={selectedMessageThreadDetails.otherUserId}
                otherUserName={selectedMessageThreadDetails.otherUserName}
                otherUserRole={selectedMessageThreadDetails.otherUserRole}
                otherUserProfilePicUrl={selectedMessageThreadDetails.otherUserProfilePicUrl}
                jobContext={selectedMessageThreadDetails.jobContext}
                onBack={() => setSelectedMessageThreadDetails(null)} // Simple way to go back for mobile or single pane views
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
    </div>
  );
};
