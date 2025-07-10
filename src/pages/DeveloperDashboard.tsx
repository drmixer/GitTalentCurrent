import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { 
  DeveloperProfileForm,
  PortfolioManager,
  MessageList,
  MessageThread,
  JobSearchList,
  JobRoleDetails,
  ProfileStrengthIndicator,
  RealGitHubChart,
  RecruiterProfileDetails,
  GitHubUserActivityDetails
} from '../components';
import { useGitHub } from '../hooks/useGitHub';
import { useFreshGitHubDataOnce } from '../hooks/useFreshGitHubDataOnce';
import { 
  User, Briefcase, MessageSquare, Search, Github, Star, TrendingUp, Calendar,
  DollarSign, MapPin, Clock, Send, ExternalLink, Building, Eye, SearchCheck
} from 'lucide-react';
import { GitHubConnectPrompt } from '../components/GitHubConnectPrompt';

interface Developer {
  user_id: string;
  github_handle: string;
  bio: string;
  availability: boolean;
  top_languages: string[];
  linked_projects: string[];
  location: string;
  experience_years: number;
  desired_salary: number;
  skills_categories: any;
  profile_strength: number;
  public_profile_slug: string;
  notification_preferences: any;
  resume_url: string;
  profile_pic_url: string;
  github_installation_id?: string | null;
  search_appearance_count?: number;
  profile_view_count?: number;
  user: { name: string; email: string; };
}
interface JobRole {
  id: string; title: string; description: string; location: string; job_type: string;
  tech_stack: string[]; salary_min: number; salary_max: number; experience_required: string;
  is_active: boolean; is_featured: boolean; created_at: string;
  recruiter: { id: string; name: string; company_name: string; };
}
interface MessageThread {
  id: string; sender_id: string; receiver_id: string; subject: string; body: string;
  sent_at: string; is_read: boolean;
  sender: { name: string; }; receiver: { name: string; };
}

const initialStateForGitHubData = { user: null, repos: [], languages: {}, totalStars: 0, contributions: [] };

