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
import { useFreshGitHubDataOnce } from '../hooks/useFreshGitHubDataOnce'; // Import new hook
import { 
  User, 
  Briefcase, 
  MessageSquare, 
  Search, 
  Github,
  Star,
  TrendingUp,
  Calendar,
  DollarSign,
  MapPin,
  Clock, 
  Send,
  ExternalLink,
  Building,
  Eye, // Added Eye icon
  SearchCheck // Added for Search Appearances
  // ListChecks, LayoutGrid removed as their stat cards are reverted
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
  github_installation_id?: string | null; // Added to local Developer type
  search_appearance_count?: number; // Added
  profile_view_count?: number; // Added
  user: {
    name: string;
    email: string;
  };
}

interface JobRole {
  id: string;
  title: string;
  description: string;
  location: string;
  job_type: string;
  tech_stack: string[];
  salary_min: number;
  salary_max: number;
  experience_required: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  recruiter: {
    id: string; // Added recruiter id
    name: string;
    company_name: string;
  };
}

interface MessageThread {
  id: string;
  sender_id: string;
  receiver_id: string;
  subject: string;
  body: string;
  sent_at: string;
  is_read: boolean;
  sender: {
    name: string;
  };
  receiver: {
    name: string;
  };
}

// Define initialStateForGitHubData globally or import if it's defined elsewhere and typed
const initialStateForGitHubData = { user: null, repos: [], languages: {}, totalStars: 0, contributions: [] };


