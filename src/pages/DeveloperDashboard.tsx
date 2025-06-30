import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GitHubChart } from '../components/GitHub/GitHubChart';
import { RealGitHubChart } from '../components/GitHub/RealGitHubChart';
import { PortfolioManager } from '../components/Portfolio/PortfolioManager';
import { ProfileStrengthIndicator } from '../components/Profile/ProfileStrengthIndicator';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { DeveloperProfileForm } from '../components/Profile/DeveloperProfileForm';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { JobSearchList } from '../components/JobRoles/JobSearchList';
import { useGitHub } from '../hooks/useGitHub';
import { 
  User, 
  Code, 
  Github, 
  Briefcase, 
  MessageSquare, 
  TrendingUp, 
  Eye, 
  Star, 
  Award,
  ArrowUpRight,
  Loader,
  Edit,
  Plus,
  RefreshCw,
  X,
  GitBranch,
  FileText,
  ArrowLeft,
  ExternalLink,
  Search
} from 'lucide-react';
import { Assignment, JobRole } from '../types';

interface MessageThread {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  unreadCount: number;
  jobContext?: {
    id: string;
    title: string;
  };
}

export const DeveloperDashboard = () => {
  const { userProfile, developerProfile, loading: authLoading } = useAuth();
  const { 
    user: githubUser, 
    repos: githubRepos, 
    totalStars, 
    loading: githubLoading, 
    error: githubError, 
    refreshGitHubData,
    getTopLanguages,
    getTopRepos,
    syncLanguagesToProfile,
    syncProjectsToProfile
  } = useGitHub();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [showEditProfileForm, setShowEditProfileForm] = useState(false);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<string | null>(null);
  const [showJobSearch, setShowJobSearch] = useState(false);

  // Stats data
  const [stats, setStats] = useState({
    profileViews: 0,
    assignmentCount: 0,
    messageCount: 0,
    profileStrength: developerProfile?.profile_strength || 0
  });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [recommendedJobs, setRecommendedJobs] = useState<JobRole[]>([]);

  useEffect(() => {
    if (userProfile?.role === 'developer' && developerProfile) {
      fetchDashboardData();
      fetchRecommendedJobs();
    }
  }, [userProfile, developerProfile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      if (!userProfile?.id) return;

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          job_role:job_roles(*),
          recruiter:users!assignments_recruiter_id_fkey(*)
        `)
        .eq('developer_id', userProfile.id)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // For each assignment, check if there are any messages from the recruiter
      const enhancedAssignments = await Promise.all((assignmentsData || []).map(async (assignment) => {
        // Check if there are any messages from the recruiter to the developer for this job
        const { count, error: messagesError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', assignment.recruiter_id)
          .eq('receiver_id', userProfile.id)
          .eq('job_role_id', assignment.job_role_id);
        
        if (messagesError) {
          console.error('Error checking recruiter messages:', messagesError);
          return { ...assignment, has_recruiter_contact: false };
        }

        return { 
          ...assignment, 
          has_recruiter_contact: count ? count > 0 : false 
        };
      }));

      setAssignments(enhancedAssignments);

      // Fetch unread messages count
      const { count: unreadCount, error: messagesError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userProfile.id)
        .eq('is_read', false);

      if (messagesError) throw messagesError;

      // Set stats
      setStats({
        profileViews: Math.floor(Math.random() * 20) + 5, // Simulated data
        assignmentCount: enhancedAssignments?.length || 0,
        messageCount: unreadCount || 0,
        profileStrength: developerProfile?.profile_strength || 0
      });

      setUnreadMessages(unreadCount || 0);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendedJobs = async () => {
    try {
      if (!developerProfile?.top_languages?.length) return;

      // Get jobs that match the developer's top languages
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_roles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (jobsError) throw jobsError;

      // Simple recommendation algorithm - match jobs with developer's languages
      // In a real app, this would be more sophisticated, possibly using an AI service
      const jobs = jobsData || [];
      const scoredJobs = jobs.map(job => {
        let score = 0;
        // Score based on matching tech stack
        developerProfile.top_languages.forEach(lang => {
          if (job.tech_stack.includes(lang)) {
            score += 10;
          }
        });
        
        // Score based on salary match
        if (developerProfile.desired_salary > 0) {
          if (job.salary_min <= developerProfile.desired_salary && 
              job.salary_max >= developerProfile.desired_salary) {
            score += 5;
          }
        }
        
        return { ...job, score };
      });

      // Sort by score and take top 3
      const recommended = scoredJobs
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      setRecommendedJobs(recommended);
    } catch (error: any) {
      console.error('Error fetching recommended jobs:', error);
    }
  };

  const handleProfileUpdateSuccess = () => {
    setShowEditProfileForm(false);
    fetchDashboardData();
    
    // If GitHub handle was updated, refresh GitHub data
    if (developerProfile?.github_handle) {
      refreshGitHubData();
    }
  };

  const handleViewJobDetails = (jobRoleId: string) => {
    setSelectedJobForDetails(jobRoleId);
    setShowJobDetailsModal(true);
    setShowJobSearch(false);
  };

  const handleCloseJobDetails = () => {
    setShowJobDetailsModal(false);
    setSelectedJobForDetails(null);
  };

  const handleMessageRecruiter = (assignment: Assignment) => {
    if (!assignment.recruiter || !assignment.job_role) return;
    
    setSelectedThread({
      otherUserId: assignment.recruiter_id,
      otherUserName: assignment.recruiter.name,
      otherUserRole: 'recruiter',
      unreadCount: 0,
      jobContext: {
        id: assignment.job_role_id,
        title: assignment.job_role.title
      }
    });
    
    setActiveTab('messages');
  };

  const handleExpressInterest = (jobRoleId: string) => {
    // In a real implementation, this would record the developer's interest
    // For now, we'll just show the job details
    handleViewJobDetails(jobRoleId);
  };

  // Generate dynamic profile strength suggestions based on profile data
  const generateProfileSuggestions = (): string[] => {
    const suggestions: string[] = [];
    
    if (!developerProfile) return suggestions;
    
    // Check GitHub handle
    if (!developerProfile.github_handle) {
      suggestions.push('Add your GitHub handle to showcase your coding activity');
    }
    
    // Check bio
    if (!developerProfile.bio || developerProfile.bio.length < 50) {
      suggestions.push('Complete your bio with at least 50 characters to better introduce yourself');
    }
    
    // Check location
    if (!developerProfile.location) {
      suggestions.push('Add your location to receive location-specific opportunities');
    }
    
    // Check experience years
    if (developerProfile.experience_years === 0) {
      suggestions.push('Specify your years of experience to help match you with appropriate roles');
    }
    
    // Check desired salary
    if (developerProfile.desired_salary === 0) {
      suggestions.push('Set your desired salary to help match you with appropriate compensation');
    }
    
    // Check top languages
    if (!developerProfile.top_languages || developerProfile.top_languages.length < 3) {
      suggestions.push('Add at least 3 programming languages to showcase your technical skills');
    }
    
    // Check linked projects
    if (!developerProfile.linked_projects || developerProfile.linked_projects.length < 2) {
      suggestions.push('Link at least 2 projects to demonstrate your work');
    }
    
    // Check resume URL
    if (!developerProfile.resume_url) {
      suggestions.push('Add a link to your resume for recruiters to review');
    }
    
    // Check portfolio items
    // This would require a separate query, so we'll just add a generic suggestion
    suggestions.push('Add portfolio items to showcase your best work');
    
    return suggestions;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Fetching your developer profile...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!userProfile) {
    console.log('❌ No user profile, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect if not a developer
  if (userProfile.role !== 'developer') {
    console.log('❌ Not a developer role, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect if no developer profile
  if (!developerProfile) {
    console.log('❌ No developer profile, redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  // Format display name as FirstName (github_handle)
  const displayName = developerProfile.github_handle 
    ? `${userProfile.name.split(' ')[0]} (${developerProfile.github_handle})`
    : userProfile.name;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  const renderOverview = () => (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Profile Strength */}
      <ProfileStrengthIndicator
        strength={stats.profileStrength}
        suggestions={generateProfileSuggestions()}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.profileViews}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Profile Views</div>
          <div className="text-xs text-emerald-600 font-medium">+12% this week</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.assignmentCount}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Job Assignments</div>
          <div className="text-xs text-emerald-600 font-medium">New opportunities</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.messageCount}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Unread Messages</div>
          <div className="text-xs text-emerald-600 font-medium">From recruiters</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{developerProfile.top_languages.length}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Skills Showcased</div>
          <div className="text-xs text-emerald-600 font-medium">Highlight your expertise</div>
        </div>
      </div>

      {/* AI-Matched Job Recommendations */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">AI-Matched Job Recommendations</h3>
          <button
            onClick={() => setActiveTab('jobs')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            View All Jobs
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        
        {recommendedJobs.length > 0 ? (
          <div className="space-y-4">
            {recommendedJobs.map(job => (
              <div key={job.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">{job.title}</h4>
                    <div className="flex items-center space-x-3 text-sm text-gray-600 mb-2">
                      <span>{job.location}</span>
                      <span>{job.job_type}</span>
                      <span>${job.salary_min}k - ${job.salary_max}k</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {job.tech_stack.slice(0, 4).map((tech, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {tech}
                        </span>
                      ))}
                      {job.tech_stack.length > 4 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                          +{job.tech_stack.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewJobDetails(job.id)}
                    className="px-3 py-1 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No job recommendations yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Complete your profile to get personalized job recommendations
            </p>
            <button
              onClick={() => setActiveTab('jobs')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Browse All Jobs
            </button>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Recent Assignments</h3>
          <div className="space-y-4">
            {assignments.slice(0, 3).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  {assignment.has_recruiter_contact ? (
                    <>
                      <button 
                        onClick={() => handleViewJobDetails(assignment.job_role_id)}
                        className="font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center"
                      >
                        {assignment.job_role?.title || 'Unknown Job'}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </button>
                      <button
                        onClick={() => handleViewJobDetails(assignment.job_role_id)}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {assignment.recruiter?.name || 'Unknown Recruiter'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-gray-900">New Job Opportunity</div>
                      <div className="text-sm text-gray-600">Details available after recruiter contact</div>
                    </>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                    assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                    assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {assignment.status}
                  </span>
                  
                  {assignment.has_recruiter_contact && (
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => handleViewJobDetails(assignment.job_role_id)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Job Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleMessageRecruiter(assignment)}
                        className="p-1 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Message Recruiter"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {assignments.length === 0 && (
              <p className="text-gray-500 text-center py-4">No assignments yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Profile Completion Tips</h3>
          <div className="space-y-4">
            {developerProfile.github_handle ? (
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                <div className="flex items-center">
                  <Github className="w-5 h-5 text-emerald-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">GitHub Connected</div>
                    <div className="text-sm text-gray-600">Your GitHub profile is linked</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Completed
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center">
                  <Github className="w-5 h-5 text-yellow-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">Connect GitHub</div>
                    <div className="text-sm text-gray-600">Link your GitHub profile to show your work</div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditProfileForm(true)}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white">
                  Connect
                </button>
              </div>
            )}
            
            {developerProfile.top_languages.length > 0 ? (
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                <div className="flex items-center">
                  <Code className="w-5 h-5 text-emerald-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">Skills Added</div>
                    <div className="text-sm text-gray-600">{developerProfile.top_languages.length} languages added</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Completed
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center">
                  <Code className="w-5 h-5 text-yellow-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">Add Your Skills</div>
                    <div className="text-sm text-gray-600">Add programming languages and technologies</div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditProfileForm(true)}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white">
                  Add Skills
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center">
                <Briefcase className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <div className="font-semibold text-gray-900">Add Portfolio Items</div>
                  <div className="text-sm text-gray-600">Showcase your best work to recruiters</div>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('portfolio')}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white"
              >
                Add Now
              </button>
            </div>
            
            {!developerProfile.resume_url && (
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-yellow-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">Add Your Resume</div>
                    <div className="text-sm text-gray-600">Link to your resume for recruiters to review</div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditProfileForm(true)}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white">
                  Add Resume
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderJobs = () => {
    if (showJobSearch) {
      return (
        <div className="space-y-6">
          <div className="flex items-center">
            <button
              onClick={() => setShowJobSearch(false)}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <h2 className="text-2xl font-black text-gray-900">Browse All Jobs</h2>
          </div>
          
          <JobSearchList 
            onViewJobDetails={handleViewJobDetails}
            onExpressInterest={handleExpressInterest}
          />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900">Job Opportunities</h2>
          <button
            onClick={() => setShowJobSearch(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center"
          >
            <Search className="w-4 h-4 mr-2" />
            Browse All Jobs
          </button>
        </div>

        {/* AI-Matched Job Recommendations */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center mb-6">
            <Star className="w-6 h-6 text-yellow-500 mr-3" />
            <h3 className="text-lg font-black text-gray-900">AI-Matched Job Recommendations</h3>
          </div>
          
          {recommendedJobs.length > 0 ? (
            <div className="space-y-6">
              {recommendedJobs.map(job => (
                <div key={job.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {job.location}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {job.job_type}
                        </div>
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          ${job.salary_min}k - ${job.salary_max}k
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {job.tech_stack.map((tech, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {tech}
                          </span>
                        ))}
                      </div>
                      <p className="text-gray-600 line-clamp-2 mb-4">{job.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleViewJobDetails(job.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleExpressInterest(job.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                    >
                      Express Interest
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No job recommendations yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Complete your profile to get personalized job recommendations
              </p>
              <button
                onClick={() => setShowJobSearch(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Browse All Jobs
              </button>
            </div>
          )}
        </div>

        {/* Recent Assignments */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Your Job Assignments</h3>
          
          {assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <button 
                          onClick={() => handleViewJobDetails(assignment.job_role_id)}
                          className="font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center"
                        >
                          {assignment.job_role?.title || 'Unknown Job'}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </button>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                          assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                          assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {assignment.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3 text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <Building className="w-4 h-4 mr-1" />
                          {assignment.recruiter?.name || 'Unknown Recruiter'}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      {assignment.has_recruiter_contact && (
                        <p className="text-sm text-gray-600 mb-3">
                          {assignment.status === 'New' && 'The recruiter has assigned you to this job.'}
                          {assignment.status === 'Contacted' && 'The recruiter has reviewed your profile and is interested.'}
                          {assignment.status === 'Shortlisted' && 'Congratulations! You have been shortlisted for this position.'}
                          {assignment.status === 'Hired' && 'Congratulations! You have been hired for this position.'}
                        </p>
                      )}
                    </div>
                    
                    {assignment.has_recruiter_contact && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleMessageRecruiter(assignment)}
                          className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                        >
                          <MessageSquare className="w-3 h-3 mr-1 inline" />
                          Message
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No job assignments yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Recruiters will assign you to jobs that match your skills
              </p>
              <button
                onClick={() => setShowJobSearch(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Browse Available Jobs
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPortfolio = () => (
    <PortfolioManager 
      developerId={userProfile.id} 
      isEditable={true}
    />
  );

  const renderGitHub = () => (
    <div className="space-y-6">
      {developerProfile.github_handle ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-gray-900">GitHub Activity</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={syncLanguagesToProfile}
                className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm"
              >
                <Code className="w-4 h-4 mr-1 inline" />
                Sync Languages
              </button>
              <button
                onClick={syncProjectsToProfile}
                className="px-4 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors font-medium text-sm"
              >
                <GitBranch className="w-4 h-4 mr-1 inline" />
                Sync Projects
              </button>
              <button
                onClick={refreshGitHubData}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-1 inline" />
                Refresh
              </button>
            </div>
          </div>
          
          <RealGitHubChart 
            githubHandle={developerProfile.github_handle} 
            className="w-full"
          />
          
          {/* Top Repositories */}
          {!githubLoading && githubRepos.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-4">Top Repositories</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getTopRepos(6).map(repo => (
                  <div key={repo.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-start justify-between mb-2">
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-semibold flex items-center"
                      >
                        {repo.name}
                        <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                      </a>
                      <div className="flex items-center text-xs text-gray-500">
                        <Star className="w-3 h-3 mr-1" />
                        {repo.stargazers_count}
                      </div>
                    </div>
                    {repo.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{repo.description}</p>
                    )}
                    {repo.language && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {repo.language}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Github className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">GitHub Not Connected</h3>
          <p className="text-gray-600 mb-6">
            Connect your GitHub account to showcase your contributions and projects to potential employers.
          </p>
          <button 
            onClick={() => setShowEditProfileForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold">
            <Github className="w-4 h-4 mr-2 inline" />
            Connect GitHub
          </button>
        </div>
      )}
    </div>
  );

  const renderMessages = () => {
    if (selectedThread) {
      return (
        <MessageThread
          otherUserId={selectedThread.otherUserId}
          otherUserName={selectedThread.otherUserName}
          otherUserRole={selectedThread.otherUserRole}
          otherUserProfilePicUrl={selectedThread.otherUserProfilePicUrl}
          jobContext={selectedThread.jobContext}
          onBack={() => setSelectedThread(null)}
        />
      );
    }

    return (
      <MessageList
        onThreadSelect={setSelectedThread}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Welcome, {displayName}!
              </h1>
              <p className="text-gray-600">Manage your developer profile and connect with recruiters</p>
            </div>
            <div className="flex items-center space-x-3">
              {developerProfile.profile_pic_url ? (
                <img 
                  src={developerProfile.profile_pic_url} 
                  alt={userProfile.name}
                  className="w-12 h-12 rounded-xl object-cover shadow-lg"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = "w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg";
                      fallback.textContent = userProfile.name.split(' ').map(n => n[0]).join('');
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                  <Code className="w-6 h-6" />
                </div>
              )}
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setShowEditProfileForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </button>
            <button 
              onClick={() => setActiveTab('portfolio')}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Portfolio Item
            </button>
            <button 
              onClick={fetchDashboardData}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-2" />
                  {tab.label}
                  {tab.id === 'messages' && unreadMessages > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {unreadMessages}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'portfolio' && renderPortfolio()}
        {activeTab === 'github' && renderGitHub()}
        {activeTab === 'messages' && renderMessages()}

        {/* Edit Profile Modal */}
        {showEditProfileForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-2xl font-black text-gray-900">Edit Your Profile</h2>
                <button
                  onClick={() => setShowEditProfileForm(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <DeveloperProfileForm
                  initialData={developerProfile}
                  onSuccess={handleProfileUpdateSuccess}
                  onCancel={() => setShowEditProfileForm(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Job Details Modal */}
        {showJobDetailsModal && selectedJobForDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={handleCloseJobDetails}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Dashboard
                </button>
              </div>
              <div className="p-6">
                <JobRoleDetails
                  jobRoleId={selectedJobForDetails}
                  isDeveloperView={true}
                  onSendMessage={(developerId, developerName, jobRoleId, jobRoleTitle) => {
                    setSelectedThread({
                      otherUserId: developerId,
                      otherUserName: developerName,
                      otherUserRole: 'recruiter',
                      unreadCount: 0,
                      jobContext: {
                        id: jobRoleId,
                        title: jobRoleTitle
                      }
                    });
                    setShowJobDetailsModal(false);
                    setActiveTab('messages');
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};