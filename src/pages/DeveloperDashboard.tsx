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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'portfolio' | 'github-activity' | 'messages' | 'jobs'>('overview');
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showRecruiterProfile, setShowRecruiterProfile] = useState(false);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);
  const [recommendedJobs, setRecommendedJobs] = useState<JobRole[]>([]);
  const [featuredPortfolioItem, setFeaturedPortfolioItem] = useState<any | null>(null);
  const [showGitHubConnectPrompt, setShowGitHubConnectPrompt] = useState(false);

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

  const freshGitHubDataResults = useFreshGitHubDataOnce({
    handle: freshLoadParams?.handle,
    installationId: freshLoadParams?.installId,
  });

  const standardGitHubHook = useGitHub();
  let gitHubData, gitHubDataLoading, gitHubDataError;

  if (freshLoadParams && freshLoadParams.handle && freshLoadParams.installId) {
    console.log(`[Dashboard] Path: Using useFreshGitHubDataOnce with stable params (handle: ${freshLoadParams.handle}, id: ${freshLoadParams.installId})`);
    gitHubData = freshGitHubDataResults.gitHubData;
    gitHubDataLoading = freshGitHubDataResults.loading;
    gitHubDataError = freshGitHubDataResults.error;
  } else if (freshSetupState?.isFreshGitHubSetup && !freshLoadParams) {
    console.log("[Dashboard] Path: Fresh setup, waiting for handle to populate for fresh load params.");
    gitHubDataLoading = true;
    gitHubData = initialStateForGitHubData;
    gitHubDataError = null;
  } else {
    console.log(`[Dashboard] Path: Using useGitHub (isFreshGitHubSetup: ${freshSetupState?.isFreshGitHubSetup}, freshLoadParams handle: ${freshLoadParams?.handle}).`);
    gitHubData = standardGitHubHook.gitHubData;
    gitHubDataLoading = standardGitHubHook.loading;
    gitHubDataError = standardGitHubHook.error;
  }

  console.log('[Dashboard] Final selected GitHub data source - Loading:', gitHubDataLoading, 'Error:', !!gitHubDataError, 'Data user:', !!gitHubData?.user);
  console.log('[Dashboard] Initial contextDeveloperProfile:', contextDeveloperProfile);
  console.log('[Dashboard] Initial userProfile from useAuth:', userProfile);
  console.log('[Dashboard] Location state for fresh setup:', freshSetupState);

  // Define renderJobSearch function (content omitted for brevity, assuming it's unchanged)
  const renderJobSearch = () => { /* ... same as before ... */ };
  useEffect(() => { if (location.search) { /* ... same as before ... */ } }, [location.search]);
  useEffect(() => { if (user) { /* ... fetchAllData ... */ } }, [user]);
  useEffect(() => { /* ... showGitHubConnectPrompt logic ... */ }, [developer, contextDeveloperProfile]);
  useEffect(() => { if (activeTab !== 'overview') navigate(`/developer?tab=${activeTab}`, { replace: true, state: location.state }); else navigate('/developer', { replace: true, state: location.state }); }, [activeTab, navigate, location.state]);

  // --- TEMPORARILY COMMENTED OUT FOR DIAGNOSING REACT #301 ERROR ---
  /*
  useEffect(() => {
    let cleanupTimerId: NodeJS.Timeout | null = null;
    if (freshSetupState?.isFreshGitHubSetup) {
      // This effect now depends on freshLoadParams being successfully set before clearing navState
      // and also on useFreshGitHubDataOnce completing its load.
      const dataLoaded = freshLoadParams && !freshGitHubDataResults.loading && !!freshGitHubDataResults.gitHubData?.user;
      const errorOccurred = freshLoadParams && freshGitHubDataResults.error;

      if (dataLoaded || errorOccurred) { // Clear navState if data loaded or if an error occurred in fresh load
        console.log(`[Dashboard] Fresh GitHub setup processed (success/error). Scheduling navState clear. DataLoaded: ${dataLoaded}, Error: ${!!errorOccurred}`);
        cleanupTimerId = setTimeout(() => {
          console.log('[Dashboard] Clearing navState (freshSetupState).');
          navigate(location.pathname + location.search, { replace: true, state: null });
        }, 100);
      }
    }
    return () => { if (cleanupTimerId) clearTimeout(cleanupTimerId); };
  }, [
    freshSetupState?.isFreshGitHubSetup,
    freshLoadParams,
    freshGitHubDataResults.loading,
    freshGitHubDataResults.gitHubData?.user,
    freshGitHubDataResults.error,
    navigate, location.pathname, location.search
  ]);
  */

  const fetchDeveloperData = async () => { /* ... same as before ... */ };
  const fetchMessages = async () => { /* ... same as before ... */ };
  const fetchFeaturedPortfolioItem = async () => { /* ... same as before ... */ };
  const fetchRecommendedJobs = async () => { /* ... same as before ... */ };
  const handleViewJobDetails = (job: JobRole) => { /* ... same as before ... */ };
  const handleViewRecruiter = (recruiterId: string) => { /* ... same as before ... */ };
  const handleCloseJobDetails = () => { /* ... same as before ... */ };
  const handleMessageRecruiter = async (recruiterId: string, jobTitle?: string) => { /* ... same as before ... */ };
  const handleExpressInterest = async (jobId: string) => { /* ... same as before ... */ };
  const sendInterestMessage = async (recruiterId: string, jobTitle: string) => { /* ... same as before ... */ };
  const renderOverview = () => { /* ... same as before, ensure all JSX is valid ... */
    return (
      <div className="space-y-6">
        {developer && ( <div className="bg-white rounded-lg shadow-sm border p-6"> <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Strength</h3> <ProfileStrengthIndicator strength={developer.profile_strength} showDetails={true} /> </div> )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-blue-100 rounded-lg"><Github className="w-6 h-6 text-blue-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">GitHub Activity</p><p className="text-2xl font-bold text-gray-900">{developer?.github_handle ? 'Active' : 'Not Connected'}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-cyan-100 rounded-lg"><SearchCheck className="w-6 h-6 text-cyan-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Search Appearances</p><p className="text-2xl font-bold text-gray-900">{developer?.search_appearance_count || 0}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-green-100 rounded-lg"><MessageSquare className="w-6 h-6 text-green-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Unread Messages</p><p className="text-2xl font-bold text-gray-900">{messages.filter(m => !m.is_read && m.receiver_id === user?.id).length}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-purple-100 rounded-lg"><Briefcase className="w-6 h-6 text-purple-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Job Interests</p><p className="text-2xl font-bold text-gray-900">{recommendedJobs.length > 0 ? recommendedJobs.length : '--'}</p></div></div></div>
          <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-yellow-100 rounded-lg"><Eye className="w-6 h-6 text-yellow-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Profile Views</p><p className="text-2xl font-bold text-gray-900">{developer?.profile_view_count || 0}</p></div></div></div>
        </div>
        {featuredPortfolioItem && ( <div className="bg-white rounded-lg shadow-sm border p-6"> <div className="flex items-center justify-between mb-6"> <h3 className="text-lg font-semibold text-gray-900">Featured Project</h3> <button onClick={() => setActiveTab('portfolio')} className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All Projects</button> </div> <div className="bg-gray-50 rounded-xl p-6 border border-gray-200"> {featuredPortfolioItem.image_url && (<div className="mb-4"><img src={featuredPortfolioItem.image_url} alt={featuredPortfolioItem.title} className="w-full h-48 object-cover rounded-xl border border-gray-200" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; }} /></div>)} <div className="flex items-start justify-between mb-3"><div className="flex-1"><h4 className="text-lg font-semibold text-gray-900">{featuredPortfolioItem.title}</h4><p className="text-sm text-gray-700 mt-1">{featuredPortfolioItem.description}</p></div></div> <div className="flex space-x-4 text-xs text-gray-600">{featuredPortfolioItem.tech_stack?.map((tech: string, idx: number) => (<span key={idx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{tech}</span>))}</div> </div> </div> )}
      </div>
    );
  };

  if (loading) { return (<div className="flex justify-center items-center h-96"><svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg></div>); }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {showGitHubConnectPrompt && (<GitHubConnectPrompt githubHandle={developer?.github_handle || ''} onClose={() => setShowGitHubConnectPrompt(false)} />)}
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
      {activeTab === 'profile' && developer && (<DeveloperProfileForm initialData={developer} onSuccess={fetchDeveloperData} isOnboarding={false} />)}
      {activeTab === 'portfolio' && (<PortfolioManager developerId={user?.id || ''} />)}
      {activeTab === 'github-activity' && ( developer?.github_handle ? ( <div className="flex flex-wrap md:flex-nowrap gap-6"> <div className="w-full md:w-2/5 flex-shrink-0"> <div className="max-w-sm mx-auto md:mx-0"> <RealGitHubChart githubHandle={developer.github_handle} className="w-full" displayMode='dashboardSnippet' /> </div> </div> <div className="w-full md:w-3/5 flex-grow"> {gitHubDataLoading && ( <div className="flex justify-center items-center h-full bg-white p-6 rounded-lg shadow-sm border"> <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4a10 10 0 00-10 10h2zm8 10a10 10 0 0010-10h-2a8 8 0 01-8 8v2z"></path></svg> <span className="ml-3 text-gray-500"> {(freshLoadParams && !freshLoadParams.handle && freshSetupState?.isFreshGitHubSetup) ? "Verifying GitHub connection..." : "Loading GitHub Details..."} </span> </div> )} {!gitHubDataLoading && gitHubDataError && ( <div className="bg-white p-6 rounded-lg shadow-sm border h-full"> <h3 className="text-lg font-semibold text-red-600">Error Loading GitHub Details</h3> <p className="text-gray-500 mt-2">{gitHubDataError.message}</p> </div> )} {!gitHubDataLoading && !gitHubDataError && gitHubData?.user && ( <GitHubUserActivityDetails gitHubData={gitHubData} /> )} {!gitHubDataLoading && !gitHubDataError && !gitHubData?.user && ( <div className="bg-white p-6 rounded-lg shadow-sm border h-full"><p className="text-gray-500">No GitHub data available. Ensure your handle is set and app connected.</p></div> )} </div> </div> ) : ( <div className="text-center p-8 bg-white rounded-lg shadow-sm border"> <Github className="w-12 h-12 text-gray-300 mx-auto mb-4" /> <h3 className="text-xl font-semibold text-gray-700 mb-2">GitHub Activity Not Available</h3> <p className="text-gray-500 mb-6">Please complete your profile and connect the GitTalent GitHub App.</p> <button onClick={() => setActiveTab('profile')} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"> Go to Profile </button> </div> ) )}
      {activeTab === 'messages' && (<div className="flex space-x-6"><MessageList messages={messages} onSelectThread={setSelectedThread} selectedThreadId={selectedThread} />{selectedThread && (<MessageThread threadId={selectedThread} />)}</div>)}
      {activeTab === 'jobs' && (<>{renderJobSearch()}{showJobDetailsModal && selectedJobForDetails && (<JobRoleDetails job={selectedJobForDetails} onClose={handleCloseJobDetails} onExpressInterest={handleExpressInterest} onViewRecruiter={handleViewRecruiter} onMessageRecruiter={handleMessageRecruiter} />)}{showRecruiterProfile && selectedRecruiterId && (<RecruiterProfileDetails recruiterId={selectedRecruiterId} onClose={() => setShowRecruiterProfile(false)} onMessageRecruiter={handleMessageRecruiter} />)}</>)}
    </div>
  );
};
