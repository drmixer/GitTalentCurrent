import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // <-- CORRECTED SUPABASE PATH HERE
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import JobDetailView from '../components/Jobs/JobDetailView'; // <-- CORRECTED JOB DETAIL VIEW PATH HERE
import JobsDashboard from '../components/JobsDashboard';
import DeveloperDirectory from '../components/DeveloperDirectory';
import MessageList from '../components/MessageList';
import MessageThread from '../components/MessageThread';
import NotificationList from '../components/NotificationList';
import HiringPipeline from '../components/HiringPipeline';
import RecruiterProfileForm from '../components/RecruiterProfileForm';
import {
  Briefcase,
  Search,
  MessageSquare,
  Bell,
  TrendingUp,
  DollarSign,
  Users,
  ArrowLeft,
  Loader,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

// Define the types based on your schema outputs
interface UserProfile {
  id: string;
  role: string;
  name: string;
  email: string;
  is_approved: boolean;
  avatar_url?: string;
  profile_pic_url?: string;
  company_logo_url?: string;
  recruiters?: { company_name?: string } | null; // Nested recruiter data
}

interface JobRole {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  location: string;
  job_type: string;
  tech_stack: string[];
  experience_required?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_featured: boolean;
  salary?: string;
  recruiter?: { company_name?: string } | null; // Ensure nested recruiter data is available
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  job_role_id?: string;
  assignment_id?: string;
  subject?: string;
  body: string;
  sent_at: string;
  read_at?: string;
  is_read: boolean;
  // Add sender and receiver user profiles for display
  sender?: { name?: string; avatar_url?: string; profile_pic_url?: string; role?: string };
  receiver?: { name?: string; avatar_url?: string; profile_pic_url?: string; role?: string };
}

interface Hire {
  id: string;
  assignment_id: string;
  salary: number;
  hire_date?: string;
  start_date?: string;
  notes?: string;
  marked_by: string;
  created_at: string;
  assignment?: { // Nested assignment data
    id: string;
    developer_id: string;
    job_role_id: string;
    recruiter_id: string;
    status: string;
    developer?: { // Nested developer data
      user?: { // Nested user data for the developer
        id: string;
        name?: string;
        avatar_url?: string;
        profile_pic_url?: string;
        github_handle?: string; // Add github_handle if it exists on developer directly or user
      };
      // other developer fields if needed
    };
    job_role?: { // Nested job_role data
      id: string;
      title?: string;
      // other job_role fields if needed
    };
  };
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  entity_id?: string;
  entity_type?: string;
  message: string;
  is_read: boolean;
  created_at: string;
  user?: { // User related to the notification (e.g., sender for a message notification)
    name?: string;
    avatar_url?: string;
    profile_pic_url?: string;
  }
}

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  applications: number; // Placeholder, might need to derive from assignments
  recentHires: number;
  unreadMessages: number;
}

interface MessageThreadInfo {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  jobContext?: JobRole | null;
}

