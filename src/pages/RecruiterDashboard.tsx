import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DeveloperList } from '../components/DeveloperList';
import { JobRoleForm } from '../components/JobRoles/JobRoleForm';
import { JobImportModal } from '../components/JobRoles/JobImportModal';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { 
  Briefcase, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Plus, 
  Upload, 
  Loader,
  Building,
  Mail,
  Calendar,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { JobRole } from '../types';

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

export const RecruiterDashboard = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJobRole, setEditingJobRole] = useState<JobRole | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    totalAssignments: 0,
    totalHires: 0,
    totalRevenue: 0
  });
  const [unreadMessages, setUnreadMessages] = useState(0);

  console.log('RecruiterDashboard render - authLoading:', authLoading, 'userProfile:', userProfile);

  useEffect(() => {
    if (userProfile?.role === 'recruiter') {
      fetchDashboardData();
    }
  }, [userProfile]);

  const fetchDashboardData = async () => {
    try {
      console.log('RecruiterDashboard - Fetching dashboard data');
      setLoading(true);
      setError('');

      if (!userProfile?.id) return;

      // Fetch job roles
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_roles')
        .select('*')
        .eq('recruiter_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;
      setJobRoles(jobsData || []);

      // Fetch assignments count
      const { count: assignmentsCount, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', userProfile.id);

      if (assignmentsError) throw assignmentsError;

      // Fetch hires
      const { data: hiresData, error: hiresError } = await supabase
        .from('hires')
        .select(`
          *,
          assignment:assignments(
            *,
            developer:users!assignments_developer_id_fkey(*),
            job_role:job_roles(*)
          )
        `)
        .eq('assignment.recruiter_id', userProfile.id);

      if (hiresError) throw hiresError;

      // Calculate total revenue (15% of hire salaries)
      const totalRevenue = (hiresData || []).reduce((sum, hire) => {
        return sum + Math.round(hire.salary * 0.15);
      }, 0);

      // Fetch unread messages count
      const { count: unreadCount, error: messagesError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userProfile.id)
        .eq('is_read', false);

      if (messagesError) throw messagesError;

      // Set stats
      setStats({
        totalJobs: jobsData?.length || 0,
        activeJobs: jobsData?.filter(job => job.is_active).length || 0,
        totalAssignments: assignmentsCount || 0,
        totalHires: hiresData?.length || 0,
        totalRevenue
      });

      setUnreadMessages(unreadCount || 0);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleJobFormSuccess = () => {
    setShowJobForm(false);
    setEditingJobRole(null);
    fetchDashboardData();
  };

  const handleEditJob = (job: JobRole) => {
    setEditingJobRole(job);
    setShowJobForm(true);
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchDashboardData();
  };

  console.log('RecruiterDashboard - Rendering main UI, activeTab:', activeTab);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!userProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect if not a recruiter
  if (userProfile.role !== 'recruiter') {
    return <Navigate to="/dashboard" replace />;
  }

  // Show pending approval message if not approved
  if (!userProfile.is_approved) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Building className="w-10 h-10 text-yellow-600" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-4">Account Pending Approval</h1>
              <p className="text-xl text-gray-600 max-w-lg mx-auto">
                Your recruiter account is currently pending admin approval.
              </p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-8">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-yellow-800">What happens next?</h3>
                  <div className="mt-2 text-yellow-700">
                    <p className="mb-2">
                      Our admin team will review your account details and approve your access to the platform. This typically takes 1-2 business days.
                    </p>
                    <p>
                      You'll receive an email notification once your account has been approved.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-8">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div className="p-4">
                  <Mail className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Email Confirmation</h3>
                  <p className="text-sm text-gray-600">You'll receive an email when approved</p>
                </div>
                <div className="p-4">
                  <Calendar className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">1-2 Business Days</h3>
                  <p className="text-sm text-gray-600">Typical approval timeframe</p>
                </div>
                <div className="p-4">
                  <Building className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Company Verification</h3>
                  <p className="text-sm text-gray-600">We verify all recruiter accounts</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4">
                Have questions or need assistance? Contact our support team.
              </p>
              <a 
                href="mailto:support@gittalent.dev" 
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Mail className="w-5 h-5 mr-2" />
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalJobs}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Total Jobs</div>
          <div className="text-xs text-emerald-600 font-medium">{stats.activeJobs} active</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalAssignments}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Assignments</div>
          <div className="text-xs text-emerald-600 font-medium">Developer matches</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{unreadMessages}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Unread Messages</div>
          <div className="text-xs text-emerald-600 font-medium">From developers</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalHires}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Successful Hires</div>
          <div className="text-xs text-emerald-600 font-medium">Completed placements</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">${stats.totalRevenue.toLocaleString()}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Platform Fees</div>
          <div className="text-xs text-emerald-600 font-medium">15% of hire salaries</div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Recent Job Postings</h3>
          <button
            onClick={() => setActiveTab('jobs')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            View All Jobs
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        
        {jobRoles.length > 0 ? (
          <div className="space-y-4">
            {jobRoles.slice(0, 3).map((job) => (
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
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditJob(job)}
                      className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold flex items-center"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No job postings yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Create your first job posting to start finding developers
            </p>
            <button
              onClick={() => setShowJobForm(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4 mr-2 inline" />
              Create Job Posting
            </button>
          </div>
        )}
      </div>

      {/* Recent Assignments */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Recent Assignments</h3>
          <button
            onClick={() => setActiveTab('assignments')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            View All Assignments
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        
        {stats.totalAssignments > 0 ? (
          <AssignmentList 
            recruiterId={userProfile.id}
            onViewDeveloper={() => setActiveTab('developers')}
            onSendMessage={(developerId, developerName, jobRoleId, jobRoleTitle) => {
              setSelectedThread({
                otherUserId: developerId,
                otherUserName: developerName,
                otherUserRole: 'developer',
                unreadCount: 0,
                jobContext: {
                  id: jobRoleId,
                  title: jobRoleTitle
                }
              });
              setActiveTab('messages');
            }}
          />
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No developer assignments yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Create a job posting and assign developers to get started
            </p>
            <button
              onClick={() => setShowJobForm(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4 mr-2 inline" />
              Create Job Posting
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 hover:shadow-md transition-all">
          <h3 className="font-bold text-gray-900 mb-3">Post a New Job</h3>
          <p className="text-gray-600 text-sm mb-4">
            Create a new job posting to find the perfect developer for your needs.
          </p>
          <button
            onClick={() => setShowJobForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Create Job
          </button>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100 hover:shadow-md transition-all">
          <h3 className="font-bold text-gray-900 mb-3">Import Multiple Jobs</h3>
          <p className="text-gray-600 text-sm mb-4">
            Bulk import job postings from a CSV file to save time.
          </p>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            <Upload className="w-4 h-4 mr-2 inline" />
            Import Jobs
          </button>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100 hover:shadow-md transition-all">
          <h3 className="font-bold text-gray-900 mb-3">Browse Developers</h3>
          <p className="text-gray-600 text-sm mb-4">
            View and message developers assigned to your job postings.
          </p>
          <button
            onClick={() => setActiveTab('developers')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
          >
            <Users className="w-4 h-4 mr-2 inline" />
            View Developers
          </button>
        </div>
      </div>
    </div>
  );

  const renderJobs = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Job Postings</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            <Upload className="w-4 h-4 mr-2 inline" />
            Import Jobs
          </button>
          <button
            onClick={() => setShowJobForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Create Job
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search jobs by title, location, or tech stack..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Job Listings */}
      {jobRoles.length > 0 ? (
        <div className="space-y-6">
          {jobRoles.map((job) => (
            <div key={job.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {job.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <span>{job.location}</span>
                    <span>{job.job_type}</span>
                    <span>${job.salary_min}k - ${job.salary_max}k</span>
                    <span>Posted {new Date(job.created_at).toLocaleDateString()}</span>
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
                  onClick={() => handleEditJob(job)}
                  className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
                >
                  Edit Job
                </button>
                <button
                  onClick={() => handleAssignDeveloper(job.id)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                >
                  Assign Developer
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Job Postings Yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first job posting to start finding developers
          </p>
          <button
            onClick={() => setShowJobForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Create Job Posting
          </button>
        </div>
      )}
    </div>
  );

  const renderDevelopers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Developer Talent Pool</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Refresh
          </button>
        </div>
      </div>
      
      <DeveloperList 
      fetchType="all"
      onSendMessage={(developerId, developerName, jobRoleId, jobRoleTitle) => {
        setSelectedThread({
          otherUserId: developerId,
          otherUserName: developerName,
          otherUserRole: 'developer',
          unreadCount: 0,
          jobContext: jobRoleId && jobRoleTitle ? {
            id: jobRoleId,
            title: jobRoleTitle
          } : undefined
        });
        setActiveTab('messages');
      }}
    />
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
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Welcome, {userProfile.name}!
          </h1>
          <p className="text-gray-600">Manage your job postings and connect with developers</p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('jobs')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'jobs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Briefcase className="w-5 h-5 mr-2" />
                Jobs
              </button>
              <button
                onClick={() => setActiveTab('developers')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'developers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5 mr-2" />
                Developers
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'messages'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Messages
                {unreadMessages > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {unreadMessages}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'developers' && renderDevelopers()}
        {activeTab === 'messages' && renderMessages()}

        {/* Job Form Modal */}
        {showJobForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <JobRoleForm
                jobRole={editingJobRole || undefined}
                onSuccess={handleJobFormSuccess}
                onCancel={() => {
                  setShowJobForm(false);
                  setEditingJobRole(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Import Jobs Modal */}
        {showImportModal && (
          <JobImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSuccess={handleImportSuccess}
          />
        )}
      </div>
    </div>
  );
};