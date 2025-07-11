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
} from '../components';
import { useGitHub } from '../hooks/useGitHub'; 
import { useFreshGitHubDataOnce } from '../hooks/useFreshGitHubDataOnce';
import {
  User, Briefcase, MessageSquare, Search, Github, Star, TrendingUp, Calendar,
  DollarSign, MapPin, Clock, Send, ExternalLink, Building, Eye, SearchCheck, Loader, AlertCircle,
} from 'lucide-react';
import { Developer, JobRole, MessageThread as MessageThreadType } from '../types';

interface DashboardLocationState {
  freshGitHubHandle?: string;
  freshGitHubInstallationId?: string;
  isFreshGitHubSetup?: boolean;
  fromAuthCallback?: boolean;
  ghAppConnected?: boolean;
  focusGitHubHandle?: boolean;
  [key: string]: any;
}

const initialStateForGitHubData = { user: null, repos: [], languages: {}, totalStars: 0, contributions: [] };

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

  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'portfolio' | 'github-activity' | 'messages' | 'jobs'>('overview');
  
  const [developerData, setDeveloperData] = useState<Developer | null>(null);
  const [messages, setMessages] = useState<MessageThreadType[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<JobRole[]>([]);
  const [featuredPortfolioItem, setFeaturedPortfolioItem] = useState<any | null>(null);

  const [selectedMessageThreadId, setSelectedMessageThreadId] = useState<string | null>(null);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [showGitHubConnectModal, setShowGitHubConnectModal] = useState(false);

  const [dashboardPageLoading, setDashboardPageLoading] = useState(true);
  const [isFreshGitHubLoadAttempted, setIsFreshGitHubLoadAttempted] = useState(false);
 // ----- GitHub Data Handling -----
  const freshLoadParams = useMemo(() => {
    if (locationState?.isFreshGitHubSetup && locationState?.freshGitHubInstallationId) {
      const handle = locationState.freshGitHubHandle || contextDeveloperProfile?.github_handle;
      if (handle) {
        console.log(`[Dashboard] Memoized freshLoadParams: Will use handle='${handle}', installId='${locationState.freshGitHubInstallationId}'`);
        return { handle, installId: locationState.freshGitHubInstallationId };
      }
      console.log('[Dashboard] Memoized freshLoadParams: Fresh setup but handle missing from navState and contextDeveloperProfile.');
    }
    return null;
  }, [locationState?.isFreshGitHubSetup, locationState?.freshGitHubInstallationId, locationState?.freshGitHubHandle, contextDeveloperProfile?.github_handle]);

  // useFreshGitHubDataOnce hook - activated only if freshLoadParams are valid
  const { 
    gitHubData: freshGitHubData, 
    loading: freshGitHubLoading, 
    error: freshGitHubError 
  } = useFreshGitHubDataOnce({
    handle: freshLoadParams?.handle,
    installationId: freshLoadParams?.installId,
    active: !!freshLoadParams, // Only active if params are set
  });

  // useGitHub hook (standard context-based) - activated if not using fresh data
  const { 
    gitHubData: standardGitHubData, 
    loading: standardGitHubLoading, 
    error: standardGitHubError 
  } = useGitHub(!freshLoadParams); // Active if freshLoadParams are null

  // Determine which GitHub data source to use
  const shouldUseFreshData = !!freshLoadParams;
  const finalGitHubData = shouldUseFreshData ? freshGitHubData : standardGitHubData;
  const gitHubDataLoadingState = shouldUseFreshData ? freshGitHubLoading : standardGitHubLoading;
  const gitHubDataErrorState = shouldUseFreshData ? freshGitHubError : standardGitHubError;
  // ----- End GitHub Data Handling -----

  // Fetch developer-specific page data (not auth profiles, but other dashboard items)
  const fetchDeveloperPageData = useCallback(async () => {
    if (!authUser?.id) {
      console.log('[Dashboard] fetchDeveloperPageData: No authUser ID, cannot fetch.');
      setDashboardPageLoading(false); // Stop loading if no user
      return;
    }
    console.log('[Dashboard] fetchDeveloperPageData: Starting to fetch all page data.');
    setDashboardPageLoading(true); // Ensure page is in loading state
    try {
      // Fetch local developer data (distinct from contextDeveloperProfile if needed, or could be merged)
      const { data: devData, error: devError } = await supabase
        .from('developers') // Assuming 'developers' table holds this info
        .select('*, user:users(name, email)') // Example: join with users table for name/email
        .eq('user_id', authUser.id)
        .single();

      if (devError && devError.code !== 'PGRST116') { // PGRST116 means no rows found, not necessarily an error for this context
        console.error('[Dashboard] Error fetching local developer data:', devError);
        // Potentially set an error state here if needed
      } else if (devData) {
        console.log('[Dashboard] Local developer data fetched:', devData);
        setDeveloperData(devData as Developer);
      } else {
        console.warn('[Dashboard] No local developer data found for user (this might be normal for a new user).');
        setDeveloperData(null); // Explicitly set to null if no data
      }

      // TODO: Uncomment and implement these when ready
      // console.log('[Dashboard] Fetching messages...');
      // await fetchMessages(); // Implement this function
      // console.log('[Dashboard] Fetching featured portfolio item...');
      // await fetchFeaturedPortfolioItem(); // Implement this function
      // console.log('[Dashboard] Fetching recommended jobs...');
      // await fetchRecommendedJobs(); // Implement this function

      console.log('[Dashboard] fetchDeveloperPageData: General page data fetching complete.');
    } catch (error) {
      console.error('[Dashboard] Critical error in fetchDeveloperPageData:', error);
    } finally {
      // Page loading should be set to false regardless of GitHub data loading status here,
      // as this controls the main page content spinner, not the GitHub activity tab spinner.
      console.log('[Dashboard] fetchDeveloperPageData: Setting dashboardPageLoading to false.');
      setDashboardPageLoading(false);
    }
  }, [authUser?.id]); // Removed fetchMessages, fetchFeaturedPortfolioItem, fetchRecommendedJobs from deps as they are not defined yet
// Initial data fetch for the dashboard page content
  useEffect(() => {
    console.log(`[Dashboard] AuthUser effect: AuthContextLoading: ${authContextLoading}, AuthUser: ${authUser?.id}`);
    if (!authContextLoading && authUser?.id) {
      fetchDeveloperPageData();
    } else if (!authContextLoading && !authUser?.id) {
      // Auth is settled, but no user - likely means user signed out or session expired
      console.log('[Dashboard] AuthUser effect: Auth settled, no user. Setting page loading false.');
      setDashboardPageLoading(false);
      // Consider navigating to login if dashboard should not be accessible without a user
      // navigate('/login', { replace: true });
    }
  }, [authUser, authContextLoading, fetchDeveloperPageData]);

  // Effect to turn off overall page loading once fresh GitHub data is loaded (if it was a fresh setup)
  // This ensures the main page spinner doesn't stop until fresh GitHub data is also ready (if it was expected).
  useEffect(() => {
    if (shouldUseFreshGitHubData && !freshGitHubDataResults.loading && dashboardPageLoading) {
      console.log('[Dashboard] Fresh GitHub data has loaded, and page was still loading. Setting dashboardPageLoading to false.');
      setDashboardPageLoading(false);
    }
  }, [shouldUseFreshGitHubData, freshGitHubDataResults.loading, dashboardPageLoading]);

  // Effect to handle tab from URL query params on initial load and changes
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabFromUrl = queryParams.get('tab') as typeof activeTab | null;
    if (tabFromUrl && ['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].includes(tabFromUrl)) {
      if (activeTab !== tabFromUrl) { // Only set if different to avoid re-renders
        console.log(`[Dashboard] Tab Management: Setting activeTab from URL to '${tabFromUrl}'`);
        setActiveTab(tabFromUrl);
      }
    } else if (!tabFromUrl && activeTab !== 'overview') {
      // If no tab in URL, and current tab isn't overview, default to overview.
      console.log(`[Dashboard] Tab Management: No tab in URL, and current tab is not overview. Setting activeTab to 'overview'.`);
      setActiveTab('overview');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]); // Only trigger on search string change. activeTab is managed internally.

  // Effect to update active tab in URL
  useEffect(() => {
    const currentParams = new URLSearchParams(location.search);
    const currentTabInUrl = currentParams.get('tab');
    const targetTabInUrl = activeTab === 'overview' ? null : activeTab;

    if (currentTabInUrl !== targetTabInUrl) {
      if (targetTabInUrl) {
        currentParams.set('tab', targetTabInUrl);
      } else {
        currentParams.delete('tab');
      }
      const newSearch = currentParams.toString() ? `?${currentParams.toString()}` : '';
      console.log(`[Dashboard] Tab Management: Updating URL for activeTab '${activeTab}'. New search: '${newSearch}'`);
      // Preserve other potential state from location.state when updating URL for tab changes
      navigate(`${location.pathname}${newSearch}`, { replace: true, state: location.state });
    }
  }, [activeTab, navigate, location.pathname, location.search, location.state]);


  // Clear fresh GitHub setup state from navigation once processed
  useEffect(() => {
    // Condition to attempt clearing: fresh setup flag is true, fresh load params were determined,
    // and fresh data loading is complete (or errored out).
    if (locationState?.isFreshGitHubSetup && freshLoadParams && !freshGitHubLoading) {
      if (!isFreshGitHubLoadAttempted) {
        console.log('[Dashboard] Fresh GitHub data load attempt complete (loaded or error). Setting isFreshGitHubLoadAttempted to true, to trigger navState clear.');
        setIsFreshGitHubLoadAttempted(true);
      }
    }
  }, [locationState?.isFreshGitHubSetup, freshLoadParams, freshGitHubLoading, isFreshGitHubLoadAttempted]);

  useEffect(() => {
    // This effect runs when isFreshGitHubLoadAttempted becomes true
    if (isFreshGitHubLoadAttempted && locationState?.isFreshGitHubSetup) {
        console.log('[Dashboard] Clearing fresh GitHub setup navigation state from location.');
        // Preserve other state properties if they exist, only remove the fresh GitHub setup flags
        const {
          freshGitHubHandle,
          freshGitHubInstallationId,
          isFreshGitHubSetup,
          // Preserve other state properties if they exist
          ...restOfState
        } = locationState;

        navigate(location.pathname + location.search, {
            replace: true,
            state: Object.keys(restOfState).length > 0 ? restOfState : null
        });
        setIsFreshGitHubLoadAttempted(false); // Reset for this session
    }
  }, [isFreshGitHubLoadAttempted, locationState, location.pathname, location.search, navigate]);

  // Show GitHub Connect Prompt logic
  useEffect(() => {
    const shouldShow = activeTab === 'github-activity' &&
                       !!contextDeveloperProfile?.github_handle &&
                       !contextDeveloperProfile?.github_installation_id;
    if (showGitHubConnectModal !== shouldShow) {
        console.log(`[Dashboard] GitHub Connect Prompt: Should show: ${shouldShow}. Current state: ${showGitHubConnectModal}. Handle: ${contextDeveloperProfile?.github_handle}, Install ID: ${contextDeveloperProfile?.github_installation_id}`);
        setShowGitHubConnectModal(shouldShow);
    }
  }, [contextDeveloperProfile?.github_handle, contextDeveloperProfile?.github_installation_id, activeTab, showGitHubConnectModal]);
const renderOverview = () => {
    // Use developerData (local dashboard specific data) if available, otherwise fallback to contextDeveloperProfile
    // This allows for potentially richer data fetched specifically for the dashboard overview
    const displayDeveloperData = developerData || contextDeveloperProfile; 
    return (
      <div className="space-y-6">
        {displayDeveloperData && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Strength</h3>
            <ProfileStrengthIndicator strength={displayDeveloperData.profile_strength || 0} showDetails={true} />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-3 bg-blue-100 rounded-lg"><Github className="w-6 h-6 text-blue-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">GitHub Connection</p><p className="text-2xl font-bold text-gray-900">{contextDeveloperProfile?.github_installation_id ? 'Active' : 'Not Connected'}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-3 bg-cyan-100 rounded-lg"><SearchCheck className="w-6 h-6 text-cyan-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Search Appearances</p><p className="text-2xl font-bold text-gray-900">{displayDeveloperData?.search_appearance_count || 0}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-3 bg-green-100 rounded-lg"><MessageSquare className="w-6 h-6 text-green-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Unread Messages</p><p className="text-2xl font-bold text-gray-900">{messages.filter(m => !m.is_read && m.receiver_id === authUser?.id).length}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-3 bg-purple-100 rounded-lg"><Briefcase className="w-6 h-6 text-purple-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Job Interests</p><p className="text-2xl font-bold text-gray-900">{recommendedJobs.length > 0 ? recommendedJobs.length : '0'}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-3 bg-yellow-100 rounded-lg"><Eye className="w-6 h-6 text-yellow-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Profile Views</p><p className="text-2xl font-bold text-gray-900">{displayDeveloperData?.profile_view_count || 0}</p></div></div></div>
        </div>
        {featuredPortfolioItem && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Featured Project</h3>
              <button onClick={() => setActiveTab('portfolio')} className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All Projects</button>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              {featuredPortfolioItem.image_url && (
                <div className="mb-4">
                  <img src={featuredPortfolioItem.image_url} alt={featuredPortfolioItem.title} className="w-full h-48 object-cover rounded-xl border border-gray-200" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; }} />
                </div>
              )}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">{featuredPortfolioItem.title}</h4>
                  <p className="text-sm text-gray-700 mt-1">{featuredPortfolioItem.description}</p>
                </div>
              </div>
              <div className="flex space-x-4 text-xs text-gray-600">
                {featuredPortfolioItem.tech_stack?.map((tech: string, idx: number) => (
                  <span key={idx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{tech}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- MOCK FUNCTIONS / PLACEHOLDERS --- 
  const handleViewJobDetails = (job: JobRole) => { setSelectedJobForDetails(job); setShowJobDetailsModal(true); };
  const handleCloseJobDetails = () => { setSelectedJobForDetails(null); setShowJobDetailsModal(false); };
  const handleExpressInterest = async (jobId: string) => { console.log('Express interest for job', jobId); /* TODO */ };
  const handleViewRecruiter = (recruiterId: string) => { console.log('View recruiter', recruiterId); /* TODO */ };
  const handleMessageRecruiter = async (recruiterId: string, jobTitle?: string) => { console.log('Message recruiter', recruiterId, jobTitle); /* TODO */ };
  const renderJobSearch = () => <div className="p-4 bg-gray-50 rounded-lg shadow"><h3 class="text-lg font-semibold">Job Search (Placeholder)</h3><p>Job listings and search functionality will appear here.</p></div>;
  // --- END MOCK FUNCTIONS --- 
  
  console.log('[Dashboard RENDER]', 
    `PageLoad: ${dashboardPageLoading}`, 
    `AuthLoad: ${authContextLoading}`, 
    `User: ${authUser?.id?.substring(0,8)}`, 
    `UP: ${userProfile?.id?.substring(0,8)}`, 
    `DP: ${contextDeveloperProfile?.user_id?.substring(0,8)}(ghId:${contextDeveloperProfile?.github_installation_id ? 'SET' : 'NULL'})`, 
    `FreshParams: ${freshLoadParams ? JSON.stringify(freshLoadParams) : 'NULL'}`, 
    `FreshLoad: ${freshGitHubLoading}`, 
    `FreshErr: ${!!freshGitHubError}`, 
    `FreshData: ${!!freshGitHubData?.user}`, 
    `StdLoad: ${standardGitHubLoading}`, 
    `StdErr: ${!!standardGitHubError}`, 
    `StdData: ${!!standardGitHubData?.user}`, 
    `FinalGHLoad: ${gitHubDataLoadingState}`, 
    `FinalGHErr: ${!!gitHubDataErrorState}`,
    `FinalGHData: ${!!finalGitHubData?.user}`,
    `ActiveTab: ${activeTab}`
  );

  if (authContextLoading || (!authUser && !authContextLoading && !dashboardPageLoading)) {
    console.log('[Dashboard RENDER] Main loading spinner (auth context or initial page load).');
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader className="animate-spin h-12 w-12 text-blue-600" />
        <span className="ml-4 text-lg text-gray-700">Loading Dashboard...</span>
      </div>
    );
  }
  
  if (dashboardPageLoading && !authContextLoading && authUser) {
    console.log('[Dashboard RENDER] Dashboard page data loading spinner.');
     return (
      <div className="flex justify-center items-center h-screen">
        <Loader className="animate-spin h-12 w-12 text-blue-600" />
        <span className="ml-4 text-lg text-gray-700">Loading Your Details...</span>
      </div>
    );
  }

  if (!userProfile && !authContextLoading && !dashboardPageLoading) {
    console.log('[Dashboard RENDER] No user profile available after loading. Displaying error/prompt.');
    return (
        <div className="flex flex-col justify-center items-center h-screen p-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Profile Not Loaded</h2>
            <p className="text-gray-600 mb-6">We encountered an issue loading your profile. Please try refreshing the page or logging out and back in.</p>
            <button 
                onClick={() => refreshProfile ? refreshProfile() : window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-2"
            >
                Refresh Profile
            </button>
            <button 
                onClick={() => navigate('/login')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
                Go to Login
            </button>
        </div>
    );
  }

  const displayDeveloperProfileForForm = contextDeveloperProfile || developerData;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-screen-xl mx-auto">
      {showGitHubConnectModal && contextDeveloperProfile?.github_handle && (
        <GitHubConnectPrompt 
          githubHandle={contextDeveloperProfile.github_handle} 
          onClose={() => setShowGitHubConnectModal(false)} 
          onConnect={() => navigate('/github-setup')}
        />
      )}
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
          {['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].map((tabName) => (
            <button 
              key={tabName} 
              onClick={() => setActiveTab(tabName as typeof activeTab)} 
              className={`whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                ${activeTab === tabName 
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              {tabName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && renderOverview()}
      
      {activeTab === 'profile' && (
        displayDeveloperProfileForForm ? (
          <DeveloperProfileForm 
            initialData={displayDeveloperProfileForForm} 
            onSuccess={async () => { 
              if(refreshProfile) await refreshProfile(); 
              await fetchDeveloperPageData();
            }} 
            isOnboarding={false} 
          />
        ) : (
          <div className="text-center p-8 bg-white rounded-lg shadow-md border">
              <Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading profile information...</p>
          </div>
        )
      )}

      {activeTab === 'portfolio' && (
        <PortfolioManager developerId={authUser?.id || ''} />
      )}

      {activeTab === 'github-activity' && (
        contextDeveloperProfile?.github_handle && contextDeveloperProfile?.github_installation_id ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5 flex-shrink-0">
              <div className="max-w-md mx-auto lg:mx-0 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                <RealGitHubChart 
                  githubHandle={contextDeveloperProfile.github_handle} 
                  className="w-full" 
                  displayMode='dashboardSnippet' 
                />
              </div>
            </div>
            <div className="lg:w-3/5 flex-grow bg-white p-4 sm:p-6 rounded-lg shadow-md border">
              {gitHubDataLoadingState && (
                <div className="flex flex-col items-center justify-center h-64">
                  <Loader className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                  <p className="text-gray-600">
                    {shouldUseFreshData ? "Fetching latest GitHub activity..." : "Loading GitHub activity..."}
                  </p>
                </div>
              )}
              {!gitHubDataLoadingState && gitHubDataErrorState && (
                <div className="text-center py-10 px-6 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-red-700">Error Loading GitHub Details</h3>
                  <p className="text-red-600 mt-2 text-sm">{typeof gitHubDataErrorState === 'string' ? gitHubDataErrorState : (gitHubDataErrorState as Error)?.message || 'An unknown error occurred.'}</p>
                  <p className="text-xs text-gray-500 mt-3">If this persists, try reconnecting your GitHub account via Profile settings or visiting the GitHub setup page.</p>
                  <button onClick={() => navigate('/github-setup')} className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                    Re-check Connection
                  </button>
                </div>
              )}
              {!gitHubDataLoadingState && !gitHubDataErrorState && finalGitHubData?.user && (
                <GitHubUserActivityDetails gitHubData={finalGitHubData} />
              )}
              {!gitHubDataLoadingState && !gitHubDataErrorState && !finalGitHubData?.user && (
                // This condition implies loading is done, no error, but no user data from GitHub API
                <div className="text-center py-10 px-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Github className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-yellow-700">No GitHub Data Available</h3>
                  <p className="text-gray-600 mt-2 text-sm">
                    We couldn't find any GitHub activity to display. This could be because:
                  </p>
                  <ul className="list-disc list-inside text-left text-gray-500 mt-2 text-sm max-w-md mx-auto">
                    <li>Your GitHub account is newly connected and data is still syncing (please wait a few moments).</li>
                    <li>There hasn't been recent public activity on your GitHub account.</li>
                    <li>The GitHub handle in your profile might be incorrect or the app permissions need review.</li>
                  </ul>
                   <button 
                    onClick={async () => { 
                        console.log('[Dashboard] Manual refresh GitHub data clicked.');
                        if(shouldUseFreshData && freshLoadParams) {
                            // To re-trigger useFreshGitHubDataOnce, we might need to change its inputs or have an internal refetch
                            // For simplicity here, we could try re-setting freshLoadParams briefly
                            const params = {...freshLoadParams};
                            setFreshLoadParams(null); // Force it to re-evaluate
                            setTimeout(() => setFreshLoadParams(params), 50);
                        } else {
                            standardGitHubHook.refetch?.(); // Assuming useGitHub hook has a refetch method
                        }
                        if(refreshProfile) await refreshProfile(); // Also refresh context profile data
                    }} 
                    className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                   >
                    Refresh Data
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-white rounded-lg shadow-md border">
            <Github className="w-16 h-16 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-gray-700 mb-3">Connect Your GitHub Account</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Link your GitHub account to automatically showcase your projects, contributions, and coding activity. This helps potential employers understand your skills.
            </p>
            <button 
              onClick={() => {
                if (!contextDeveloperProfile?.github_handle) {
                  setActiveTab('profile');
                  // Optionally navigate to profile with a hint to fill GitHub handle
                  navigate('/developer?tab=profile', { state: { ...(locationState || {}), focusGitHubHandle: true } });
                } else {
                  navigate('/github-setup');
                }
              }}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm hover:shadow-md"
            >
              {contextDeveloperProfile?.github_handle ? 'Connect GitHub App' : 'Go to Profile to Add GitHub Handle'}
            </button>
          </div>
        )
      )}

      {activeTab === 'messages' && (
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3 flex-shrink-0">
            <MessageList messages={messages} onSelectThread={setSelectedMessageThreadId} selectedThreadId={selectedMessageThreadId} />
          </div>
          <div className="md:w-2/3 flex-grow">
            {selectedMessageThreadId ? (
              <MessageThread threadId={selectedMessageThreadId} />
            ) : (
              <div className="bg-white p-6 rounded-lg shadow border h-full flex items-center justify-center min-h-[300px]">
                <p className="text-gray-500">Select a message to view its content.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <>
          {renderJobSearch()}{showJobDetailsModal && selectedJobForDetails && (
            <JobRoleDetails 
              job={selectedJobForDetails} 
              onClose={handleCloseJobDetails} 
              onExpressInterest={handleExpressInterest} 
              onViewRecruiter={handleViewRecruiter} 
              onMessageRecruiter={handleMessageRecruiter} 
            />
          )}
          {/* {showRecruiterProfile && selectedRecruiterId && (
            <RecruiterProfileDetails recruiterId={selectedRecruiterId} onClose={() => setShowRecruiterProfile(false)} onMessageRecruiter={handleMessageRecruiter} />
          )} */}
        </>
      )}
    </div>
  );
};