export const DeveloperDashboard: React.FC = () => {
  const { user } = useAuth(); // Assuming this 'user' is the Supabase Auth user
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'portfolio' | 'github-activity' | 'messages' | 'jobs'>('overview');
  const [developer, setDeveloper] = useState<Developer | null>(null); // Local developer state
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true); // Renamed from 'loading' to avoid conflict
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showRecruiterProfile, setShowRecruiterProfile] = useState(false);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);
  const [recommendedJobs, setRecommendedJobs] = useState<JobRole[]>([]);
  const [featuredPortfolioItem, setFeaturedPortfolioItem] = useState<any | null>(null);
  const [showGitHubConnectPrompt, setShowGitHubConnectPrompt] = useState(false);
  const [gitHubDataProcessed, setGitHubDataProcessed] = useState(false); // New state

  const navigate = useNavigate();
  const location = useLocation();

  const freshSetupState = location.state as {
    freshGitHubHandle?: string;
    freshGitHubInstallationId?: string;
    isFreshGitHubSetup?: boolean;
  } | null;

  const { userProfile, developerProfile: contextDeveloperProfile } = useAuth();

  const [freshLoadParams, setFreshLoadParams] = useState<{ handle: string; installId: string } | null>(null);
  const [attemptedFreshLoadInit, setAttemptedFreshLoadInit] = useState(false);

  useEffect(() => {
    const isFresh = freshSetupState?.isFreshGitHubSetup;
    const navInstallId = freshSetupState?.freshGitHubInstallationId;

    if (isFresh && navInstallId) {
      if (!attemptedFreshLoadInit) {
        const navHandle = freshSetupState.freshGitHubHandle;
        const contextHandle = contextDeveloperProfile?.github_handle;
        const handleToUse = navHandle || contextHandle;

        if (handleToUse) {
          console.log(`[Dashboard] Initializing STABLE fresh load params: handle=${handleToUse}, installId=${navInstallId}`);
          setFreshLoadParams({ handle: handleToUse, installId: navInstallId });
          setAttemptedFreshLoadInit(true);
        } else {
          console.log('[Dashboard] Fresh setup detected, but handle still missing from navState and context. Waiting for context handle to populate.');
        }
      }
    } else {
      if (attemptedFreshLoadInit || freshLoadParams) {
        console.log('[Dashboard] Clearing stable fresh load params (not a fresh setup or navState cleared).');
        setFreshLoadParams(null);
        setAttemptedFreshLoadInit(false);
      }
    }
  }, [
    freshSetupState?.isFreshGitHubSetup,
    freshSetupState?.freshGitHubInstallationId,
    freshSetupState?.freshGitHubHandle,
    contextDeveloperProfile?.github_handle,
    attemptedFreshLoadInit,
    freshLoadParams
  ]);

  const shouldUseFreshGitHubData = !!(freshLoadParams?.handle && freshLoadParams.installId);

  const freshGitHubDataResults = useFreshGitHubDataOnce({
    handle: shouldUseFreshGitHubData ? freshLoadParams.handle : undefined,
    installationId: shouldUseFreshGitHubData ? String(freshLoadParams.installId) : undefined,
    active: shouldUseFreshGitHubData,
  });

  const standardGitHubHook = useGitHub(!shouldUseFreshGitHubData); // Activate if not using fresh data

  let derivedGitHubData = shouldUseFreshGitHubData ? freshGitHubDataResults.gitHubData : standardGitHubHook.gitHubData;
  let derivedLoading = shouldUseFreshGitHubData ? freshGitHubDataResults.loading : standardGitHubHook.loading;
  let derivedError = shouldUseFreshGitHubData ? freshGitHubDataResults.error : standardGitHubHook.error;

  // Logging current data sources
  console.log('[Dashboard] freshSetupState:', freshSetupState);
  console.log('[Dashboard] contextDeveloperProfile on render:', contextDeveloperProfile);
  console.log('[Dashboard] freshLoadParams:', freshLoadParams);
  console.log('[Dashboard] shouldUseFreshGitHubData:', shouldUseFreshGitHubData);
  console.log('[Dashboard] freshGitHubDataResults:', { loading: freshGitHubDataResults.loading, error: freshGitHubDataResults.error, hasUser: !!freshGitHubDataResults.gitHubData?.user });
  console.log('[Dashboard] standardGitHubHook:', { loading: standardGitHubHook.loading, error: standardGitHubHook.error, hasUser: !!standardGitHubHook.gitHubData?.user });
  console.log('[Dashboard] Derived Values:', { derivedLoading, derivedError: !!derivedError, derivedDataUser: !!derivedGitHubData?.user });


  const fetchAllData = async () => {
    if (!user?.id) {
      console.log('[Dashboard] fetchAllData: No user ID, cannot fetch.');
      setPageLoading(false); // Stop loading if no user
      return;
    }
    console.log('[Dashboard] fetchAllData: Starting to fetch all page data.');
    setPageLoading(true); // Ensure page is in loading state
    try {
      const { data: devData, error: devError } = await supabase
        .from('developers')
        .select('*, user:users(*)')
        .eq('user_id', user.id)
        .single();

      if (devError) throw devError;
      if (devData) {
        console.log('[Dashboard] fetchAllData: Developer data fetched:', devData);
        setDeveloper(devData as Developer);
      } else {
        console.warn('[Dashboard] fetchAllData: No developer data found for user.');
      }

      // Example of fetching other data - replace with your actual calls
      // await fetchMessages();
      // await fetchFeaturedPortfolioItem();
      // await fetchRecommendedJobs();

      console.log('[Dashboard] fetchAllData: General page data fetching complete.');
    } catch (error) {
      console.error('[Dashboard] Error in fetchAllData:', error);
    } finally {
      // Do not set pageLoading to false here if we are waiting for GitHub data in a fresh setup
      if (!(shouldUseFreshGitHubData && freshGitHubDataResults.loading)) {
        console.log('[Dashboard] fetchAllData: Setting pageLoading to false (either not fresh setup or fresh GH data already loaded).');
        setPageLoading(false);
      } else {
        console.log('[Dashboard] fetchAllData: Deferring setPageLoading(false) as fresh GitHub data is still loading.');
      }
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAllData();
    } else if (!useAuth().loading) { // If auth context is not loading and there's no user
      setPageLoading(false); // Stop loading if no user and auth is settled
    }
  }, [user, useAuth().loading]); // Rerun if user or authLoading state changes

  // Effect to turn off page loading once fresh GitHub data is loaded (if it was a fresh setup)
  useEffect(() => {
    if (shouldUseFreshGitHubData && !freshGitHubDataResults.loading && pageLoading) {
      console.log('[Dashboard] Fresh GitHub data has loaded, and page was still loading. Setting pageLoading to false.');
      setPageLoading(false);
      setGitHubDataProcessed(true); // Mark that we've handled the fresh GitHub data load
    }
  }, [shouldUseFreshGitHubData, freshGitHubDataResults.loading, pageLoading]);

  // Effect to handle tab from URL query params
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tab = queryParams.get('tab');
    if (tab && ['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].includes(tab)) {
      setActiveTab(tab as any);
    }
    // Clean up navigation state if it was for fresh GitHub setup, after it has been processed
    if (freshSetupState?.isFreshGitHubSetup && attemptedFreshLoadInit && !freshGitHubDataResults.loading) {
        console.log('[Dashboard] Fresh GitHub setup processed (data loaded or error), clearing navigation state.');
        navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.search, freshSetupState, attemptedFreshLoadInit, freshGitHubDataResults.loading, navigate, location.pathname]);

  // Effect to update active tab in URL (without triggering data refetch unless tab actually changes)
  useEffect(() => {
    const currentParams = new URLSearchParams(location.search);
    const currentTabInUrl = currentParams.get('tab');
    if (activeTab === 'overview' && currentTabInUrl) {
      navigate('/developer', { replace: true, state: location.state });
    } else if (activeTab !== 'overview' && currentTabInUrl !== activeTab) {
      navigate(`/developer?tab=${activeTab}`, { replace: true, state: location.state });
    } else if (activeTab !== 'overview' && !currentTabInUrl) {
      // If tab is not overview but no tab in URL, add it
      navigate(`/developer?tab=${activeTab}`, { replace: true, state: location.state });
    }
  }, [activeTab, navigate, location.state, location.search]);

  useEffect(() => {
    if (!contextDeveloperProfile?.github_installation_id && contextDeveloperProfile?.github_handle) {
        setShowGitHubConnectPrompt(true);
    } else {
        setShowGitHubConnectPrompt(false);
    }
  }, [contextDeveloperProfile]);


  const renderOverview = () => {
    return (
      <div className="space-y-6">
        {developer && ( <div className="bg-white rounded-lg shadow-sm border p-6"> <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Strength</h3> <ProfileStrengthIndicator strength={developer.profile_strength} showDetails={true} /> </div> )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-blue-100 rounded-lg"><Github className="w-6 h-6 text-blue-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">GitHub Activity</p><p className="text-2xl font-bold text-gray-900">{contextDeveloperProfile?.github_handle && contextDeveloperProfile?.github_installation_id ? 'Active' : 'Not Connected'}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-cyan-100 rounded-lg"><SearchCheck className="w-6 h-6 text-cyan-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Search Appearances</p><p className="text-2xl font-bold text-gray-900">{developer?.search_appearance_count || 0}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-green-100 rounded-lg"><MessageSquare className="w-6 h-6 text-green-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Unread Messages</p><p className="text-2xl font-bold text-gray-900">{messages.filter(m => !m.is_read && m.receiver_id === user?.id).length}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-purple-100 rounded-lg"><Briefcase className="w-6 h-6 text-purple-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Job Interests</p><p className="text-2xl font-bold text-gray-900">{recommendedJobs.length > 0 ? recommendedJobs.length : '--'}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-yellow-100 rounded-lg"><Eye className="w-6 h-6 text-yellow-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Profile Views</p><p className="text-2xl font-bold text-gray-900">{developer?.profile_view_count || 0}</p></div></div></div>
        </div>
        {featuredPortfolioItem && ( <div className="bg-white rounded-lg shadow-sm border p-6"> <div className="flex items-center justify-between mb-6"> <h3 className="text-lg font-semibold text-gray-900">Featured Project</h3> <button onClick={() => setActiveTab('portfolio')} className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All Projects</button> </div> <div className="bg-gray-50 rounded-xl p-6 border border-gray-200"> {featuredPortfolioItem.image_url && (<div className="mb-4"><img src={featuredPortfolioItem.image_url} alt={featuredPortfolioItem.title} className="w-full h-48 object-cover rounded-xl border border-gray-200" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; }} /></div>)} <div className="flex items-start justify-between mb-3"><div className="flex-1"><h4 className="text-lg font-semibold text-gray-900">{featuredPortfolioItem.title}</h4><p className="text-sm text-gray-700 mt-1">{featuredPortfolioItem.description}</p></div></div> <div className="flex space-x-4 text-xs text-gray-600">{featuredPortfolioItem.tech_stack?.map((tech: string, idx: number) => (<span key={idx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{tech}</span>))}</div> </div> </div> )}
      </div>
    );
  };

  console.log('[Dashboard RENDER STATE] Page Loading:', pageLoading, '| GitHub Data Loading:', derivedLoading, '| GitHub Data User:', !!derivedGitHubData?.user, '| GitHub Error:', !!derivedError);
  console.log('[Dashboard RENDER STATE] shouldUseFresh:', shouldUseFreshGitHubData, 'freshLoadParams:', freshLoadParams);
  console.log('[Dashboard RENDER STATE] contextDeveloperProfile ghInstId:', contextDeveloperProfile?.github_installation_id);

  if (pageLoading) {
    console.log('[Dashboard RENDER] Rendering PAGE SPINNER');
    return (<div className="flex justify-center items-center h-96"><svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span className="ml-3 text-gray-700">Loading Dashboard...</span></div>);
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {showGitHubConnectPrompt && (<GitHubConnectPrompt githubHandle={contextDeveloperProfile?.github_handle || ''} onClose={() => setShowGitHubConnectPrompt(false)} />)}
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as typeof activeTab)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </nav>
      </div>
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'profile' && developer && (<DeveloperProfileForm initialData={developer} onSuccess={fetchAllData} isOnboarding={false} />)}
      {activeTab === 'portfolio' && (<PortfolioManager developerId={user?.id || ''} />)}
      {activeTab === 'github-activity' && ( contextDeveloperProfile?.github_handle && contextDeveloperProfile?.github_installation_id ? (
        <div className="flex flex-wrap md:flex-nowrap gap-6">
          <div className="w-full md:w-2/5 flex-shrink-0">
            <div className="max-w-sm mx-auto md:mx-0">
              <RealGitHubChart githubHandle={contextDeveloperProfile.github_handle} className="w-full" displayMode='dashboardSnippet' />
            </div>
          </div>
          <div className="w-full md:w-3/5 flex-grow">
            {console.log('[Dashboard RENDER] In GitHub Activity Section. derivedLoading:', derivedLoading, 'derivedError:', derivedError, 'derivedGitHubData?.user:', !!derivedGitHubData?.user)}
            {derivedLoading && (
              <>{console.log('[Dashboard RENDER] Rendering GitHub Section SPINNER')}
              <div className="flex justify-center items-center h-full bg-white p-6 rounded-lg shadow-sm border">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4a10 10 0 00-10 10h2zm8 10a10 10 0 0010-10h-2a8 8 0 01-8 8v2z"></path></svg>
                <span className="ml-3 text-gray-500">
                  {(shouldUseFreshGitHubData && !freshLoadParams?.handle) ? "Verifying GitHub connection..." : "Loading GitHub Details..."}
                </span>
              </div>
              </>
            )}
            {!derivedLoading && derivedError && (
              <>{console.log('[Dashboard RENDER] Rendering GitHub Section ERROR')}
              <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
                <h3 className="text-lg font-semibold text-red-600">Error Loading GitHub Details</h3>
                <p className="text-gray-500 mt-2">{derivedError.message}</p>
              </div>
              </>
            )}
            {!derivedLoading && !derivedError && derivedGitHubData?.user && (
              <>{console.log('[Dashboard RENDER] Rendering GitHubUserActivityDetails COMPONENT')}
              <GitHubUserActivityDetails gitHubData={derivedGitHubData} />
              </>
            )}
            {!derivedLoading && !derivedError && !derivedGitHubData?.user && (
              <>{console.log('[Dashboard RENDER] Rendering GitHub Section NO DATA')}
              <div className="bg-white p-6 rounded-lg shadow-sm border h-full"><p className="text-gray-500">No GitHub data available. Ensure your handle is set and app connected. If you just connected, data might take a moment to appear.</p></div>
              </>
            )}
          </div>
        </div>
      ) : (
        <>{console.log('[Dashboard RENDER] Rendering GitHub Section CONNECT PROMPT')}
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border">
          <Github className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">GitHub Activity Not Available</h3>
          <p className="text-gray-500 mb-6">Please complete your profile with your GitHub handle and connect the GitTalent GitHub App to see your activity.</p>
          <button onClick={() => setActiveTab('profile')} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"> Go to Profile to Connect </button>
        </div>
        </>
      )
    )}
      {activeTab === 'messages' && (<div className="flex space-x-6"><MessageList messages={messages} onSelectThread={setSelectedThread} selectedThreadId={selectedThread} />{selectedThread && (<MessageThread threadId={selectedThread} />)}</div>)}
      {activeTab === 'jobs' && (<>{renderJobSearch()}{showJobDetailsModal && selectedJobForDetails && (<JobRoleDetails job={selectedJobForDetails} onClose={handleCloseJobDetails} onExpressInterest={handleExpressInterest} onViewRecruiter={handleViewRecruiter} onMessageRecruiter={handleMessageRecruiter} />)}{showRecruiterProfile && selectedRecruiterId && (<RecruiterProfileDetails recruiterId={selectedRecruiterId} onClose={() => setShowRecruiterProfile(false)} onMessageRecruiter={handleMessageRecruiter} />)}</>)}
    </div>
  );
};