const RecruiterDashboard: React.FC = () => {
  const { user, userProfile, fetchUserProfile, authLoading, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data states
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    applications: 0,
    recentHires: 0,
    unreadMessages: 0,
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<MessageThreadInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false); // For approval check

  const isApproved = userProfile?.is_approved === true;
  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const currentUserId = user.id;

      // Fetch Job Roles
      const { data: jobRolesData, error: jobRolesError } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter!inner(company_name)
        `)
        .eq('recruiter_id', currentUserId); // Filter by recruiter_id to get only current recruiter's jobs

      if (jobRolesError) throw jobRolesError;
      setJobRoles(jobRolesData || []);

      // Fetch Hires
      // Modified to select deeply nested relations
      const { data: hiresData, error: hiresError } = await supabase
        .from('hires')
        .select(`
          *,
          assignment (
            *,
            developer (
              user (*)
            ),
            job_role (*)
          )
        `)
        .eq('marked_by', currentUserId) // Filter hires by the recruiter who marked them
        .order('created_at', { ascending: false });

      if (hiresError) throw hiresError;
      setHires(hiresData || []);

      // Fetch Notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*, user(name, avatar_url, profile_pic_url)') // Fetch user details for notifications
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;
      setNotifications(notificationsData || []);

      // Fetch Messages for unread count
      const { count: unreadMessagesCount, error: messagesCountError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);

      if (messagesCountError) throw messagesCountError;

      // Calculate Dashboard Stats
      const totalJobs = jobRolesData?.length || 0;
      const activeJobs = (jobRolesData?.filter(job => job.is_active)?.length || 0);
      const recentHires = hiresData?.length || 0; // Or filter by date for 'recent'
      // Applications count would need a more complex query on assignments table, skipped for now
      // Assuming 'applications' might be a separate view or derived from 'assignments' table if its status indicates an 'application'
      setStats({
        totalJobs,
        activeJobs,
        applications: 0, // Placeholder
        recentHires,
        unreadMessages: unreadMessagesCount || 0,
      });

    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError(`Failed to load data: ${err.message || err.error_description || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();

      // Setup Realtime subscriptions
      const jobRolesSubscription = supabase
        .channel('public:job_roles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_roles', filter: `recruiter_id=eq.${user.id}` }, payload => {
          fetchDashboardData(); // Re-fetch on job role changes
        })
        .subscribe();

      const hiresSubscription = supabase
        .channel('public:hires')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hires', filter: `marked_by=eq.${user.id}` }, payload => {
          fetchDashboardData(); // Re-fetch on hire changes
        })
        .subscribe();

      const messagesSubscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, payload => {
          fetchDashboardData(); // Re-fetch on new messages
        })
        .subscribe();

      const notificationsSubscription = supabase
        .channel('public:notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
          fetchDashboardData(); // Re-fetch on new notifications
        })
        .subscribe();


      return () => {
        jobRolesSubscription.unsubscribe();
        hiresSubscription.unsubscribe();
        messagesSubscription.unsubscribe();
        notificationsSubscription.unsubscribe();
      };
    }
  }, [user?.id, fetchDashboardData]);


  const handleViewApplicants = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveTab('job-details');
  };

  const handleJobUpdate = (message: string) => {
    setSuccess(message);
    fetchDashboardData(); // Refresh data after update
    setTimeout(() => setSuccess(null), 5000); // Clear message after 5 seconds
  };

  const handleMessageDeveloper = useCallback(async (developerId: string, developerName: string, jobRole?: JobRole) => {
    if (!userProfile) {
      setError("User profile not loaded. Cannot send message.");
      return;
    }

    // Check if a thread already exists
    const { data: existingThreads, error: threadError } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id')
      .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${developerId}),and(sender_id.eq.${developerId},receiver_id.eq.${userProfile.id})`)
      .limit(1);

    if (threadError) {
      console.error("Error checking existing thread:", threadError);
      setError("Failed to check existing message thread.");
      return;
    }

    let threadJobContext: JobRole | null = null;
    if (jobRole) {
      // Ensure jobRole has recruiter details if needed for display in MessageThread
      threadJobContext = jobRole;
      if (!threadJobContext.recruiter?.company_name && userProfile.recruiters?.company_name) {
          threadJobContext = {
              ...threadJobContext,
              recruiter: { company_name: userProfile.recruiters.company_name }
          };
      }
    }


    setSelectedThread({
      otherUserId: developerId,
      otherUserName: developerName,
      otherUserRole: 'developer', // Assuming the recipient is a developer
      otherUserProfilePicUrl: '', // Will be fetched by MessageThread or passed if available
      jobContext: threadJobContext,
    });
    setActiveTab('messages');
  }, [userProfile]);


  const handleViewNotificationJobRole = (jobRoleId: string) => {
    const job = jobRoles.find(jr => jr.id === jobRoleId);
    if (job) {
      setSelectedJobId(jobRoleId);
      setActiveTab('job-details');
    } else {
      setError("Job role not found for this notification.");
    }
  };


  const filteredHires = hires.filter(hire => {
    const developerName = hire.assignment?.developer?.user?.name?.toLowerCase() || '';
    const jobTitle = hire.assignment?.job_role?.title?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return developerName.includes(search) || jobTitle.includes(search);
  });

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Job Listings Stat Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-start">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
          <Briefcase className="w-6 h-6 text-blue-600" />
        </div>
        <p className="text-sm font-medium text-gray-500">Total Job Listings</p>
        <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalJobs}</h3>
        <button
          onClick={() => setActiveTab('my-jobs')}
          className="mt-4 text-blue-600 hover:text-blue-800 font-semibold text-sm"
        >
          Manage Listings &rarr;
        </button>
      </div>

      {/* Active Jobs Stat Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-start">
        <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-4">
          <TrendingUp className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-sm font-medium text-gray-500">Active Job Listings</p>
        <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.activeJobs}</h3>
        <button
          onClick={() => setActiveTab('my-jobs')}
          className="mt-4 text-blue-600 hover:text-blue-800 font-semibold text-sm"
        >
          View Active Jobs &rarr;
        </button>
      </div>

      {/* Unread Messages Stat Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-start">
        <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-4">
          <MessageSquare className="w-6 h-6 text-purple-600" />
        </div>
        <p className="text-sm font-medium text-gray-500">Unread Messages</p>
        <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.unreadMessages}</h3>
        <button
          onClick={() => setActiveTab('messages')}
          className="mt-4 text-blue-600 hover:text-blue-800 font-semibold text-sm"
        >
          View Messages &rarr;
        </button>
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
                      {hire.assignment?.developer?.user?.name || 'Unknown Developer'}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                            src={hire.assignment?.developer?.user?.avatar_url || hire.assignment?.developer?.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(hire.assignment?.developer?.user?.name || hire.assignment?.developer?.user?.id || 'U')}&background=random`}
                            alt={hire.assignment?.developer?.user?.name || 'Developer'}
                            className="w-8 h-8 rounded-full object-cover mr-3"
                        />
                        <div className="text-sm font-semibold text-gray-900">
                          {hire.assignment?.developer?.user?.name || 'Unknown'}
                        </div>
                      </div>
                    </td>
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
                        {new Date(hire.hire_date || '').toLocaleDateString()}
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
    return <Navigate to="/dashboard" replace />; // Redirect to general dashboard if profile missing
  }

  if (userProfile.role !== 'recruiter') {
    return <Navigate to="/dashboard" replace />; // Redirect if not recruiter
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
              refreshProfile().finally(() => setIsRefreshing(false)); // Use finally for consistent state reset
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
                <Users className="w-5 h-5 mr-2" /> {/* Reusing Users icon, consider a more specific icon like User or Settings */}
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
              // Handle viewing message: Find the message, set selectedThread if needed
              setActiveTab('messages'); // Simply navigate to messages tab for now
            }}
          />
        )}
        {activeTab === 'tracker' && <HiringPipeline />}
        {activeTab === 'profile' && <RecruiterProfileForm />}
      </div>
    </div>
  );
};

export default RecruiterDashboard;
