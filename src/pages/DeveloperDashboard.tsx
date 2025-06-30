import React, { useState, useEffect } from 'react';
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
  RealGitHubChart
} from '../components';
import { 
  DeveloperProfileForm,
  PortfolioManager,
  MessageList,
  MessageThread,
  JobSearchList,
  JobRoleDetails,
  ProfileStrengthIndicator,
  RealGitHubChart
} from '../components';
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
  Send
} from 'lucide-react';

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

interface Assignment {
  id: string;
  job_role_id: string;
  recruiter_id: string;
  status: string;
  assigned_at: string;
  notes: string;
  job_role: {
    title: string;
    description: string;
    location: string;
    job_type: string;
    tech_stack: string[];
    salary_min: number;
    salary_max: number;
    recruiter: {
      user: {
        name: string;
      };
      company_name: string;
    };
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
    user: {
      name: string;
    };
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
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'portfolio' | 'messages' | 'jobs' | 'github'>('overview');
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<JobRole | null>(null);
  const [showJobSearch, setShowJobSearch] = useState(false);
  const [recommendedJobs, setRecommendedJobs] = useState<JobRole[]>([]);

  useEffect(() => {
    if (user) {
      fetchDeveloperData();
      fetchMessages();
      fetchRecommendedJobs();
    }
  }, [user]);

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
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendedJobs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:recruiters(
            company_name,
            user:users(name)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setRecommendedJobs(data || []);
    } catch (error) {
      console.error('Error fetching recommended jobs:', error);
    }
  };

  const handleViewJobDetails = (job: JobRole) => {
    setSelectedJobForDetails(job);
    setShowJobDetailsModal(true);
  };

  const handleCloseJobDetails = () => {
    setShowJobDetailsModal(false);
    setSelectedJobForDetails(null);
  };

  const handleMessageRecruiter = async (recruiterId: string, jobTitle: string) => {
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
      
      // Refresh messages
      fetchMessages();
      handleCloseJobDetails();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleExpressInterest = async (jobId: string, recruiterId: string, jobTitle: string) => {
    await sendInterestMessage(recruiterId, jobTitle);
    handleCloseJobDetails();
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
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Profile Views</p>
              <p className="text-2xl font-bold text-gray-900">--</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Job Interests</p>
              <p className="text-2xl font-bold text-gray-900">
                {recommendedJobs.length > 0 ? recommendedJobs.length : '--'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
              )}
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
    </div>
  );

  const renderMessages = () => {
    if (selectedThread) {
      return (
        <MessageThread
          threadId={selectedThread}
          onBack={() => setSelectedThread(null)}
        />
      );
    }

    return <MessageList onSelectThread={setSelectedThread} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Developer Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back, {developer?.user?.name || user?.email}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: TrendingUp },
              { id: 'profile', name: 'Profile', icon: User },
              { id: 'github', name: 'GitHub Activity', icon: Github },
              { id: 'github', name: 'GitHub Activity', icon: Github },
              { id: 'messages', name: 'Messages', icon: MessageSquare },
              { id: 'jobs', name: 'Job Search', icon: Search },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`mr-2 h-5 w-5 ${
                    activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {tab.name}
                  {tab.id === 'messages' && messages.filter(m => !m.is_read && m.receiver_id === user?.id).length > 0 && (
                    <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {messages.filter(m => !m.is_read && m.receiver_id === user?.id).length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'profile' && <DeveloperProfileForm />}
          {activeTab === 'github' && developer?.github_handle && (
            <RealGitHubChart githubHandle={developer.github_handle} className="w-full" />
          )}
          {activeTab === 'portfolio' && developer && (
            <PortfolioManager developerId={developer.user_id} isEditable={true} />
          )}
          )}
          {activeTab === 'portfolio' && developer && (
            <PortfolioManager developerId={developer.user_id} isEditable={true} />
          )}
          {activeTab === 'messages' && renderMessages()}
          {activeTab === 'jobs' && (
            <JobSearchList onViewDetails={handleViewJobDetails} />
          )}
        </div>

        {/* Job Details Modal */}
        {showJobDetailsModal && selectedJobForDetails && (
          <JobRoleDetails
            jobRole={selectedJobForDetails}
            onClose={handleCloseJobDetails}
            onExpressInterest={handleExpressInterest}
            onMessageRecruiter={handleMessageRecruiter}
          />
        )}

        {/* Job Search Modal */}
        {showJobSearch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Browse Jobs</h2>
                  <button
                    onClick={() => setShowJobSearch(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <JobSearchList onViewDetails={handleViewJobDetails} />
              </div>
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
    </div>
  );
};