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
import { useGitHub } from '../hooks/useGitHub'; // Import useGitHub hook
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
  Building
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

export const DeveloperDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'portfolio' | 'github-activity' | 'messages' | 'jobs'>('overview');
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showJobSearch, setShowJobSearch] = useState(false);
  const [showRecruiterProfile, setShowRecruiterProfile] = useState(false);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);
  const [recommendedJobs, setRecommendedJobs] = useState<JobRole[]>([]);
  const [featuredPortfolioItem, setFeaturedPortfolioItem] = useState<any | null>(null);
  const [showGitHubConnectPrompt, setShowGitHubConnectPrompt] = useState(false);

  // GitHub data for the right column
  const { gitHubData, loading: gitHubDataLoading, error: gitHubDataError } = useGitHub();


  const navigate = useNavigate();
  const location = useLocation();

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
      setLoading(true);
      try {
        await Promise.all([
          fetchDeveloperData(),
          fetchMessages(),
          fetchRecommendedJobs(),
          fetchFeaturedPortfolioItem(),
        ]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

  // Update URL when tab changes
  useEffect(() => {
    if (activeTab !== 'overview') {
      navigate(`/developer?tab=${activeTab}`, { replace: true });
    } else {
      navigate('/developer', { replace: true });
    }
  }, [activeTab, navigate]);

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
      
      // Check if GitHub App is not connected but GitHub handle exists
      if (data && data.github_handle && !data.github_installation_id) {
        setShowGitHubConnectPrompt(true);
      } 
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
    // <-- REMOVED setLoading(false) from here, now controlled centrally in useEffect
  };

  const fetchFeaturedPortfolioItem = async () => {
    if (!user) return;

    try {
      // First try to get a featured portfolio item
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
      
      // If no featured item, get the most recent one
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
      // Fetch job roles with proper join syntax
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
      
      // Transform the data to match the expected format
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
        .insert({
          sender_id: user?.id,
          receiver_id: recruiterId,
          subject,
          body
        });

      if (error) throw error;
      
      // Refresh messages
      fetchMessages();
      handleCloseJobDetails();
      setShowRecruiterProfile(false);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleExpressInterest = async (jobId: string) => {
    const job = recommendedJobs.find(j => j.id === jobId);
    if (!job) {
      console.error('Job not found:', jobId);
      return;
    }

    await sendInterestMessage(
      job.recruiter.id, 
      job.title
    );
    
    // Only close the modal if we're in the modal view
    if (showJobDetailsModal) {
      handleCloseJobDetails();
    }
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
      {/* Profile Strength */}
      {developer && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Strength</h3>
          <ProfileStrengthIndicator 
            strength={developer.profile_strength} 
            showDetails={true}
          />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Github className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">GitHub Activity</p>
              <p className="text-2xl font-bold text-gray-900">
                {developer?.github_handle ? 'Active' : 'Not Connected'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unread Messages</p>
              <p className="text-2xl font-bold text-gray-900">
                {messages.filter(m => !m.is_read && m.receiver_id === user?.id).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Job Interests</p>
              <p className="text-2xl font-bold text-gray-900">
                {recommendedJobs.length > 0 ? recommendedJobs.length : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Portfolio Item */}
      {featuredPortfolioItem && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Featured Project</h3>
            <button
              onClick={() => setActiveTab('portfolio')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All Projects
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            {featuredPortfolioItem.image_url && (
              <div className="mb-4">
                <img
                  src={featuredPortfolioItem.image_url}
                  alt={featuredPortfolioItem.title}
                  className="w-full h-48 object-cover rounded-xl border border-gray-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
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
                <span
                  key={idx}
                  className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <svg
          className="animate-spin h-12 w-12 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          ></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* GitHub Connect Prompt */}
      {showGitHubConnectPrompt && (
        <GitHubConnectPrompt
          githubHandle={developer?.github_handle || ''}
          onClose={() => setShowGitHubConnectPrompt(false)}
        />
      )}

      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      {activeTab === 'overview' && renderOverview()}

      {activeTab === 'profile' && developer && (
        <DeveloperProfileForm developer={developer} onUpdate={fetchDeveloperData} />
      )}

      {activeTab === 'portfolio' && (
        <PortfolioManager developerId={user?.id || ''} />
      )}

      {activeTab === 'github-activity' && developer?.github_handle && (
        <div className="flex flex-wrap md:flex-nowrap gap-6">
          {/* Left Column: GitHub Chart Snippet */}
          <div className="w-full md:w-2/5 flex-shrink-0">
            <div className="max-w-sm mx-auto md:mx-0"> {/* Keep max-w-sm for the chart itself, remove mx-auto for md+ */}
              <RealGitHubChart
                githubHandle={developer.github_handle}
                className="w-full"
                displayMode='dashboardSnippet'
              />
            </div>
          </div>
          {/* Right Column: GitHub Details */}
          <div className="w-full md:w-3/5 flex-grow">
            {gitHubDataLoading && (
              <div className="flex justify-center items-center h-full bg-white p-6 rounded-lg shadow-sm border">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4a10 10 0 00-10 10h2zm8 10a10 10 0 0010-10h-2a8 8 0 01-8 8v2z"></path>
                </svg>
                <span className="ml-3 text-gray-500">Loading GitHub Details...</span>
              </div>
            )}
            {!gitHubDataLoading && gitHubDataError && (
              <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
                <h3 className="text-lg font-semibold text-red-600">Error Loading GitHub Details</h3>
                <p className="text-gray-500 mt-2">{gitHubDataError.message}</p>
              </div>
            )}
            {!gitHubDataLoading && !gitHubDataError && gitHubData && (
              <GitHubUserActivityDetails gitHubData={gitHubData} />
            )}
             {!gitHubDataLoading && !gitHubDataError && !gitHubData && (
              <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
                <p className="text-gray-500">No GitHub data available to display details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="flex space-x-6">
          <MessageList
            messages={messages}
            onSelectThread={setSelectedThread}
            selectedThreadId={selectedThread}
          />
          {selectedThread && (
            <MessageThread threadId={selectedThread} />
          )}
        </div>
      )}

      {activeTab === 'jobs' && (
        <>
          {renderJobSearch()}
          
          {showJobDetailsModal && selectedJobForDetails && (
            <JobRoleDetails
              job={selectedJobForDetails}
              onClose={handleCloseJobDetails}
              onExpressInterest={handleExpressInterest}
              onViewRecruiter={handleViewRecruiter}
              onMessageRecruiter={handleMessageRecruiter}
            />
          )}

          {showRecruiterProfile && selectedRecruiterId && (
            <RecruiterProfileDetails
              recruiterId={selectedRecruiterId}
              onClose={() => setShowRecruiterProfile(false)}
              onMessageRecruiter={handleMessageRecruiter}
            />
          )}
        </>
      )}
    </div>
  );
};
