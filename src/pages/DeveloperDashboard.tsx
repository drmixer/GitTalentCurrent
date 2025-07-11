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
  fromGitHubSetup?: boolean; // Added for clarity from GitHubAppSetup.tsx
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

  const shouldUseFreshData = !!freshLoadParams;
  const finalGitHubData = shouldUseFreshData ? freshGitHubData : standardGitHubData;
  const gitHubDataLoadingState = shouldUseFreshData ? freshGitHubLoading : standardGitHubLoading;
  const gitHubDataErrorState = shouldUseFreshData ? freshGitHubError : standardGitHubError;
  // ----- End GitHub Data Handling -----

  const fetchDeveloperPageData = useCallback(async () => {
    if (!authUser?.id) {
      setDashboardPageLoading(false);
      return;
    }
    setDashboardPageLoading(true);
    try {
      const { data: devData, error: devError } = await supabase
        .from('developers')
        .select('*, user:users(name, email)')
        .eq('user_id', authUser.id)
        .single();
      if (devError && devError.code !== 'PGRST116') console.error('[Dashboard] Error fetching local developer data:', devError);
      else if (devData) setDeveloperData(devData as Developer);
      else setDeveloperData(null);
    } catch (error) {
      console.error('[Dashboard] Critical error in fetchDeveloperPageData:', error);
    } finally {
      setDashboardPageLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (!authContextLoading && authUser?.id) {
      fetchDeveloperPageData();
    } else if (!authContextLoading && !authUser?.id) {
      setDashboardPageLoading(false);
    }
  }, [authUser, authContextLoading, fetchDeveloperPageData]);

  useEffect(() => {
    if (shouldUseFreshData && !freshGitHubLoading && dashboardPageLoading) {
      setDashboardPageLoading(false);
    }
  }, [shouldUseFreshData, freshGitHubLoading, dashboardPageLoading]);

  // Effect to set initial tab after GitHub App Setup
  useEffect(() => {
    const state = location.state as DashboardLocationState | null;
    if (state?.fromGitHubSetup && state?.isFreshGitHubSetup && activeTab !== 'github-activity') {
      console.log("[Dashboard] Initial Tab Setup: fromGitHubSetup detected, setting to github-activity");
      setActiveTab('github-activity');
      // Clean the fromGitHubSetup flag from location.state as it has served its purpose for initial tab setting
      const { fromGitHubSetup, ...restOfState } = state;
      navigate(location.pathname + location.search, {
        replace: true,
        state: Object.keys(restOfState).length > 0 ? restOfState : null
      },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationState?.fromGitHubSetup, locationState?.isFreshGitHubSetup, navigate, location.pathname, location.search]);

  // Effect to synchronize URL tab parameter with activeTab state (Main Sync Effect)
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabFromUrl = queryParams.get('tab') as typeof activeTab | null;
    const state = location.state as DashboardLocationState | null;
    let newTab = activeTab;

    if (state?.fromGitHubSetup && state?.isFreshGitHubSetup && activeTab !== 'github-activity') {
      // This case should ideally be caught by the previous useEffect, but as a fallback:
      newTab = 'github-activity';
      if(activeTab !== newTab) setActiveTab(newTab);
    } else if (tabFromUrl && tabFromUrl !== activeTab) {
      if (['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].includes(tabFromUrl)) {
        newTab = tabFromUrl;
        setActiveTab(tabFromUrl);
      }
    } else if (!tabFromUrl && activeTab !== 'overview') {
      // Only default to overview if not in a fresh setup state that should target github-activity
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

      // Important: When updating URL, ensure `isFreshGitHubSetup` is preserved if still relevant,
      // but `fromGitHubSetup` should have been cleared by the initial tab setting effect.
      const { fromGitHubSetup, ...restOfNavState } = state || {};
      const finalNavState = Object.keys(restOfNavState).length > 0 ? restOfNavState : null;

      navigate(`${location.pathname}${newSearchString}`, { replace: true, state: finalNavState });
    }
  }, [activeTab, location.search, location.state, navigate, location.pathname]);

  // Effect to process fresh GitHub data and then allow nav state clearing
  useEffect(() => {
    if (shouldUseFreshData && !freshGitHubLoading && freshGitHubData?.user && !hasFreshDataBeenProcessed) {
      console.log('[Dashboard] Fresh GitHub data successfully fetched. Marking as processed.');
      setHasFreshDataBeenProcessed(true);
    } else if (shouldUseFreshData && !freshGitHubLoading && freshGitHubError && !hasFreshDataBeenProcessed) {
      console.log('[Dashboard] Fresh GitHub data fetching failed. Marking as processed for nav state cleanup.');
      setHasFreshDataBeenProcessed(true);
    }
  }, [shouldUseFreshData, freshGitHubLoading, freshGitHubData, freshGitHubError, hasFreshDataBeenProcessed]);

  // Effect to clear navigation state after fresh data has been processed
  useEffect(() => {
    // Only clear if isFreshGitHubSetup was true and data processing is now marked complete
    if (locationState?.isFreshGitHubSetup && hasFreshDataBeenProcessed) {
      console.log('[Dashboard] Clearing fresh GitHub setup navigation state.');
      const {
        freshGitHubHandle,
        freshGitHubInstallationId,
        isFreshGitHubSetup,
        fromGitHubSetup, // Ensure this is also cleared
        ...restOfState
      } = locationState;
      navigate(location.pathname + location.search, {
          replace: true,
          state: Object.keys(restOfState).length > 0 ? restOfState : null
      });
      // Do not reset hasFreshDataBeenProcessed here, it's for the lifetime of this "fresh load"
    }
  }, [locationState, hasFreshDataBeenProcessed, navigate, location.pathname, location.search]);

  // Show GitHub Connect Prompt logic
  useEffect(() => {
    const shouldShow = activeTab === 'github-activity' &&
                       !!contextDeveloperProfile?.github_handle &&
                       !contextDeveloperProfile?.github_installation_id;
    if (showGitHubConnectModal !== shouldShow) {
        setShowGitHubConnectModal(shouldShow);
    }
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
          {/* Cards */}
        </div>
        {/* FeaturedProject */}
      </div>
    );
  };
  
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
        ) : <div className="text-center p-8">Loading profile form...</div>
      )}

      {activeTab === 'portfolio' && <PortfolioManager developerId={authUser?.id || ''} />}

      {activeTab === 'github-activity' && (
        contextDeveloperProfile?.github_handle && contextDeveloperProfile?.github_installation_id ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5"><RealGitHubChart githubHandle={contextDeveloperProfile.github_handle} className="w-full" displayMode='dashboardSnippet' /></div>
            <div className="lg:w-3/5">
              {gitHubDataLoadingState && <div className="text-center p-8">Loading GitHub activity...</div>}
              {!gitHubDataLoadingState && gitHubDataErrorState && <div className="text-center p-8 text-red-500">Error: {typeof gitHubDataErrorState === 'string' ? gitHubDataErrorState : 'Could not load GitHub data.'}</div>}
              {!gitHubDataLoadingState && !gitHubDataErrorState && finalGitHubData?.user && <GitHubUserActivityDetails gitHubData={finalGitHubData} />}
              {!gitHubDataLoadingState && !gitHubDataErrorState && !finalGitHubData?.user && <div className="text-center p-8">No GitHub data available.</div>}
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
