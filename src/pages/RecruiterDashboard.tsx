// src/pages/RecruiterDashboard.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import {
  Users,
  Briefcase,
  MessageSquare,
  TrendingUp,
  Search,
  Bell,
  DollarSign,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader,
  Eye,
} from 'lucide-react';

// === CUSTOM COMPONENTS ===
import { JobRoleForm } from '../components/JobRoles/JobRoleForm';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { NotificationList } from '../components/Notifications/NotificationList';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { JobImportModal } from '../components/JobRoles/JobImportModal';
import { MarkAsHiredModal } from '../components/Hires/MarkAsHiredModal';
import { JobDetailView } from '../components/Jobs/JobDetailView';
import { RecruiterProfileForm } from '../components/Profile/RecruiterProfileForm';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SuccessModal } from '../components/SuccessModal'; // Assuming you have this
import DeveloperDirectory from '../components/DeveloperDirectory';
import HiringPipeline from '../components/HiringPipeline';
import JobsDashboard from '../components/Jobs/JobsDashboard';
import { DeveloperProfileModal } from '../components/DeveloperProfileModal'; // <-- Corrected to named import based on typical usage

// === TYPE IMPORTS ===
import { JobRole, Hire, Message, User, DeveloperProfile } from '../types';

// Assuming CandidateType is defined in types.ts or passed consistently.
// If not explicitly defined in ../types, you might need to add it there.
// Based on JobDetailView.tsx, CandidateType likely looks like this:
// This interface should ideally be moved to `src/types.ts` for centralized management.
interface CandidateType {
  id: string; // This is the applied_job ID
  developer_id: string;
  job_id: string; // Corrected from job_role_id based on applied_jobs schema
  status: string; // e.g., 'applied', 'interviewing', 'rejected', 'hired'
  applied_at: string; // Changed from created_at based on applied_jobs schema
  cover_letter?: string;
  notes?: string;
  developer: {
    user_id: string; // This is the actual ID for the developer in `developers` table
    github_handle?: string;
    bio?: string;
    skills?: string[];
    experience_years?: number; // Changed from 'experience' and type to number based on schema
    linked_projects?: string[]; // Assuming this is linked_projects
    profile_pic_url?: string; // Assuming this field exists
    user: {
      id: string;
      name: string;
      email: string;
      avatar_url?: string;
      profile_pic_url?: string;
    };
  };
  job_role?: JobRole; // Optional, as JobDetailView might pass the main job role separately
}


// Defining interfaces locally as per our discussion, or ensure they are in '../types'
interface LocalMessageThread {
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

interface UserProfile {
  id: string;
  role: string;
  name: string;
  email: string;
  is_approved: boolean;
  avatar_url?: string;
  profile_pic_url?: string;
  company_logo_url?: string;
  recruiters?: { company_name?: string } | null;
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
  user?: {
    name?: string;
    avatar_url?: string;
    profile_pic_url?: string;
  }
}

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  applications: number;
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
  const { user, userProfile, authLoading, refreshProfile } = useAuth();

  // --- State for fetched dashboard data ---
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