export const DeveloperDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'portfolio' | 'github-activity' | 'messages' | 'jobs'>('overview');
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // This is for general page data like developer profile, messages etc.
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  // const [showJobSearch, setShowJobSearch] = useState(false); // This state seems unused
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
    isFreshGitHubSetup?: boolean
  } | null;

  const { userProfile, developerProfile: contextDeveloperProfile } = useAuth();

  const [derivedHandle, setDerivedHandle] = useState<string | null>(null);
  const [isAttemptingFreshLoad, setIsAttemptingFreshLoad] = useState<boolean>(false);
  const [freshLoadStatus, setFreshLoadStatus] = useState<'idle' | 'waiting_for_handle' | 'loading_data' | 'error' | 'success'>('idle');

  // Effect to manage deriving the handle for fresh setup
  useEffect(() => {
    // Only attempt this if we have a fresh setup marker and installation ID from nav state
    if (freshSetupState?.isFreshGitHubSetup && freshSetupState.freshGitHubInstallationId) {
      setIsAttemptingFreshLoad(true); // Mark that we are in the fresh load path

      if (freshSetupState.freshGitHubHandle) {
        console.log('[Dashboard] Fresh setup: Using handle from navState:', freshSetupState.freshGitHubHandle);
        setDerivedHandle(freshSetupState.freshGitHubHandle);
        setFreshLoadStatus('loading_data'); // Ready to load data with this handle
      } else if (contextDeveloperProfile?.github_handle) {
        console.log('[Dashboard] Fresh setup: navState handle missing, using handle from context:', contextDeveloperProfile.github_handle);
        setDerivedHandle(contextDeveloperProfile.github_handle);
        setFreshLoadStatus('loading_data'); // Ready to load data with this handle
      } else {
        console.log('[Dashboard] Fresh setup: Waiting for github_handle from navState or context...');
        setFreshLoadStatus('waiting_for_handle'); // Still waiting for a handle
        // derivedHandle remains null
      }
    } else {
      // Not a fresh setup, or critical info (isFreshGitHubSetup, freshGitHubInstallationId) missing from navState
      setIsAttemptingFreshLoad(false);
      setDerivedHandle(null); // Ensure derivedHandle is reset if not a fresh setup
      setFreshLoadStatus('idle');
    }
  }, [freshSetupState, contextDeveloperProfile?.github_handle]); // Re-run if navState or context handle changes


  // Prepare props for useFreshGitHubDataOnce.
  // It will only be "active" (i.e., fetch data) if both handle and installationId are valid strings.
  const freshHookDataInput = {
    handle: (isAttemptingFreshLoad && derivedHandle) ? derivedHandle : undefined,
    installationId: (isAttemptingFreshLoad && derivedHandle) ? freshSetupState?.freshGitHubInstallationId : undefined,
  };

  const freshGitHubDataResults = useFreshGitHubDataOnce(freshHookDataInput);
  const standardGitHubHook = useGitHub(); // Standard hook, always called

  let gitHubData, gitHubDataLoading, gitHubDataError;

  if (isAttemptingFreshLoad) {
    if (derivedHandle && freshSetupState?.freshGitHubInstallationId) {
      // We have a derived handle and installation ID, so useFreshGitHubDataOnce results are relevant.
      console.log(`[Dashboard] Fresh load path: Using useFreshGitHubDataOnce with derivedHandle '${derivedHandle}'.`);
      gitHubData = freshGitHubDataResults.gitHubData;
      gitHubDataLoading = freshGitHubDataResults.loading; // This will be true while useFreshGitHubDataOnce fetches
      gitHubDataError = freshGitHubDataResults.error;

      // Update freshLoadStatus based on the hook's progress
      if (gitHubDataLoading) {
        setFreshLoadStatus('loading_data');
      } else if (gitHubDataError) {
        setFreshLoadStatus('error');
         console.error('[Dashboard] Error from useFreshGitHubDataOnce:', gitHubDataError.message);
      } else if (gitHubData?.user) { // Assuming .user indicates successful data load
        setFreshLoadStatus('success');
      }
    } else {
      // Still in fresh load path but waiting for derivedHandle.
      console.log('[Dashboard] Fresh load path: Waiting for derived handle to use useFreshGitHubDataOnce.');
      gitHubDataLoading = true; // Show general loading for GitHub section
      gitHubData = initialStateForGitHubData;
      gitHubDataError = null;
      // freshLoadStatus should already be 'waiting_for_handle' from the useEffect above
    }
  } else {
    // Not a fresh load attempt, use standard useGitHub hook.
    console.log('[Dashboard] Standard path: Using useGitHub.');
    gitHubData = standardGitHubHook.gitHubData;
    gitHubDataLoading = standardGitHubHook.loading;
    gitHubDataError = standardGitHubHook.error;
    if (freshLoadStatus !== 'idle') setFreshLoadStatus('idle'); // Ensure reset if we switch paths
  }

  console.log('[Dashboard] Final selected GitHub data source - Loading:', gitHubDataLoading, 'Error:', !!gitHubDataError, 'Data:', !!gitHubData?.user);
  console.log('[Dashboard] Initial contextDeveloperProfile:', contextDeveloperProfile);
  console.log('[Dashboard] Initial userProfile from useAuth:', userProfile);
  console.log('[Dashboard] Location state for fresh setup:', freshSetupState);


  // Define renderJobSearch function before it's used in the return statement
  const renderJobSearch = () => {
    return (
      <div className="space-y-8">
        {/* Featured/Recommended Jobs Section */}
        {recommendedJobs.filter(job => job.is_featured).length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <Star className="w-5 h-5 text-yellow-500 fill-current mr-2" />
              Featured Job Opportunities
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              {recommendedJobs.filter(job => job.is_featured).slice(0, 4).map((job) => (
                <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm border border-blue-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-gray-900">{job.title}</h4>
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  </div>
                  <p className="text-sm text-blue-600 mb-2 flex items-center">
                    <Building className="w-3 h-3 mr-1" />
                    <button 
                      onClick={() => handleViewRecruiter(job.recruiter.id)}
                      className="hover:underline flex items-center"
                    >
                      {job.recruiter.company_name}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  </p>
                  <div className="flex items-center text-xs text-gray-500 mb-2">
                    <MapPin className="w-3 h-3 mr-1" />
                    {job.location}
                    <span className="mx-2">•</span>
                    {job.job_type}
                  </div>
                  <div className="flex items-center text-xs text-gray-500 mb-3">
                    <DollarSign className="w-3 h-3 mr-1" />
                    ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}
                  </div>
                  <button
                    onClick={() => handleViewJobDetails(job)}
                    className="w-full bg-blue-600 text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* All Jobs */}
        <JobSearchList 
          onViewJobDetails={(jobId) => {
            const job = recommendedJobs.find(j => j.id === jobId);
            if (job) {
              handleViewJobDetails(job);
            }
          }}
          onExpressInterest={handleExpressInterest}
          onViewRecruiter={handleViewRecruiter}
        />
      </div>
    );
  };

  useEffect(() => {
    // Check for tab parameter in URL
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    
    if (tabParam) {
      // Map URL parameter to tab state
      switch (tabParam) {
        case 'profile':
          setActiveTab('profile');
          break;
        case 'portfolio':
          setActiveTab('portfolio');
          break;
        case 'github-activity':
          setActiveTab('github-activity');
          break;
        case 'messages':
          setActiveTab('messages');
          break;
        case 'jobs':
          setActiveTab('jobs');
          break;
        default:
          setActiveTab('overview');
      }
    }
  }, [location.search]);

  // <-- UPDATED: Combined fetch calls and loading state management
  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) return;
      setLoading(true); // This is for the overall page data, not GitHub specific
      try {
        // fetchDeveloperData will set the 'developer' state
        await Promise.all([
          fetchDeveloperData(),
          fetchMessages(),
          fetchRecommendedJobs(),
          fetchFeaturedPortfolioItem(),
        ]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false); // Done loading general page data
      }
    };

    fetchAllData();
  }, [user]); // Keep user dependency for initial data load

  // New useEffect to manage showGitHubConnectPrompt based on local and context developer profiles
  useEffect(() => {
    console.log('[Dashboard-Effect] developer:', developer);
    console.log('[Dashboard-Effect] contextDeveloperProfile:', contextDeveloperProfile);
    const handle = developer?.github_handle; // Use local 'developer' state for this check
    const ctxHasId = !!contextDeveloperProfile?.github_installation_id;
    const localHasId = !!developer?.github_installation_id; // Check local 'developer' state's ID
    console.log('[Dashboard-Effect] Decision variables for prompt:', { handle, ctxHasId, localHasId });

    if (developer && developer.github_handle) {
      // Show prompt only if handle exists AND installation ID is missing from BOTH context and local fetch
      if (!ctxHasId && !localHasId) {
        setShowGitHubConnectPrompt(true);
        console.log('[Dashboard-Effect] Setting showGitHubConnectPrompt to true');
      } else {
        setShowGitHubConnectPrompt(false);
        console.log('[Dashboard-Effect] Setting showGitHubConnectPrompt to false');
      }
    } else if (developer && !developer.github_handle) {
      // No GitHub handle, so don't show the prompt to connect the app
      setShowGitHubConnectPrompt(false);
      console.log('[Dashboard-Effect] No github_handle, setting showGitHubConnectPrompt to false');
    } else {
      // If developer is null (still loading initially), do nothing, wait for data
      console.log('[Dashboard-Effect] Developer data is null, showGitHubConnectPrompt unchanged (current value):', showGitHubConnectPrompt);
    }
  }, [developer, contextDeveloperProfile]);


  // Update URL when tab changes
  useEffect(() => {
    if (activeTab !== 'overview') {
      navigate(`/developer?tab=${activeTab}`, { replace: true, state: location.state }); // Preserve location.state
    } else {
      navigate('/developer', { replace: true, state: location.state }); // Preserve location.state
    }
  }, [activeTab, navigate, location.state]);

  // Effect to clear navigation state after fresh setup data is loaded/used successfully
  useEffect(() => {
    // Only clear if it was a fresh setup, and the fresh load attempt is now successful
    if (freshSetupState?.isFreshGitHubSetup && freshLoadStatus === 'success') {
      console.log('[Dashboard] Fresh GitHub data loaded successfully via useFreshGitHubDataOnce, clearing navigation state.');
      navigate(location.pathname + location.search, { replace: true, state: null });
      // Also reset fresh load attempt markers
      setIsAttemptingFreshLoad(false);
      setDerivedHandle(null);
      setFreshLoadStatus('idle');
    }
  }, [freshSetupState, freshLoadStatus, navigate, location.pathname, location.search]);

  const fetchDeveloperData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(name, email)
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setDeveloper(data);
    } catch (error) {
      console.error('Error fetching developer data:', error);
    }
  };

  const fetchMessages = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(name),
          receiver:users!messages_receiver_id_fkey(name)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchFeaturedPortfolioItem = async () => {
    if (!user) return;
    try {
      const { data: featuredData, error: featuredError } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('developer_id', user.id)
        .eq('featured', true)
        .limit(1)
        .maybeSingle();
      if (featuredError) throw featuredError;
      if (featuredData) {
        setFeaturedPortfolioItem(featuredData);
        return;
      }
      const { data: recentData, error: recentError } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('developer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentError) throw recentError;
      setFeaturedPortfolioItem(recentData);
    } catch (error) {
      console.error('Error fetching featured portfolio item:', error);
    }
  };

  const fetchRecommendedJobs = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users!job_roles_recruiter_id_fkey(
            id,
            name,
            recruiters(company_name)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      const formattedJobs = data?.map(job => ({
        ...job,
        recruiter: {
          id: job.recruiter?.id || '',
          name: job.recruiter?.name || 'Unknown',
          company_name: job.recruiter?.recruiters?.[0]?.company_name || 'Unknown Company'
        }
      })) || [];
      setRecommendedJobs(formattedJobs);
    } catch (error) {
      console.error('Error fetching recommended jobs:', error);
    }
  };

  const handleViewJobDetails = (job: JobRole) => {
    setSelectedJobForDetails(job);
    setShowJobDetailsModal(true);
  };

  const handleViewRecruiter = (recruiterId: string) => {
    setSelectedRecruiterId(recruiterId);
    setShowRecruiterProfile(true);
  };

  const handleCloseJobDetails = () => {
    setShowJobDetailsModal(false);
    setSelectedJobForDetails(null);
  };

  const handleMessageRecruiter = async (recruiterId: string, jobTitle?: string) => {
    try {
      const subject = jobTitle ? `Interest in ${jobTitle}` : 'Developer Inquiry';
      const body = jobTitle 
        ? `Hi, I'm interested in the ${jobTitle} position. I'd love to discuss this opportunity further.`
        : `Hi, I'm interested in learning more about opportunities at your company.`;
      const { error } = await supabase
        .from('messages')
        .insert({ sender_id: user?.id, receiver_id: recruiterId, subject, body });
      if (error) throw error;
      fetchMessages();
      handleCloseJobDetails();
      setShowRecruiterProfile(false);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleExpressInterest = async (jobId: string) => {
    const job = recommendedJobs.find(j => j.id === jobId);
    if (!job) { console.error('Job not found:', jobId); return; }
    await sendInterestMessage(job.recruiter.id, job.title);
    if (showJobDetailsModal) { handleCloseJobDetails(); }
  };

  const sendInterestMessage = async (recruiterId: string, jobTitle: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: recruiterId,
          subject: `Interest in ${jobTitle}`,
          body: `Hi, I'm interested in the ${jobTitle} position. I'd love to discuss this opportunity further.`
        });
      if (error) throw error;
      fetchMessages();
    } catch (error) {
      console.error('Error sending interest message:', error);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {developer && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Strength</h3>
          <ProfileStrengthIndicator strength={developer.profile_strength} showDetails={true} />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-blue-100 rounded-lg"><Github className="w-6 h-6 text-blue-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">GitHub Activity</p><p className="text-2xl font-bold text-gray-900">{developer?.github_handle ? 'Active' : 'Not Connected'}</p></div></div></div>
        <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-cyan-100 rounded-lg"><SearchCheck className="w-6 h-6 text-cyan-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Search Appearances</p><p className="text-2xl font-bold text-gray-900">{developer?.search_appearance_count || 0}</p></div></div></div>
        <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-green-100 rounded-lg"><MessageSquare className="w-6 h-6 text-green-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Unread Messages</p><p className="text-2xl font-bold text-gray-900">{messages.filter(m => !m.is_read && m.receiver_id === user?.id).length}</p></div></div></div>
        <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-purple-100 rounded-lg"><Briefcase className="w-6 h-6 text-purple-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Job Interests</p><p className="text-2xl font-bold text-gray-900">{recommendedJobs.length > 0 ? recommendedJobs.length : '--'}</p></div></div></div>
        <div className="bg-white rounded-lg shadow-sm border p-6"><div className="flex items-center"><div className="p-2 bg-yellow-100 rounded-lg"><Eye className="w-6 h-6 text-yellow-600" /></div><div className="ml-4"><p className="text-sm font-medium text-gray-600">Profile Views</p><p className="text-2xl font-bold text-gray-900">{developer?.profile_view_count || 0}</p></div></div></div>
      </div>
      {featuredPortfolioItem && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Featured Project</h3>
            <button onClick={() => setActiveTab('portfolio')} className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All Projects</button>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            {featuredPortfolioItem.image_url && (<div className="mb-4"><img src={featuredPortfolioItem.image_url} alt={featuredPortfolioItem.title} className="w-full h-48 object-cover rounded-xl border border-gray-200" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; }} /></div>)}
            <div className="flex items-start justify-between mb-3"><div className="flex-1"><h4 className="text-lg font-semibold text-gray-900">{featuredPortfolioItem.title}</h4><p className="text-sm text-gray-700 mt-1">{featuredPortfolioItem.description}</p></div></div>
            <div className="flex space-x-4 text-xs text-gray-600">{featuredPortfolioItem.tech_stack?.map((tech: string, idx: number) => (<span key={idx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{tech}</span>))}</div>
          </div>
        </div>
      )}
    </div>
  );

  // Overall page loading state (for developer profile, messages, etc.)
  if (loading) {
    return (<div className="flex justify-center items-center h-96"><svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg></div>);
  }

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

      {activeTab === 'github-activity' && (
        developer?.github_handle ? (
          <div className="flex flex-wrap md:flex-nowrap gap-6">
            <div className="w-full md:w-2/5 flex-shrink-0">
              <div className="max-w-sm mx-auto md:mx-0">
                <RealGitHubChart githubHandle={developer.github_handle} className="w-full" displayMode='dashboardSnippet' />
              </div>
            </div>
            <div className="w-full md:w-3/5 flex-grow">
              {gitHubDataLoading && (
                <div className="flex justify-center items-center h-full bg-white p-6 rounded-lg shadow-sm border">
                  <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4a10 10 0 00-10 10h2zm8 10a10 10 0 0010-10h-2a8 8 0 01-8 8v2z"></path></svg>
                  <span className="ml-3 text-gray-500">
                    {isAttemptingFreshLoad && freshLoadStatus === 'waiting_for_handle'
                      ? "Verifying GitHub connection..."
                      : "Loading GitHub Details..."}
                  </span>
                </div>
              )}
              {!gitHubDataLoading && gitHubDataError && (
                <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
                  <h3 className="text-lg font-semibold text-red-600">Error Loading GitHub Details</h3>
                  <p className="text-gray-500 mt-2">{gitHubDataError.message}</p>
                </div>
              )}
              {!gitHubDataLoading && !gitHubDataError && gitHubData?.user && (
                <GitHubUserActivityDetails gitHubData={gitHubData} />
              )}
              {!gitHubDataLoading && !gitHubDataError && !gitHubData?.user && (
                <div className="bg-white p-6 rounded-lg shadow-sm border h-full"><p className="text-gray-500">No GitHub data available to display details. Ensure your GitHub handle is correctly set in your profile and the GitHub App is connected.</p></div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-white rounded-lg shadow-sm border">
             <Github className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">GitHub Activity Not Available</h3>
            <p className="text-gray-500 mb-6">Please complete your profile and connect the GitTalent GitHub App to see your activity.</p>
            <button
              onClick={() => setActiveTab('profile')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              Go to Profile
            </button>
          </div>
        )
      )}

      {activeTab === 'messages' && (<div className="flex space-x-6"><MessageList messages={messages} onSelectThread={setSelectedThread} selectedThreadId={selectedThread} />{selectedThread && (<MessageThread threadId={selectedThread} />)}</div>)}
      {activeTab === 'jobs' && (<>{renderJobSearch()}{showJobDetailsModal && selectedJobForDetails && (<JobRoleDetails job={selectedJobForDetails} onClose={handleCloseJobDetails} onExpressInterest={handleExpressInterest} onViewRecruiter={handleViewRecruiter} onMessageRecruiter={handleMessageRecruiter} />)}{showRecruiterProfile && selectedRecruiterId && (<RecruiterProfileDetails recruiterId={selectedRecruiterId} onClose={() => setShowRecruiterProfile(false)} onMessageRecruiter={handleMessageRecruiter} />)}</>)}
    </div>
  );
};
