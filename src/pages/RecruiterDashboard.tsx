// src/pages/RecruiterDashboard.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
// MODIFIED: Import useLocation
import { Navigate, useLocation } from 'react-router-dom';
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
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { JobImportModal } from '../components/JobRoles/JobImportModal';
import { MarkAsHiredModal } from '../components/Hires/MarkAsHiredModal';
import { JobDetailView } from '../components/Jobs/JobDetailView';
import { RecruiterProfileForm } from '../components/Profile/RecruiterProfileForm';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SuccessModal } from '../components/SuccessModal';
import DeveloperDirectory from '../components/DeveloperDirectory';
import HiringPipeline from '../components/HiringPipeline';
import JobsDashboard from '../components/Jobs/JobsDashboard';
import { DeveloperProfileModal } from '../components/DeveloperProfileModal';

// === IMPORTING TYPES FROM src/types/index.ts ===
import {
    User,
    JobRole,
    Hire,
    Message,
    Developer,
    AppliedJob,
    Notification,
    Recruiter,
    Assignment,
    SavedCandidate,
} from '../types';

// Re-defining internal interfaces that are not exported from types/index.ts
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

interface MessageThreadInfo {
    otherUserId: string;
    otherUserName: string;
    otherUserRole: string;
    otherUserProfilePicUrl?: string;
    jobContext?: JobRole | null;
}

interface DashboardStats {
    totalJobs: number;
    activeJobs: number;
    applications: number;
    recentHires: number;
    unreadMessages: number;
}

