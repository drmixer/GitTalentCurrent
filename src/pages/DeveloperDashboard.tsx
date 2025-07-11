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
    gitHubData: freshGitHubData, 
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
  } = useGitHub(!freshLoadParams);

  const shouldUseFreshDataSource = !!freshLoadParams;

  let finalGitHubDataToShow = standardGitHubData;
  let gitHubDataLoadingToShow = standardGitHubLoading;
  let gitHubDataErrorToShow = standardGitHubError;

  if (hasFreshDataBeenProcessed && freshGitHubData?.user) {
      console.log('[Dashboard RENDER] Prioritizing processed fresh GitHub data.');
      finalGitHubDataToShow = freshGitHubData;
      gitHubDataLoadingToShow = false;
      gitHubDataErrorToShow = null;
  } else if (shouldUseFreshDataSource) {
      console.log('[Dashboard RENDER] Using direct fresh GitHub data source.');
      finalGitHubDataToShow = freshGitHubData;
      gitHubDataLoadingToShow = freshGitHubLoading;
      gitHubDataErrorToShow = freshGitHubError;
  } else {
      console.log('[Dashboard RENDER] Using standard GitHub data source.');
  }

  const fetchDeveloperPageData = useCallback(async () => {
    if (!authUser?.id) {
      setDashboardPageLoading(false); return;
    }
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
    if (shouldUseFreshDataSource && !freshGitHubLoading && dashboardPageLoading) { // shouldUseFreshDataSource here
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
    if (shouldUseFreshDataSource && !freshGitHubLoading && freshGitHubData?.user && !hasFreshDataBeenProcessed) {
      setHasFreshDataBeenProcessed(true);
    } else if (shouldUseFreshDataSource && !freshGitHubLoading && freshGitHubError && !hasFreshDataBeenProcessed) {
      setHasFreshDataBeenProcessed(true);
    }
  }, [shouldUseFreshDataSource, freshGitHubLoading, freshGitHubData, freshGitHubError, hasFreshDataBeenProcessed]);

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

  const renderOverview = () => { /* ... */ };
  
  console.log('[Dashboard RENDER]', 
    `PageLoad: ${dashboardPageLoading}`, `AuthLoad: ${authContextLoading}`, `User: ${authUser?.id?.substring(0,8)}`,
    `UP: ${userProfile?.id?.substring(0,8)}`, `DP: ${contextDeveloperProfile?.user_id?.substring(0,8)}(ghId:${contextDeveloperProfile?.github_installation_id ? 'SET' : 'NULL'})`,
    `FreshParams: ${freshLoadParams ? JSON.stringify(freshLoadParams) : 'NULL'}`, 
    `FreshLoad(Source): ${freshGitHubLoading}`, `FreshErr(Source): ${!!freshGitHubError}`, `FreshData(Source): ${!!freshGitHubData?.user}`,
    `StdLoad: ${standardGitHubLoading}`, `StdErr: ${!!standardGitHubError}`, `StdData: ${!!standardGitHubData?.user}`,
    `FinalGHLoad: ${gitHubDataLoadingToShow}`, `FinalGHErr: ${!!gitHubDataErrorToShow}`, `FinalGHData: ${!!finalGitHubDataToShow?.user}`,
    `ActiveTab: ${activeTab}`, `shouldUseFreshDataSource: ${shouldUseFreshDataSource}`, `hasFreshDataBeenProcessed: ${hasFreshDataBeenProcessed}`
  );

  if (authContextLoading || (!authUser && !authContextLoading && !dashboardPageLoading)) {
    return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin h-12 w-12 text-blue-600" /><span className="ml-4">Loading Dashboard...</span></div>;
  }
  if (dashboardPageLoading && !authContextLoading && authUser) {
     return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin h-12 w-12 text-blue-600" /><span className="ml-4">Loading Your Details...</span></div>;
  }
  if (!userProfile && !authContextLoading && !dashboardPageLoading) {
    return <div className="text-center p-8">Error loading profile. Please refresh or log in again.</div>;
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
          : <div className="text-center p-8">Loading profile form...</div>
      )}

      {activeTab === 'portfolio' && <PortfolioManager developerId={authUser?.id || ''} />}

      {activeTab === 'github-activity' && (
        contextDeveloperProfile?.github_handle && contextDeveloperProfile?.github_installation_id ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5"><RealGitHubChart githubHandle={contextDeveloperProfile.github_handle} className="w-full" displayMode='dashboardSnippet' /></div>
            <div className="lg:w-3/5">
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
                  <button onClick={() => navigate('/github-setup')} className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Re-check</button>
                </div>
              )}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && finalGitHubDataToShow?.user && (
                <GitHubUserActivityDetails gitHubData={finalGitHubDataToShow} />
              )}
              {!gitHubDataLoadingToShow && !gitHubDataErrorToShow && !finalGitHubDataToShow?.user && (
                <div className="text-center p-8">No GitHub data available.</div>
              )}
            </div>
          </div>
        ) : <div className="text-center p-8">Connect GitHub to see activity.</div>
      )}

      {activeTab === 'messages' && (
         <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3"><MessageList messages={messages} onSelectThread={setSelectedMessageThreadId} selectedThreadId={selectedMessageThreadId} /></div>
          <div className="md:w-2/3">{selectedMessageThreadId ? <MessageThread threadId={selectedMessageThreadId} /> : <div className="p-6 text-center">Select a message.</div>}</div>
        </div>
      )}

      {activeTab === 'jobs' && <div>Job Search Placeholder</div>}
    </div>
  );
};
