import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import {
  Users,
  Briefcase,
  MessageSquare,
  TrendingUp,
  Plus,
  Search,
  Bell,
  Eye,
  Edit,
  Trash2,
  Star,
  Building,
  MapPin,
  DollarSign,
  Clock,
  Calendar,
  Loader,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { JobRoleForm } from '../components/JobRoles/JobRoleForm';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { NotificationList } from '../components/Notifications/NotificationList';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { JobImportModal } from '../components/JobRoles/JobImportModal';
import { MarkAsHiredModal } from '../components/Hires/MarkAsHiredModal';
import { JobRole, Hire, Message } from '../types';
import DeveloperDirectory from '../components/DeveloperDirectory';
import HiringPipeline from '../components/HiringPipeline';
import JobsDashboard from '../components/Jobs/JobsDashboard';
import { JobDetailView } from '../components/Jobs/JobDetailView';
import { RecruiterProfileForm } from '../components/Profile/RecruiterProfileForm';

// This interface defines the expected structure of a JobRole object
// *after* the data transformation, where company_name is directly on recruiter.
interface FetchedJobRole extends JobRole {
  recruiter: {
    id: string;
    name: string;
    email: string;
    company_name: string | null; // This will hold the flattened company name
  };
}

interface MessageThread {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  lastMessage: Message;
  unreadCount: number;
  jobContext?: {
    id: string;
    title: string;
  };
}

export const RecruiterDashboard = () => {
  const { user, userProfile, loading: authLoading, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'my-jobs' | 'job-details' | 'search-devs' | 'messages' | 'notifications' | 'hires' | 'tracker' | 'profile'>('search-devs');
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    featuredJobs: 0,
    totalMessages: 0,
    unreadMessages: 0,
    totalHires: 0,
    totalRevenue: 0
  });

  // Use the new interface for jobRoles state
  const [jobRoles, setJobRoles] = useState<FetchedJobRole[]>([]);

  const [hires, setHires] = useState<(Hire & { assignment: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if the user is approved
  const isApproved = userProfile?.is_approved === true;

  console.log('RecruiterDashboard render - authLoading:', authLoading, 'userProfile:', userProfile);

  useEffect(() => {
    // If the recruiter's profile is not approved, refresh it to check for status changes.
    if (userProfile && !isApproved && !isRefreshing) {
      console.log('Unapproved recruiter profile detected, refreshing to check for updates...');
      setIsRefreshing(true);
      refreshProfile().finally(() => {
        setIsRefreshing(false);
      });
    }
  }, [userProfile, isApproved, refreshProfile, isRefreshing]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get('company');
    if (company) {
      setCompanyFilter(company);
      setActiveTab('my-jobs');
    }
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'recruiter') {
      console.log('RecruiterDashboard - Fetching dashboard data');
      fetchDashboardData();
    }
  }, [userProfile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      await Promise.all([
        fetchJobRoles(),
        fetchStats(),
        fetchHires(),
        fetchUnreadNotificationsCount()
      ]);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobRoles = async () => {
    try {
      if (!userProfile?.id) return;

      let query = supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users!job_roles_recruiter_id_fkey (
            id,
            name,
            email,
            recruiter_profile:recruiters (
              company_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (companyFilter) {
        query = query.ilike('recruiter.recruiter_profile.company_name', `%${companyFilter}%`);
      } else {
        query = query.eq('recruiter_id', userProfile.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Data Transformation for nested relationships in RecruiterDashboard
      const transformedJobRoles = (data || []).map(jobRole => {
        const transformedRecruiter = {
          id: jobRole.recruiter.id,
          name: jobRole.recruiter.name,
          email: jobRole.recruiter.email,
          // Safely access company_name using optional chaining and nullish coalescing
          company_name: jobRole.recruiter.recruiter_profile?.[0]?.company_name ?? null
        };

        return {
          ...jobRole,
          recruiter: transformedRecruiter
        } as FetchedJobRole;
      });

      setJobRoles(transformedJobRoles);

    } catch (error: any) {
      console.error('Error fetching job roles:', error);
    }
  };

  const fetchStats = async () => {
    try {
      if (!userProfile?.id) return;

      // Fetch job stats
      const { data: jobs, error: jobsError } = await supabase
        .from('job_roles')
        .select('id, is_active, is_featured')
        .eq('recruiter_id', userProfile.id);

      if (jobsError) throw jobsError;

      // Fetch message stats
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, is_read')
        .eq('receiver_id', userProfile.id);

      if (messagesError) throw messagesError;

      // Fetch hire stats
      const { data: hires, error: hiresError } = await supabase
        .from('hires')
        .select('id, salary')
        .eq('marked_by', userProfile.id);

      if (hiresError) throw hiresError;

      setStats({
        totalJobs: jobs?.length || 0,
        activeJobs: jobs?.filter(j => j.is_active).length || 0,
        featuredJobs: jobs?.filter(j => j.is_featured).length || 0,
        totalMessages: messages?.length || 0,
        unreadMessages: messages?.filter(m => !m.is_read).length || 0,
        totalHires: hires?.length || 0,
        totalRevenue: hires?.reduce((sum, hire) => sum + Math.round(hire.salary * 0.15), 0) || 0
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchHires = async () => {
    try {
      if (!userProfile?.id) return;

      const { data, error } = await supabase
        .from('hires')
        .select(`
          *,
          assignment:assignments(
            *,
            developer:users!assignments_developer_id_fkey(*),
            job_role:job_roles(*)
          )
        `)
        .eq('assignment.recruiter_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHires(data || []);
    } catch (error: any) {
      console.error('Error fetching hires:', error);
    }
  };

  const fetchUnreadNotificationsCount = async () => {
    try {
      if (!userProfile?.id) return;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadNotifications(count || 0);
    } catch (error: any) {
      console.error('Error fetching unread notifications count:', error);
    }
  };

  const handleViewApplicants = (jobId: string) => {
    console.log(`Setting selectedJobId to: ${jobId} for viewing applicants.`); // Added for debugging
    setSelectedJobId(jobId);
    setActiveTab('job-details'); // This tab will display job details AND applicants
  };

  const handleMessageDeveloper = (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => {
    setSelectedThread({
      otherUserId: developerId,
      otherUserName: developerName,
      otherUserRole: 'developer',
      unreadCount: 0,
      lastMessage: {} as Message,
      jobContext: jobRoleId && jobRoleTitle ? {
        id: jobRoleId,
        title: jobRoleTitle
      } : undefined
    });
    setActiveTab('messages');
  };

  const handleViewNotificationJobRole = (jobRoleId: string) => {
    setSelectedJobId(jobRoleId);
    setActiveTab('my-jobs');
  };

  const handleHireSuccess = async () => {
    // Refresh hires data
    await fetchHires();
    await fetchStats();

    setSuccess('Developer hired successfully!');
    setTimeout(() => {
      setSuccess('');
    }, 3000);
  };

  const handleJobUpdate = () => {
    fetchJobRoles();
    fetchStats();
  }

  // Filter hires based on search term
  const filteredHires = hires.filter(hire =>
    hire.assignment?.developer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hire.assignment?.job_role?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalJobs}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Total Job Listings</div>
          <div className="text-xs text-emerald-600 font-medium">{stats.activeJobs} active jobs</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Star className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.featuredJobs}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Featured Jobs</div>
          <div className="text-xs text-emerald-600 font-medium">Higher visibility to developers</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.unreadMessages}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Unread Messages</div>
          <div className="text-xs text-emerald-600 font-medium">{stats.totalMessages} total messages</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalHires}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Successful Hires</div>
          <div className="text-xs text-emerald-600 font-medium">${stats.totalRevenue.toLocaleString()} in fees</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <button
            onClick={() => setActiveTab('my-jobs')}
            className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <Briefcase className="w-8 h-8 text-blue-600 mb-3" />
            <span className="font-semibold text-gray-900">Manage Jobs</span>
            <span className="text-sm text-gray-600 mt-1">View, edit, and create job listings</span>
          </button>

          <button
            onClick={() => setActiveTab('tracker')}
            className="flex flex-col items-center justify-center p-6 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors"
          >
            <Users className="w-8 h-8 text-purple-600 mb-3" />
            <span className="font-semibold text-gray-900">Hiring Pipeline</span>
            <span className="text-sm text-gray-600 mt-1">Track candidates across all jobs</span>
          </button>

          <button
            onClick={() => setActiveTab('search-devs')}
            className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            <Search className="w-8 h-8 text-emerald-600 mb-3" />
            <span className="font-semibold text-gray-900">Search Developers</span>
            <span className="text-sm text-gray-600 mt-1">Find talent for your roles</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-gray-900 mb-6">Recent Activity</h2>

        {/* Recent Hires */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Hires</h3>
          {hires.length > 0 ? (
            <div className="space-y-4">
              {hires.slice(0, 3).map(hire => (
                <div key={hire.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {hire.assignment?.developer?.name || 'Unknown Developer'}
                    </h4>
                    <div className="text-sm text-gray-600 mt-1">
                      Hired for {hire.assignment?.job_role?.title || 'Unknown Position'} •
                      ${hire.salary.toLocaleString()} annual salary
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">
                    ${Math.round(hire.salary * 0.15).toLocaleString()} fee
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No hires recorded yet.</p>
          )}

          {hires.length > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setActiveTab('hires')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                View All Hires
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSearchDevelopers = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Search Developers</h2>

      <DeveloperDirectory onSendMessage={handleMessageDeveloper} />
    </div>
  );

  const renderMessages = () => {
    if (selectedThread) {
      return (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedThread(null)}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Messages
          </button>

          <MessageThread
            otherUserId={selectedThread.otherUserId}
            otherUserName={selectedThread.otherUserName}
            otherUserRole={selectedThread.otherUserRole}
            otherUserProfilePicUrl={selectedThread.otherUserProfilePicUrl}
            jobContext={selectedThread.jobContext}
            onNewMessage={fetchDashboardData}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <MessageList
          onThreadSelect={setSelectedThread}
          searchTerm={searchTerm}
        />
      </div>
    );
  };

  const renderHires = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Successful Hires</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search hires..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>


      {/* Hires List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
          <span className="text-gray-600 font-medium">Loading hires...</span>
        </div>
      ) : filteredHires.length > 0 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Platform Fee</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hire Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHires.map((hire) => (
                  <tr key={hire.id} className="hover:bg-gray-50 transition-colors">
                    {/* THIS WAS THE PROBLEM AREA */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                          {hire.assignment?.developer?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          {hire.assignment?.developer?.name || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    {/* END OF PROBLEM AREA */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {hire.assignment?.job_role?.title || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        ${hire.salary.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-emerald-600">
                        ${Math.round(hire.salary * 0.15).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(hire.hire_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {hire.start_date ? new Date(hire.start_date).toLocaleDateString() : 'Not set'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Hires Found</h3>
          <p className="text-gray-600">
            {searchTerm ? "No hires match your search criteria" : "You haven't recorded any successful hires yet"}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            When you successfully hire a developer, record it here to track your platform fees.
          </p>
        </div>
      )}
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated or not a recruiter
  if (!userProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  if (userProfile.role !== 'recruiter') {
    return <Navigate to="/dashboard" replace />;
  }

  // If recruiter is not approved, show pending approval message
  if (!isApproved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            {isRefreshing ? (
              <Loader className="animate-spin h-10 w-10 text-yellow-600" />
            ) : (
              <Clock className="h-10 w-10 text-yellow-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {isRefreshing ? 'Checking Account Status...' : 'Account Pending Approval'}
          </h1>
          <p className="text-gray-600 mb-6">
            Your recruiter account is currently pending approval by our admin team.
            You'll receive an email notification once your account is approved.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This usually takes 1-2 business days. If you have any questions,
            please contact support@gittalent.dev
          </p>
          <button
            onClick={() => {
              setIsRefreshing(true);
              refreshProfile(() => setIsRefreshing(false));
            }}
            disabled={isRefreshing}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 inline ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Checking...' : 'Check Status'}
          </button>
        </div>
      </div>
    );
  }

  // Find the selected job role based on selectedJobId
  // This selectedJobRole will now have the `company_name` directly on `recruiter` thanks to the transformation
  const selectedJobRole = jobRoles.find(job => job.id === selectedJobId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Welcome, {userProfile.name}!
          </h1>
          <p className="text-gray-600">Manage your job listings and find the perfect developers for your team.</p>
        </div>

        {/* Success/Error messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-green-800 font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-800 font-medium">{error}</p>
            <button onClick={fetchDashboardData} className="ml-auto px-3 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200">Retry</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('my-jobs')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'my-jobs'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Briefcase className="w-5 h-5 mr-2" />
                My Job Listings
              </button>
              <button
                onClick={() => setActiveTab('search-devs')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'search-devs'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Search className="w-5 h-5 mr-2" />
                Search Developers
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'messages'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Messages
                {stats.unreadMessages > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {stats.unreadMessages}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'notifications'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Bell className="w-5 h-5 mr-2" />
                Notifications
                {unreadNotifications > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('hires')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'hires'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-5 h-5 mr-2" />
                Hires
              </button>
              <button
                onClick={() => setActiveTab('tracker')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'tracker'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5 mr-2" />
                Hiring Pipeline
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600 bg-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5 mr-2" />
                Profile
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'my-jobs' && <JobsDashboard jobRoles={jobRoles} onViewApplicants={handleViewApplicants} onJobUpdate={handleJobUpdate} />}
        {activeTab === 'job-details' && selectedJobId && selectedJobRole && (
          <JobDetailView
            job={selectedJobRole}
            onBack={() => setActiveTab('my-jobs')}
            onMessageDeveloper={handleMessageDeveloper}
          />
        )}
        {activeTab === 'search-devs' && renderSearchDevelopers()}
        {activeTab === 'messages' && renderMessages()}
        {activeTab === 'hires' && renderHires()}
        {activeTab === 'notifications' && (
          <NotificationList
            onViewJobRole={handleViewNotificationJobRole}
            onViewMessage={(messageId) => {
              // Handle viewing message
              setActiveTab('messages');
            }}
          />
        )}
        {activeTab === 'tracker' && <HiringPipeline />}
        {activeTab === 'profile' && <RecruiterProfileForm />}
      </div>
    </div>
  );
};
