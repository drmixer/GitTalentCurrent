import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import RecruiterProfileForm from '../components/RecruiterProfileForm';
import JobsDashboard from '../components/JobsDashboard';
import DeveloperDirectory from '../components/DeveloperDirectory';
import MessageList from '../components/MessageList';
import MessageThread from '../components/MessageThread';
import DeveloperProfileModal from '../components/DeveloperProfileModal';
import NotificationList from '../components/NotificationList';
import JobDetailView from '../components/JobDetailView';
import MarkAsHiredModal from '../components/MarkAsHiredModal';
import HiringPipeline from '../components/HiringPipeline';
import {
    Briefcase,
    MessageSquare,
    Users,
    Search,
    TrendingUp,
    Bell,
    Loader,
    AlertCircle,
    CheckCircle,
    Clock,
    RefreshCw,
    DollarSign,
    ArrowLeft // Correctly imported, as present in your original full file
} from 'lucide-react';

// Define the type for the assignment
interface FetchedAssignment {
    id: string;
    job_id: string;
    developer_id: string;
    recruiter_id: string;
    status: string;
    created_at: string;
    job_role: {
        id: string;
        title: string;
        description: string;
        salary_range_start: number;
        salary_range_end: number;
        recruiter_id: string;
        created_at: string;
    } | null;
    developer: {
        id: string;
        user_id: string;
        bio: string;
        skills: string[];
        experience: number;
        education: string;
        portfolio_url: string | null;
        linkedin_url: string | null;
        github_url: string | null;
        website_url: string | null;
        user: {
            id: string;
            name: string;
            email: string;
            avatar_url: string | null;
            profile_pic_url: string | null;
        } | null;
    } | null;
}

interface Hire {
    id: string;
    assignment_id: string;
    salary: number;
    hire_date: string;
    start_date: string | null;
    created_at: string;
    assignment: FetchedAssignment | null;
}

