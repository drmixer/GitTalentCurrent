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
  RealGitHubChart,
  RecruiterProfileDetails
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
  Send,
  ExternalLink,
  Building
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
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'portfolio' | 'github' | 'messages' | 'jobs'>('overview');
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
          onViewDetails={(jobId) => {
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
    if (user) {
      fetchDeveloperData();
      fetchMessages();
      fetchRecommendedJobs();
      fetchFeaturedPortfolioItem();
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
    console.log('Viewing job details:', job);
    setSelectedJobForDetails(job);
    setShowJobDetailsModal(true);
  };

  const handleViewRecruiter = (recruiterId: string) => {
    console.log('Viewing recruiter profile:', recruiterId);
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
    console.log('Handling express interest for job:', jobId);
    if (!selectedJobForDetails) return;
    
    await sendInterestMessage(
      selectedJobForDetails.recruiter_id, 
      selectedJobForDetails.title
    );
    handleCloseJobDetails();
  };

  const sendInterestMessage = async (recruiterId: string, jobTitle: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
       console.error('Job not found:', jobId);
          sender_id: user?.id,
          receiver_id: recruiterId,
          subject: `Interest in ${jobTitle}`,
          body: `Hi, I'm interested in the ${jobTitle} position. I'd love to discuss this opportunity further.`
        });

      if (error) throw error;
      fetchMessages();
    } catch (error) {
      console.error('Error sending interest message:', error);
              console.log('View details callback received for job:', jobId);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Profile Strength */}
              console.log('Express interest callback received for job:', jobId);
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

      {/* GitHub Activity */}
      {developer?.github_handle && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">GitHub Activity</h3>
            <button
              onClick={() => setActiveTab('github')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View Full Activity
            </button>
          </div>
          <RealGitHubChart githubHandle={developer.github_handle} className="w-full" />
        </div>
      )}

      {/* Recommended Jobs */}
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
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="text-xl font-bold text-gray-900">{featuredPortfolioItem.title}</h4>
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800`}>
                    <Briefcase className="w-3 h-3 mr-1" />
                    <span className="capitalize">{featuredPortfolioItem.category}</span>
                  </span>
                </div>
              </div>
            </div>

            {featuredPortfolioItem.description && (
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                {featuredPortfolioItem.description}
              </p>
            )}

            {featuredPortfolioItem.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {featuredPortfolioItem.technologies.map((tech, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {featuredPortfolioItem.url && (
              <a
                href={featuredPortfolioItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold"
              >
                View Project
                <ExternalLink className="w-4 h-4 ml-1" />
              </a>
            )}
          </div>
        </div>
      )}
      
     console.log('Found job:', job.title, 'Recruiter ID:', job.recruiter.id);
      {/* Quick Job Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Job Opportunities</h3>
          <button
            onClick={() => setActiveTab('jobs')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Browse All Jobs
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="text-2xl font-black text-gray-900 mb-1">{recommendedJobs.length}</div>
            <div className="text-sm font-semibold text-gray-600">Matching Jobs</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="text-2xl font-black text-gray-900 mb-1">
              {recommendedJobs.filter(job => job.is_featured).length}
            </div>
            <div className="text-sm font-semibold text-gray-600">Featured Jobs</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
            <div className="text-2xl font-black text-gray-900 mb-1">
              {recommendedJobs.filter(job => job.job_type === 'Remote' || job.location.toLowerCase().includes('remote')).length}
            </div>
            <div className="text-sm font-semibold text-gray-600">Remote Jobs</div>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            onClick={() => setActiveTab('jobs')}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            Find Your Dream Job
          </button>
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
     console.log('Interest message sent successfully');
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
              { id: 'portfolio', name: 'Portfolio', icon: Briefcase },
              { id: 'github', name: 'GitHub Activity', icon: Github },
              { id: 'messages', name: 'Messages', icon: MessageSquare },
              { id: 'jobs', name: 'Job Search', icon: Search },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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
          {activeTab === 'portfolio' && developer && (
            <PortfolioManager developerId={developer.user_id} isEditable={true} />
          )}
          {activeTab === 'github' && developer?.github_handle && (
            <RealGitHubChart githubHandle={developer.github_handle} className="w-full" />
          )}
          {activeTab === 'messages' && renderMessages()}
          {activeTab === 'jobs' && renderJobSearch()}
        </div>

        {/* Job Details Modal */}
        {showJobDetailsModal && selectedJobForDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <JobRoleDetails
                jobRole={selectedJobForDetails}
                jobRoleId={selectedJobForDetails.id}
                onClose={handleCloseJobDetails}
                onSendMessage={(developerId, developerName, jobRoleId, jobRoleTitle) => {
                  handleMessageRecruiter(selectedJobForDetails.recruiter_id, selectedJobForDetails.title);
                }}
                onExpressInterest={() => handleExpressInterest(selectedJobForDetails.id)}
                isDeveloperView={true}
              />
            </div>
          </div>
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
                <JobSearchList 
                  onViewDetails={(jobId) => {
                    const job = recommendedJobs.find(j => j.id === jobId);
                    if (job) {
                      handleViewJobDetails(job);
                    }
                  }}
                  onViewRecruiter={handleViewRecruiter}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Recruiter Profile Modal */}
        {showRecruiterProfile && selectedRecruiterId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <RecruiterProfileDetails
                recruiterId={selectedRecruiterId}
                onClose={() => setShowRecruiterProfile(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};