const RecruiterDashboard: React.FC = () => {
    const { user, userProfile, authLoading, refreshProfile } = useAuth();
    const { tabCounts } = useNotifications();
    // ADDED: Initialize useLocation
    const location = useLocation();

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
    const [selectedDeveloperForModal, setSelectedDeveloperForModal] = useState<Developer | null>(null);

    // --- Mark As Hired Modal States ---
    const [isMarkAsHiredModalOpen, setIsMarkAsHiredModalOpen] = useState(false);
    const [assignmentToHire, setAssignmentToHire] = useState<SavedCandidate | null>(null);

    const isApproved = userProfile?.is_approved === true;
    const unreadNotifications = notifications.filter(n => !n.is_read).length;
    const [unreadJobApplicationCount, setUnreadJobApplicationCount] = useState(0);
    const [unreadTestCompletionCount, setUnreadTestCompletionCount] = useState(0);

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
                    recruiter:recruiters!fk_job_roles_recruiter_user_id (
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
                    assignment:assignments (
                        developer:developers!fk_assignments_developer (
                            user:users (*)
                        ),
                        job_role:job_roles!fk_assignments_job_role_id (*)
                    )
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

            // Fetch unread job application notifications count
            const { count: unreadJobApplicationCount, error: unreadJobApplicationCountError } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', currentUserId)
                .eq('is_read', false)
                .eq('type', 'job_application');

            if (unreadJobApplicationCountError) throw unreadJobApplicationCountError;
            setUnreadJobApplicationCount(unreadJobApplicationCount || 0);

            const { count: unreadTestCompletionCount, error: unreadTestCompletionCountError } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', currentUserId)
                .eq('is_read', false)
                .eq('type', 'test_completion');

            if (unreadTestCompletionCountError) throw unreadTestCompletionCountError;
            setUnreadTestCompletionCount(unreadTestCompletionCount || 0);

            // Calculate Dashboard Stats
            const totalJobs = jobRolesData?.length || 0;
            const activeJobs = (jobRolesData?.filter(job => job.is_active)?.length || 0);
            const applications = 0;
            const recentHires = hiresData?.length || 0;
            setStats({
                totalJobs,
                activeJobs,
                applications,
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
    
    // ADDED: useEffect to sync URL search params with the active tab state
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabFromUrl = params.get('tab');
        
        const validTabs = ['overview', 'my-jobs', 'tracker', 'search-devs', 'messages', 'hires', 'profile', 'job-details'];
  
        if (tabFromUrl && validTabs.includes(tabFromUrl) && activeTab !== tabFromUrl) {
          setActiveTab(tabFromUrl);
        }
      }, [location.search, activeTab]);

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
                        .select(`*, recruiter:recruiters!fk_job_roles_recruiter_user_id(company_name, user:users(name, avatar_url, profile_pic_url))`)
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
                        .select(`
                            *,
                            assignment:assignments (
                                developer:developers!fk_assignments_developer (
                                    user:users (*)
                                ),
                                job_role:job_roles!fk_assignments_job_role_id (*)
                            )
                        `)
                        .eq('marked_by', currentUserId)
                        .order('created_at', { ascending: false });
                    if (newHiresData) {
                        setHires(newHiresData);
                        setStats(prev => ({ ...prev, recentHires: newHiresData?.length || 0 }));
                    } else if (newHiresError) {
                        console.error("Error updating hires via subscription:", newHiresError);
                        setDashboardError("Failed to update hires via live data.");
                    }
                })
                .subscribe();

            // Messages Subscription
            const messagesSubscription = supabase
                .channel('messages_updates')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUserId}` }, async payload => {
                    const { count: newUnreadMessagesCount, error: newMessagesCountError } = await supabase
                        .from('messages')
                        .select('id', { count: 'exact', head: true })
                        .eq('receiver_id', currentUserId)
                        .eq('is_read', false);

                    if (newMessagesCountError) {
                        console.error("Error updating unread messages count via subscription:", newUnreadMessagesCount);
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
            const fullJobRole = jobRoles.find(job => job.id === jobRoleId);
            threadJobContext = fullJobRole || { id: jobRoleId, title: jobRoleTitle, description: '' /* add other necessary fields if not found */ };

            if (userProfile.recruiters?.company_name && (!threadJobContext.recruiter?.company_name)) {
                threadJobContext = {
                    ...threadJobContext,
                    recruiter: {
                        ...threadJobContext.recruiter,
                        company_name: userProfile.recruiters.company_name
                    }
                };
            }
        }

        let otherUserProfilePicUrl: string | undefined;
        if (jobRoleId) {
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
    }, [userProfile, jobRoles]);

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
        const developerName = hire.assignment?.developer?.user?.name?.toLowerCase() || '';
        const jobTitle = hire.assignment?.job_role?.title?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return developerName.includes(search) || jobTitle.includes(search);
    });

    const handleViewDeveloperProfile = useCallback((developer: Developer) => {
        setSelectedDeveloperForModal(developer);
        setIsDeveloperProfileModalOpen(true);
    }, []);

    const handleCloseDeveloperProfileModal = useCallback(() => {
        setIsDeveloperProfileModalOpen(false);
        setSelectedDeveloperForModal(null);
    }, []);

    const handleInitiateHire = useCallback((assignment: SavedCandidate) => {
        setAssignmentToHire(assignment);
        setIsMarkAsHiredModalOpen(true);
    }, []);

    const handleCloseMarkAsHiredModal = useCallback(() => {
        setIsMarkAsHiredModalOpen(false);
        setAssignmentToHire(null);
        setDashboardError(null);
        setSuccess(null);
    }, []);

    const handleHireSuccessInModal = useCallback(() => {
        setSuccess("Hire successfully recorded!");
        fetchDashboardData();
        handleCloseMarkAsHiredModal();
    }, [fetchDashboardData, handleCloseMarkAsHiredModal]);

    const handleCandidateHiredSuccessfully = useCallback((appliedJobId: string) => {
        console.log(`Candidate with applied_job_id ${appliedJobId} was successfully hired.`);
        fetchDashboardData();
    }, [fetchDashboardData]);

    const renderOverview = useCallback(() => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-3">
                <h2 className="text-xl font-black text-gray-900 mb-6">Recent Activity</h2>
                <div>
                    <h3 className="lg font-bold text-gray-900 mb-4">Recent Hires</h3>
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
    return (
        <div className="flex flex-col md:flex-row gap-6 flex-grow">
            {/* Left Pane */}
            <div className="md:w-1/3 flex flex-col">
              <MessageList 
                onThreadSelect={setSelectedThread} 
                searchTerm={searchTerm} 
              />
            </div>

            {/* Right Pane */}
            <div className="md:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                {selectedThread ? (
                    <MessageThread
                        otherUserId={selectedThread.otherUserId}
                        otherUserName={selectedThread.otherUserName}
                        otherUserRole={selectedThread.otherUserRole}
                        otherUserProfilePicUrl={selectedThread.otherUserProfilePicUrl}
                        jobContext={selectedThread.jobContext}
                        onBack={() => setSelectedThread(null)}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                        <MessageSquare size={48} className="mb-4 text-gray-300" />
                        <h3 className="text-xl font-semibold">Select a conversation</h3>
                        <p className="text-sm">Choose a conversation from the list to view messages.</p>
                    </div>
                )}
            </div>
        </div>
    );
}, [selectedThread, searchTerm]);

    const renderHires = useCallback(() => (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900">Successful Hires</h2>
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
                                                    src={hire.assignment?.developer?.user?.avatar_url || hire.assignment?.developer?.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(hire.assignment?.developer?.user?.name || 'U')}&background=random`}
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
                </div>
            )}
        </div>
    ), [dashboardLoading, filteredHires, searchTerm]);

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
                        {isRefreshing ? 'Checking Status' : 'Check Status'}
                    </button>
                </div>
            </div>
        );
    }

    const selectedJobRole = jobRoles.find(job => job.id === selectedJobId);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 mb-2">
                        Welcome, {userProfile.name}!
                    </h1>
                    <p className="text-gray-600">Manage your job listings and find the perfect developers for your team.</p>
                </div>

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
                                {tabCounts.jobs > 0 && (
                                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {tabCounts.jobs}
                                    </span>
                                )}
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
                                {tabCounts.pipeline > 0 && (
                                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {tabCounts.pipeline}
                                    </span>
                                )}
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
                                {tabCounts.messages > 0 && (
                                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {tabCounts.messages}
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

                <div className="mt-8 flex-grow flex flex-col">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'profile' && <RecruiterProfileForm />}
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
                    {activeTab === 'tracker' && (
                        <HiringPipeline
                            onSendMessage={handleMessageDeveloper}
                            onViewDeveloperProfile={handleViewDeveloperProfile}
                            onInitiateHire={handleInitiateHire}
                        />
                    )}
                </div>
            </div>

            {isDeveloperProfileModalOpen && selectedDeveloperForModal && (
                <DeveloperProfileModal
                    developer={selectedDeveloperForModal}
                    onClose={handleCloseDeveloperProfileModal}
                />
            )}

            {isMarkAsHiredModalOpen && assignmentToHire && (
                <MarkAsHiredModal
                    isOpen={isMarkAsHiredModalOpen}
                    onClose={handleCloseMarkAsHiredModal}
                    assignment={assignmentToHire}
                    onSuccess={handleHireSuccessInModal}
                    onCancel={handleCloseMarkAsHiredModal}
                />
            )}
        </div>
    );
};

export default RecruiterDashboard;