const RecruiterDashboard: React.FC = () => {
    const { user, userProfile, authLoading, refreshProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<string>('overview');
    const [dashboardLoading, setDashboardLoading] = useState<boolean>(true);
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [jobRoles, setJobRoles] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [hires, setHires] = useState<Hire[]>([]);
    const [stats, setStats] = useState({
        totalJobs: 0,
        activeJobs: 0,
        unreadMessages: 0,
    });
    const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [selectedThread, setSelectedThread] = useState<any | null>(null);
    const [selectedDeveloperForModal, setSelectedDeveloperForModal] = useState<any | null>(null);
    const [isDeveloperProfileModalOpen, setIsDeveloperProfileModalOpen] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [isMarkAsHiredModalOpen, setIsMarkAsHiredModalOpen] = useState<boolean>(false);
    const [assignmentToHire, setAssignmentToHire] = useState<FetchedAssignment | null>(null);

    const isApproved = userProfile?.is_approved === true;

    const fetchDashboardData = useCallback(async () => {
        if (!userProfile?.id) return;

        setDashboardLoading(true);
        setDashboardError(null);
        setSuccess(null);

        try {
            const { data: jobRolesData, error: jobRolesError } = await supabase
                .from('job_roles')
                .select('*')
                .eq('recruiter_id', userProfile.id);

            if (jobRolesError) throw jobRolesError;
            setJobRoles(jobRolesData || []);

            // Fetch applications for recruiter's jobs
            const { data: applicationsData, error: applicationsError } = await supabase
                .from('job_applications')
                .select(`
                    *,
                    developer:developer_id (
                        *,
                        user:user_id (id, name, email, avatar_url, profile_pic_url)
                    ),
                    job_role:job_id (
                        id, title, recruiter_id
                    )
                `)
                .in('job_id', jobRolesData?.map(job => job.id) || []);

            if (applicationsError) throw applicationsError;
            setApplications(applicationsData || []);

            // Fetch messages
            const { data: messagesData, error: messagesError } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:sender_id (id, name, email, role, avatar_url, profile_pic_url),
                    receiver:receiver_id (id, name, email, role, avatar_url, profile_pic_url)
                `)
                .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`);

            if (messagesError) throw messagesError;
            setMessages(messagesData || []);

            // Fetch notifications
            const { data: notificationsData, error: notificationsError } = await supabase
                .from('notifications')
                .select(`
                    *,
                    job_role:job_role_id (id, title)
                `)
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (notificationsError) throw notificationsError;
            setNotifications(notificationsData || []);
            setUnreadNotifications(notificationsData?.filter(n => !n.is_read).length || 0);

            // Fetch hires for the recruiter
            const { data: hiresData, error: hiresError } = await supabase
                .from('hires')
                .select(`
                    *,
                    assignment:assignment_id (
                        *,
                        developer:developer_id (
                            *,
                            user:user_id (id, name, email, avatar_url, profile_pic_url)
                        ),
                        job_role:job_id (id, title)
                    )
                `)
                .in('assignment_id', applicationsData?.filter(app => app.status === 'hired').map(app => app.id) || []);

            if (hiresError) throw hiresError;
            setHires(hiresData || []);

            // Calculate stats
            const totalJobs = jobRolesData?.length || 0;
            const activeJobs = jobRolesData?.filter((job: any) => job.is_active).length || 0;
            const unreadMessages = messagesData?.filter((msg: any) => msg.receiver_id === user?.id && !msg.is_read).length || 0;

            setStats({
                totalJobs,
                activeJobs,
                unreadMessages,
            });

        } catch (error: any) {
            console.error("Error fetching dashboard data:", error);
            setDashboardError(`Failed to load dashboard data: ${error.message || 'Unknown error'}`);
        } finally {
            setDashboardLoading(false);
        }
    }, [userProfile?.id, user?.id]); // DEPENDENCIES FOR fetchDashboardData useCallback

    // THIS IS THE useEffect THAT WAS CAUSING THE CRASH
    // 'fetchDashboardData' was removed from this dependency array to fix the infinite re-render
    useEffect(() => {
        if (userProfile?.id && isApproved) {
            fetchDashboardData();
        }
    }, [userProfile?.id, isApproved]); // REVERTED DEPENDENCIES (Original state)

    const handleViewApplicants = useCallback((jobId: string) => {
        setSelectedJobId(jobId);
        setActiveTab('job-details');
    }, []);

    const handleJobUpdate = useCallback(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleMessageDeveloper = useCallback((developerId: string, developerName: string, developerProfilePicUrl: string | null, jobContext: any) => {
        setSelectedThread({
            otherUserId: developerId,
            otherUserName: developerName,
            otherUserRole: 'developer',
            otherUserProfilePicUrl: developerProfilePicUrl,
            jobContext: jobContext
        });
        setActiveTab('messages');
    }, []);

    const handleCloseMessageThread = useCallback(() => {
        setSelectedThread(null);
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleViewDeveloperProfile = useCallback((developer: any) => {
        setSelectedDeveloperForModal(developer);
        setIsDeveloperProfileModalOpen(true);
    }, []);

    const handleCloseDeveloperProfileModal = useCallback(() => {
        setIsDeveloperProfileModalOpen(false);
        setSelectedDeveloperForModal(null);
    }, []);

    const handleViewNotificationJobRole = useCallback((jobRoleId: string) => {
        setSelectedJobId(jobRoleId);
        setActiveTab('job-details');
    }, []);

    const handleInitiateHire = useCallback(async (jobApplicationId: string, jobId: string, developerId: string) => {
        setDashboardLoading(true);
        setDashboardError(null);

        try {
            let targetAssignment: FetchedAssignment | null = null;

            // 1. Check if an assignment already exists for this jobApplicationId
            const { data: existingAssignment, error: fetchError } = await supabase
                .from('assignments')
                .select(`
                    *,
                    job_role:job_id (id, title, description, salary_range_start, salary_range_end, recruiter_id, created_at),
                    developer:developer_id (
                        *,
                        user:user_id (id, name, email, avatar_url, profile_pic_url)
                    )
                `)
                .eq('id', jobApplicationId) // Assuming jobApplicationId is the assignment ID
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means "no rows found"
                throw fetchError;
            }

            if (existingAssignment) {
                console.log("Found existing assignment:", existingAssignment);
                targetAssignment = existingAssignment as FetchedAssignment;
            } else {
                // 2. If no assignment, create a new one
                if (!userProfile?.id) {
                    throw new Error("Recruiter profile not loaded. Cannot create assignment.");
                }

                const { data: newAssignment, error: createError } = await supabase
                    .from('assignments')
                    .insert({
                        id: jobApplicationId,
                        job_id: jobId,
                        developer_id: developerId,
                        recruiter_id: userProfile.id,
                        status: 'hired',
                    })
                    .select(`
                        *,
                        job_role:job_id (id, title, description, salary_range_start, salary_range_end, recruiter_id, created_at),
                        developer:developer_id (
                            *,
                            user:user_id (id, name, email, avatar_url, profile_pic_url)
                        )
                    `)
                    .single();

                if (createError) throw createError;
                targetAssignment = newAssignment as FetchedAssignment;
                console.log("Created new assignment:", newAssignment);
            }

            if (targetAssignment) {
                setAssignmentToHire(targetAssignment);
                setIsMarkAsHiredModalOpen(true);
            } else {
                setDashboardError("Could not prepare assignment data for hiring. No assignment found or created.");
            }

        } catch (error: any) {
            console.error("Error initiating hire process:", error);
            setDashboardError(`Failed to initiate hire: ${error.message || 'Unknown error'}`);
        } finally {
            setDashboardLoading(false);
        }
    }, [userProfile?.id]);

    const handleHireSuccessInModal = useCallback(() => {
        setSuccess("Hire successfully recorded!");
        fetchDashboardData();
        handleCloseMarkAsHiredModal();
    }, [fetchDashboardData, handleCloseMarkAsHiredModal]);

    const handleCloseMarkAsHiredModal = useCallback(() => {
        setIsMarkAsHiredModalOpen(false);
        setAssignmentToHire(null);
        setDashboardError(null);
        setSuccess(null);
    }, []);

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

    const filteredHires = useMemo(() => {
        if (!searchTerm) {
            return hires;
        }
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        return hires.filter(hire =>
            (hire.assignment?.developer?.user?.name?.toLowerCase().includes(lowercasedSearchTerm)) ||
            (hire.assignment?.job_role?.title?.toLowerCase().includes(lowercasedSearchTerm)) ||
            (hire.salary.toLocaleString().includes(lowercasedSearchTerm))
        );
    }, [hires, searchTerm]);


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

                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'profile' && <RecruiterProfileForm />}
                {activeTab === 'my-jobs' && <JobsDashboard jobRoles={jobRoles} onViewApplicants={handleViewApplicants} onJobUpdate={handleJobUpdate} />}
                {activeTab === 'job-details' && selectedJobId && selectedJobRole && (
                    <JobDetailView
                        job={selectedJobRole}
                        onBack={() => setActiveTab('my-jobs')}
                        onMessageDeveloper={handleMessageDeveloper}
                        onInitiateHire={handleInitiateHire}
                        onCandidateHiredSuccessfully={handleCandidateHiredSuccessfully}
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
