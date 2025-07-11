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
  fromGitHubSetup?: boolean;
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
  const [hasFreshDataBeenProcessed, setHasFreshDataBeenProcessed] = useState(false);
  const [latchedSuccessfullyFetchedFreshData, setLatchedSuccessfullyFetchedFreshData] = useState<typeof initialStateForGitHubData | null>(null);

  const freshLoadParams = useMemo(() => {
    if (locationState?.isFreshGitHubSetup && locationState?.freshGitHubInstallationId) {
      const handle = locationState.freshGitHubHandle || contextDeveloperProfile?.github_handle;
      if (handle) {
        return { handle, installId: locationState.freshGitHubInstallationId };
      }
    }
    return null;
  }, [locationState?.isFreshGitHubSetup, locationState?.freshGitHubInstallationId, locationState?.freshGitHubHandle, contextDeveloperProfile?.github_handle]);

  const { 
    gitHubData: freshGitHubDataFromHook,
    loading: freshGitHubLoading, 
    error: freshGitHubError 
  } = useFreshGitHubDataOnce({
    handle: freshLoadParams?.handle,
    installationId: freshLoadParams?.installId,
    active: !!freshLoadParams,
  });

  const { 
    gitHubData: standardGitHubData, 
    loading: standardGitHubLoading, 
    error: standardGitHubError 
  } = useGitHub(!freshLoadParams && !latchedSuccessfullyFetchedFreshData);

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
    if (!authUser?.id) { setDashboardPageLoading(false); return; }
    setDashboardPageLoading(true);
    try {
      const { data: devData, error: devError } = await supabase.from('developers').select('*, user:users(name, email)').eq('user_id', authUser.id).single();
      if (devError && devError.code !== 'PGRST116') console.error('[Dashboard] Error fetching local developer data:', devError);
      else if (devData) setDeveloperData(devData as Developer);
      else setDeveloperData(null);
    } catch (error) { console.error('[Dashboard] Critical error in fetchDeveloperPageData:', error); }
    finally { setDashboardPageLoading(false); }
  }, [authUser?.id]);

  useEffect(() => {
    if (!authContextLoading && authUser?.id) fetchDeveloperPageData();
    else if (!authContextLoading && !authUser?.id) setDashboardPageLoading(false);
  }, [authUser, authContextLoading, fetchDeveloperPageData]);

  useEffect(() => {
    if (shouldUseFreshDataSource && !freshGitHubLoading && dashboardPageLoading) {
      setDashboardPageLoading(false);
    }
  }, [shouldUseFreshDataSource, freshGitHubLoading, dashboardPageLoading]);

  useEffect(() => {
    const state = location.state as DashboardLocationState | null;
    if (state?.fromGitHubSetup && state?.isFreshGitHubSetup && activeTab !== 'github-activity') {
      setActiveTab('github-activity');
      const { fromGitHubSetup, ...restOfState } = state;
      navigate(location.pathname + location.search, { replace: true, state: Object.keys(restOfState).length > 0 ? restOfState : null });
    }
  }, [locationState?.fromGitHubSetup, locationState?.isFreshGitHubSetup, navigate, location.pathname, location.search, activeTab]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabFromUrl = queryParams.get('tab') as typeof activeTab | null;
    const state = location.state as DashboardLocationState | null;
    let newTab = activeTab;

    if (state?.fromGitHubSetup && state?.isFreshGitHubSetup && activeTab !== 'github-activity') {
      newTab = 'github-activity';
      if(activeTab !== newTab) setActiveTab(newTab);
    } else if (tabFromUrl && tabFromUrl !== activeTab) {
      if (['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].includes(tabFromUrl)) {
        newTab = tabFromUrl;
        setActiveTab(tabFromUrl);
      }
    } else if (!tabFromUrl && activeTab !== 'overview') {
      if (!(state?.isFreshGitHubSetup && activeTab === 'github-activity')) {
         newTab = 'overview';
         setActiveTab('overview');
      }
    }

    const currentUrlParams = new URLSearchParams(location.search);
    const currentTabInUrl = currentUrlParams.get('tab');
    const targetTabForUrl = newTab === 'overview' ? null : newTab;

    if (currentTabInUrl !== targetTabForUrl) {
      const newUrlParams = new URLSearchParams();
      if (targetTabForUrl) newUrlParams.set('tab', targetTabForUrl);
      new URLSearchParams(location.search).forEach((value, key) => {
        if (key !== 'tab' && !newUrlParams.has(key)) newUrlParams.append(key, value);
      });
      const newSearchString = newUrlParams.toString() ? `?${newUrlParams.toString()}` : '';
      const { fromGitHubSetup, ...restOfNavState } = state || {};
      const finalNavState = Object.keys(restOfNavState).length > 0 ? restOfNavState : null;
      navigate(`${location.pathname}${newSearchString}`, { replace: true, state: finalNavState });
    }
  }, [activeTab, location.search, location.state, navigate, location.pathname]);

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
      const { freshGitHubHandle, freshGitHubInstallationId, isFreshGitHubSetup, fromGitHubSetup, ...restOfState } = locationState;
      navigate(location.pathname + location.search, { replace: true, state: Object.keys(restOfState).length > 0 ? restOfState : null });
    }
  }, [locationState, hasFreshDataBeenProcessed, navigate, location.pathname, location.search]);

  useEffect(() => {
    const show = activeTab === 'github-activity' && !!contextDeveloperProfile?.github_handle && !contextDeveloperProfile?.github_installation_id;
    if (showGitHubConnectModal !== show) setShowGitHubConnectModal(show);
  }, [contextDeveloperProfile?.github_handle, contextDeveloperProfile?.github_installation_id, activeTab, showGitHubConnectModal]);

  const renderOverview = () => {
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
              {featuredPortfolioItem.image_url && (<img src={featuredPortfolioItem.image_url} alt={featuredPortfolioItem.title} className="w-full h-48 object-cover rounded-xl border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />)}
              <div className="flex items-start justify-between mb-3 mt-4"><div className="flex-1"><h4 className="text-lg font-semibold">{featuredPortfolioItem.title}</h4><p className="text-sm text-gray-700 mt-1">{featuredPortfolioItem.description}</p></div></div>
              <div className="flex space-x-4 text-xs">{featuredPortfolioItem.tech_stack?.map((tech: string, idx: number) => (<span key={idx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{tech}</span>))}</div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  console.log('[Dashboard RENDER]', 
    `PageLoad: ${dashboardPageLoading}`, `AuthLoad: ${authContextLoading}`,
    `FreshParams: ${freshLoadParams ? JSON.stringify(freshLoadParams) : 'NULL'}`, 
    `FreshLoad(Source): ${freshGitHubLoading}`, `FreshErr(Source): ${!!freshGitHubError}`, `FreshData(Hook): ${!!freshGitHubDataFromHook?.user}`,
    `LatchedFreshData: ${!!latchedSuccessfullyFetchedFreshData?.user}`,
    `StdLoad: ${standardGitHubLoading}`, `StdErr: ${!!standardGitHubError}`, `StdData: ${!!standardGitHubData?.user}`,
    `FinalGHLoad: ${gitHubDataLoadingToShow}`, `FinalGHErr: ${!!gitHubDataErrorToShow}`, `FinalGHData: ${!!finalGitHubDataToShow?.user}`,
    `ActiveTab: ${activeTab}`, `shouldUseFreshDataSource: ${shouldUseFreshDataSource}`, `hasFreshDataBeenProcessed: ${hasFreshDataBeenProcessed}`
  );

  if (authContextLoading || (!authUser && !authContextLoading && !dashboardPageLoading)) {
    return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin h-12 w-12 text-blue-600" /><span className="ml-4 text-lg text-gray-700">Loading Dashboard...</span></div>;
  }
  if (dashboardPageLoading && !authContextLoading && authUser) {
     return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin h-12 w-12 text-blue-600" /><span className="ml-4 text-lg text-gray-700">Loading Your Details...</span></div>;
  }
  if (!userProfile && !authContextLoading && !dashboardPageLoading) {
    return (
        <div className="flex flex-col justify-center items-center h-screen p-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Profile Not Loaded</h2>
            <p className="text-gray-600 mb-6">We encountered an issue loading your profile. Please try refreshing the page or logging out and back in.</p>
            <button onClick={() => refreshProfile ? refreshProfile() : window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-2">Refresh Profile</button>
            <button onClick={() => navigate('/login')} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">Go to Login</button>
        </div>
    );
  }

  const displayDeveloperProfileForForm = contextDeveloperProfile || developerData;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-screen-xl mx-auto">
      {showGitHubConnectModal && contextDeveloperProfile?.github_handle && (
        <GitHubConnectPrompt githubHandle={contextDeveloperProfile.github_handle} onClose={() => setShowGitHubConnectModal(false)} onConnect={() => navigate('/github-setup')} />
      )}
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
          {['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].map((tabName) => (
            <button key={tabName} onClick={() => setActiveTab(tabName as typeof activeTab)}
              className={`whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${activeTab === tabName ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tabName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && renderOverview()}
      
      {activeTab === 'profile' && (
        displayDeveloperProfileForForm ?
          <DeveloperProfileForm initialData={displayDeveloperProfileForForm} onSuccess={async () => { if(refreshProfile) await refreshProfile(); await fetchDeveloperPageData();}} isOnboarding={false} />
          : <div className="text-center p-8 bg-white rounded-lg shadow-md border"><Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" /><p className="text-gray-600">Loading profile information...</p></div>
      )}

      {activeTab === 'portfolio' && <PortfolioManager developerId={authUser?.id || ''} />}

      {activeTab === 'github-activity' && (
        contextDeveloperProfile?.github_handle && contextDeveloperProfile?.github_installation_id ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5 flex-shrink-0">
              <div className="max-w-md mx-auto lg:mx-0 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                <RealGitHubChart
                  githubHandle={contextDeveloperProfile.github_handle}
                  gitHubData={finalGitHubDataToShow}
                  loading={gitHubDataLoadingToShow}
                  error={gitHubDataErrorToShow as Error | null}
                  className="w-full"
                  displayMode='dashboardSnippet'
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
                  <p className="text-red-600 mt-2 text-sm">{typeof gitHubDataErrorToShow === 'string' ? gitHubDataErrorToShow : (gitHubDataErrorToShow as Error)?.message || 'An unknown error occurred.'}</p>
                  <button onClick={() => navigate('/github-setup')} className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">Re-check Connection</button>
                </div>
              )}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && finalGitHubDataToShow?.user && (
                <GitHubUserActivityDetails gitHubData={finalGitHubDataToShow} />
              )}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && !finalGitHubDataToShow?.user && (
                <div className="text-center py-10 px-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Github className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-yellow-700">No GitHub Data Available</h3>
                  <p className="text-gray-600 mt-2 text-sm">Could not retrieve GitHub activity. This might be temporary or due to missing data.</p>
                   <button onClick={async () => {
                       console.log('[Dashboard] Manual refresh GitHub data clicked.');
                       setLatchedSuccessfullyFetchedFreshData(null);
                       setHasFreshDataBeenProcessed(false);
                       if (locationState?.isFreshGitHubSetup || !contextDeveloperProfile?.github_installation_id) {
                           if(refreshProfile) await refreshProfile();
                       } else {
                           if(refreshProfile) await refreshProfile();
                       }
                    }} className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Refresh Data</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-white rounded-lg shadow-md border">
            <Github className="w-16 h-16 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-gray-700 mb-3">Connect Your GitHub Account</h3>
            <button onClick={() => { if (!contextDeveloperProfile?.github_handle) { setActiveTab('profile'); navigate('/developer?tab=profile', { state: { ...(locationState || {}), focusGitHubHandle: true } }); } else { navigate('/github-setup');}}} className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm hover:shadow-md">
              {contextDeveloperProfile?.github_handle ? 'Connect GitHub App' : 'Go to Profile to Add GitHub Handle'}
            </button>
          </div>
        )
      )}

      {activeTab === 'messages' && (
         <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3"><MessageList messages={messages} onSelectThread={setSelectedMessageThreadId} selectedThreadId={selectedMessageThreadId} /></div>
          <div className="md:w-2/3">{selectedMessageThreadId ? <MessageThread threadId={selectedMessageThreadId} /> : <div className="p-6 text-center">Select a message.</div>}</div>
        </div>
      )}
      {activeTab === 'jobs' && (
         <div className="p-4 bg-gray-50 rounded-lg shadow"><h3 className="text-lg font-semibold">Job Search (Placeholder)</h3><p>Job listings and search functionality will appear here.</p></div>
      )}
    </div>
  );
};