  // --- Separate loading and error states for the dashboard's main data fetches ---
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- UI-related states ---
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<MessageThreadInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false); // For approval check

  // --- Developer Profile Modal States ---
  const [isDeveloperProfileModalOpen, setIsDeveloperProfileModalOpen] = useState(false);
  const [selectedDeveloperForModal, setSelectedDeveloperForModal] = useState<DeveloperProfile | null>(null);

  // --- NEW: Mark As Hired Modal States ---
  const [isMarkAsHiredModalOpen, setIsMarkAsHiredModalOpen] = useState(false);
  const [candidateToHire, setCandidateToHire] = useState<CandidateType | null>(null);
  const [jobRoleForHire, setJobRoleForHire] = useState<JobRole | null>(null);

  const isApproved = userProfile?.is_approved === true;
  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  // --- Consolidated Data Fetching Function ---
  const fetchDashboardData = useCallback(async () => {
    if (!userProfile?.id) {
      setDashboardLoading(false);
      return;
    }

    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const currentUserId = userProfile.id;

      // Fetch Job Roles with nested company_name
      const { data: jobRolesData, error: jobRolesError } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:recruiters (
            company_name,
            user:users (
              name,
              avatar_url,
              profile_pic_url
            )
          )
        `)
        .eq('recruiter_id', currentUserId);

      if (jobRolesError) throw jobRolesError;
      setJobRoles(jobRolesData || []);

      // Fetch Hires
      const { data: hiresData, error: hiresError } = await supabase
        .from('hires')
        .select(`
          *,
          developer:developers (
            user:users (*)
          ),
          job_role:job_roles (*)
        `)
        .eq('marked_by', currentUserId)
        .order('created_at', { ascending: false });

      if (hiresError) throw hiresError;
      setHires(hiresData || []);

      // Fetch Notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*, user:users(name, avatar_url, profile_pic_url)')
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
      const applications = 0; // This might need a separate query for 'applied_jobs' count
      const recentHires = hiresData?.length || 0;
      setStats({
        totalJobs,
        activeJobs,
        applications, // Update if you fetch this data
        recentHires,
        unreadMessages: unreadMessagesCount || 0,
      });

    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setDashboardError(`Failed to load data: ${err.message || err.error_description || 'Unknown error'}`);
    } finally {
      setDashboardLoading(false);
    }
  }, [userProfile?.id]);

  // --- useEffect to call fetchDashboardData on initial load and setup specific Realtime subscriptions ---
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();

      const currentUserId = user.id;

      // Job Roles Subscription
      const jobRolesSubscription = supabase
        .channel('job_roles_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_roles', filter: `recruiter_id=eq.${currentUserId}` }, async payload => {
          const { data: newJobRolesData, error: newJobRolesError } = await supabase
            .from('job_roles')
            .select(`*, recruiter:recruiters(company_name, user:users(name, avatar_url, profile_pic_url))`)
            .eq('recruiter_id', currentUserId);
          if (newJobRolesError) {
            console.error("Error updating job roles via subscription:", newJobRolesError);
            setDashboardError("Failed to update job roles via live data.");
          } else {
            setJobRoles(newJobRolesData || []);
            setStats(prev => ({
              ...prev,
              totalJobs: newJobRolesData?.length || 0,
              activeJobs: (newJobRolesData?.filter(job => job.is_active)?.length || 0)
            }));
          }
        })
        .subscribe();

      // Hires Subscription
      const hiresSubscription = supabase
        .channel('hires_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hires', filter: `marked_by=eq.${currentUserId}` }, async payload => {
          const { data: newHiresData, error: newHiresError } = await supabase
            .from('hires')
            .select(`*, developer:developers(user:users(*)), job_role:job_roles(*)`)
            .eq('marked_by', currentUserId)
            .order('created_at', { ascending: false });
          if (newHiresError) {
            console.error("Error updating hires via subscription:", newHiresError);
            setDashboardError("Failed to update hires via live data.");
          } else {
            setHires(newHiresData || []);
            setStats(prev => ({ ...prev, recentHires: newHiresData?.length || 0 }));
          }
        })
        .subscribe();

      // Messages Subscription - OPTIMIZED for just unread count
      const messagesSubscription = supabase
        .channel('messages_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUserId}` }, async payload => {
          const { count: newUnreadMessagesCount, error: newMessagesCountError } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('receiver_id', currentUserId)
            .eq('is_read', false);

          if (newMessagesCountError) {
            console.error("Error updating unread messages count via subscription:", newMessagesCountError);
          } else {
            setStats(prev => ({ ...prev, unreadMessages: newUnreadMessagesCount || 0 }));
          }
        })
        .subscribe();

      // Notifications Subscription
      const notificationsSubscription = supabase
        .channel('notifications_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, async payload => {
          const { data: newNotificationsData, error: newNotificationsError } = await supabase
            .from('notifications')
            .select('*, user:users(name, avatar_url, profile_pic_url)')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });
          if (newNotificationsData) {
            setNotifications(newNotificationsData);
          } else if (newNotificationsError) {
            console.error("Error updating notifications via subscription:", newNotificationsError);
            setDashboardError("Failed to update notifications via live data.");
          }
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

  // --- Handlers ---
  const handleViewApplicants = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setActiveTab('job-details');
  }, []);

  const handleJobUpdate = useCallback((message: string) => {
    setSuccess(message);
    fetchDashboardData();
    setTimeout(() => setSuccess(null), 5000);
  }, [fetchDashboardData]);

  const handleMessageDeveloper = useCallback(async (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => {
    if (!userProfile) {
      setDashboardError("User profile not loaded. Cannot send message.");
      return;
    }

    let threadJobContext: JobRole | null = null;
    if (jobRoleId && jobRoleTitle) {
      // Find the full job role object from the state if available
      const fullJobRole = jobRoles.find(job => job.id === jobRoleId);
      threadJobContext = fullJobRole || { id: jobRoleId, title: jobRoleTitle, description: '' /* add other necessary fields if not found */ };

      // Ensure company_name is correctly set if not already part of the jobRole object from the DB
      // This is a more robust way to merge company_name for context
      if (userProfile.recruiters?.company_name && (!threadJobContext.recruiter?.company_name)) {
        threadJobContext = {
          ...threadJobContext,
          recruiter: {
            ...threadJobContext.recruiter, // Preserve existing recruiter data
            company_name: userProfile.recruiters.company_name
          }
        };
      }
    }

    // You might need to fetch the developer's profile pic here if not passed directly
    // For now, let's assume JobDetailView passes it or it's handled by DeveloperProfileModal/MessageThread
    let otherUserProfilePicUrl: string | undefined;
    if (jobRoleId) { // Assuming developer pic can be found via an applied job for context
      const { data: appliedJobData, error: appliedJobError } = await supabase
        .from('applied_jobs')
        .select(`developer:developers(profile_pic_url, user:users(avatar_url))`)
        .eq('job_id', jobRoleId)
        .eq('developer_id', developerId)
        .single();

      if (!appliedJobError && appliedJobData?.developer) {
        otherUserProfilePicUrl = appliedJobData.developer.profile_pic_url || appliedJobData.developer.user?.avatar_url;
      }
    }


    setSelectedThread({
      otherUserId: developerId,
      otherUserName: developerName,
      otherUserRole: 'developer',
      otherUserProfilePicUrl: otherUserProfilePicUrl,
      jobContext: threadJobContext,
    });
    setActiveTab('messages');
  }, [userProfile, jobRoles]); // Added jobRoles to dependency array

  const handleCloseMessageThread = useCallback(() => {
    setActiveTab('messages');
    setSelectedThread(null);
  }, []);

  const handleViewNotificationJobRole = useCallback((jobRoleId: string) => {
    const job = jobRoles.find(jr => jr.id === jobRoleId);
    if (job) {
      setSelectedJobId(jobRoleId);
      setActiveTab('job-details');
    } else {
      setDashboardError("Job role not found for this notification.");
    }
  }, [jobRoles]);

  const filteredHires = hires.filter(hire => {
    const developerName = hire.developer?.user?.name?.toLowerCase() || ''; // Corrected path based on new fetch
    const jobTitle = hire.job_role?.title?.toLowerCase() || ''; // Corrected path based on new fetch
    const search = searchTerm.toLowerCase();
    return developerName.includes(search) || jobTitle.includes(search);
  });

  // --- NEW: Handlers for DeveloperProfileModal ---
  const handleViewDeveloperProfile = useCallback((developer: DeveloperProfile) => {
    setSelectedDeveloperForModal(developer);
    setIsDeveloperProfileModalOpen(true);
  }, []);

  const handleCloseDeveloperProfileModal = useCallback(() => {
    setIsDeveloperProfileModalOpen(false);
    setSelectedDeveloperForModal(null);
  }, []);

  // --- NEW: Handlers for Mark As Hired Modal ---
  // This is called from JobDetailView when 'Hired' status is selected
  const handleInitiateHire = useCallback((candidate: CandidateType, jobRole: JobRole) => {
    setCandidateToHire(candidate);
    setJobRoleForHire(jobRole);
    setIsMarkAsHiredModalOpen(true);
  }, []);

  const handleCloseMarkAsHiredModal = useCallback(() => {
    setIsMarkAsHiredModalOpen(false);
    setCandidateToHire(null);
    setJobRoleForHire(null);
    setDashboardError(null); // Clear any previous error
  }, []);

  // This is called from MarkAsHiredModal on confirm
  const handleConfirmHire = useCallback(async (salary: number, startDate: string) => {
    if (!userProfile?.id || !candidateToHire || !jobRoleForHire) {
      console.error("Missing user, candidate, or job role data for hire. Aborting.");
      setDashboardError("Missing required information to record hire.");
      return;
    }

    setDashboardLoading(true); // Indicate that a background operation is happening

    try {
      // 1. Update the applied_jobs record to 'hired'
      const { error: updateError } = await supabase
        .from('applied_jobs')
        .update({ status: 'hired' })
        .eq('id', candidateToHire.id); // Use candidateToHire.id which is applied_job ID

      if (updateError) throw updateError;

      // 2. Insert a new record into the hires table
      const { error: insertError } = await supabase
        .from('hires')
        .insert({
          developer_id: candidateToHire.developer.user_id, // **THE CRITICAL FIX**
          job_id: jobRoleForHire.id,
          salary: salary,
          start_date: startDate,
          hire_date: new Date().toISOString().split('T')[0], // Current date as YYYY-MM-DD
          marked_by: userProfile.id,
        });

      if (insertError) throw insertError;

      setSuccess(`Successfully hired ${candidateToHire.developer.user?.name || candidateToHire.developer.github_handle || 'the developer'} for ${jobRoleForHire.title}!`);
      handleCloseMarkAsHiredModal(); // Close modal on success
      fetchDashboardData(); // Re-fetch all dashboard data to ensure consistency (especially hires list)

    } catch (error: any) {
      console.error("Error confirming hire:", error);
      setDashboardError(`Failed to record hire: ${error.message || 'Unknown error'}`);
    } finally {
      setDashboardLoading(false);
    }
  }, [userProfile?.id, candidateToHire, jobRoleForHire, fetchDashboardData, handleCloseMarkAsHiredModal]);


  // Callback for JobDetailView to use when a candidate is hired.
  // This function, when passed to JobDetailView, will signal JobDetailView
  // to update its local list of candidates (e.g., by filtering out the hired one).
  // In RecruiterDashboard, calling fetchDashboardData() within handleConfirmHire
  // already ensures the global state for 'hires' is refreshed.
  // This prop is used by JobDetailView to remove the candidate from its list after parent confirms hire.
  const handleCandidateHiredSuccessfully = useCallback((appliedJobId: string) => {
    // This is called by JobDetailView AFTER RecruiterDashboard's handleConfirmHire
    // has successfully updated the database and dismissed the modal.
    // JobDetailView's internal state for candidates should be updated based on this.
    // RecruiterDashboard's `fetchDashboardData` covers the global state update.
    console.log(`Candidate with applied_job_id ${appliedJobId} was successfully hired. JobDetailView should update its list.`);
  }, []);

  // --- Render Functions for Tabs ---
  const renderOverview = useCallback(() => (
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-3">
        <h2 className="text-xl font-black text-gray-900 mb-6">Recent Activity</h2>

        {/* Recent Hires */}
        <div>
          <h3 className="lg font-bold text-gray-900 mb-4">Recent Hires</h3>
          {hires.length > 0 ? (
            <div className="space-y-4">
              {hires.slice(0, 3).map(hire => (
                <div key={hire.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {hire.developer?.user?.name || 'Unknown Developer'}
                    </h4>
                    <div className="text-sm text-gray-600 mt-1">
                      Hired for {hire.job_role?.title || 'Unknown Position'} •
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
  ), [stats, hires]);

  const renderSearchDevelopers = useCallback(() => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Search Developers</h2>
      <DeveloperDirectory onSendMessage={handleMessageDeveloper} onViewDeveloperProfile={handleViewDeveloperProfile} />
    </div>
  ), [handleMessageDeveloper, handleViewDeveloperProfile]);

  const renderMessages = useCallback(() => {
    if (selectedThread) {
      return (
        <div className="space-y-6">
          <button
            onClick={handleCloseMessageThread}
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
            onClose={handleCloseMessageThread}
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
  }, [selectedThread, searchTerm, handleCloseMessageThread]);

  const renderHires = useCallback(() => (
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
      {dashboardLoading ? (
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
                          src={hire.developer?.user?.avatar_url || hire.developer?.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(hire.developer?.user?.name || hire.developer?.user?.id || 'U')}&background=random`}
                          alt={hire.developer?.user?.name || 'Developer'}
                          className="w-8 h-8 rounded-full object-cover mr-3"
                        />
                        <div className="text-sm font-semibold text-gray-900">
                          {hire.developer?.user?.name || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {hire.job_role?.title || 'Unknown'}
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
  ), [dashboardLoading, filteredHires, searchTerm]);

  // --- Global Loading and Error Handling ---
  if (authLoading || dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <span className="text-gray-600 font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  if (userProfile.role !== 'recruiter') {
    return <Navigate to="/dashboard" replace />;
  }

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
              refreshProfile().finally(() => setIsRefreshing(false));
            }}
            disabled={isRefreshing}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 inline ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Check Status' : 'Check Status'}
          </button>
        </div>
      </div>
    );
  }

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

        {dashboardError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-800 font-medium">{dashboardError}</p>
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
              {/* Profile Tab - Moved to second position */}
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
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'profile' && <RecruiterProfileForm />} {/* Moved Profile tab content */}
        {activeTab === 'my-jobs' && <JobsDashboard jobRoles={jobRoles} onViewApplicants={handleViewApplicants} onJobUpdate={handleJobUpdate} />}
        {activeTab === 'job-details' && selectedJobId && selectedJobRole && (
          <JobDetailView
            job={selectedJobRole}
            onBack={() => setActiveTab('my-jobs')}
            onMessageDeveloper={handleMessageDeveloper}
            onInitiateHire={handleInitiateHire} // NEW PROP
            onCandidateHiredSuccessfully={handleCandidateHiredSuccessfully} // NEW PROP
          />
        )}
        {activeTab === 'search-devs' && renderSearchDevelopers()}
        {activeTab === 'messages' && renderMessages()}
        {activeTab === 'hires' && renderHires()}
        {activeTab === 'notifications' && (
          <NotificationList
            notifications={notifications}
            onViewJobRole={handleViewNotificationJobRole}
            onViewMessage={(messageId) => {
              setActiveTab('messages');
            }}
          />
        )}
        {activeTab === 'tracker' && (
          <HiringPipeline
            onSendMessage={handleMessageDeveloper}
            onViewDeveloperProfile={handleViewDeveloperProfile}
            onInitiateHire={handleInitiateHire}
          />
        )}
      </div>

      {/* Developer Profile Modal - Centralized here */}
      {isDeveloperProfileModalOpen && selectedDeveloperForModal && (
        <DeveloperProfileModal
          developer={selectedDeveloperForModal}
          onClose={handleCloseDeveloperProfileModal}
          // The onSendMessage prop for DeveloperProfileModal is not defined in the provided code,
          // but if it exists, ensure it's passed here.
          // onSendMessage={handleMessageDeveloper} // Uncomment if DeveloperProfileModal expects this prop
        />
      )}

      {/* NEW: Mark As Hired Modal */}
      {isMarkAsHiredModalOpen && candidateToHire && jobRoleForHire && (
        <MarkAsHiredModal
          isOpen={isMarkAsHiredModalOpen}
          onClose={handleCloseMarkAsHiredModal}
          onConfirm={handleConfirmHire}
          candidate={candidateToHire}
          jobRole={jobRoleForHire}
        />
      )}
    </div>
  );
};

export default RecruiterDashboard;
