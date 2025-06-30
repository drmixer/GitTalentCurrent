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
  Filter,
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
import { DeveloperList } from '../components/DeveloperList';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { JobImportModal } from '../components/JobRoles/JobImportModal';
import { MarkAsHiredModal } from '../components/Hires/MarkAsHiredModal';
import { JobRole, Hire, Message } from '../types';

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
  const { user, userProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'my-jobs' | 'search-devs' | 'messages' | 'hires'>('overview');
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    featuredJobs: 0,
    totalMessages: 0,
    unreadMessages: 0,
    totalHires: 0,
    totalRevenue: 0
  });
  
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [hires, setHires] = useState<(Hire & { assignment: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showJobForm, setShowJobForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRole | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [jobInterestCounts, setJobInterestCounts] = useState<{[jobId: string]: number}>({});

  // Check if the user is approved
  const isApproved = userProfile?.is_approved === true;

  console.log('RecruiterDashboard render - authLoading:', authLoading, 'userProfile:', userProfile);

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
        fetchStats(),
        fetchJobRoles(),
        fetchHires(),
        fetchJobInterestCounts()
      ]);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
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

  const fetchJobRoles = async () => {
    try {
      if (!userProfile?.id) return;
      
      const { data, error } = await supabase
        .from('job_roles')
        .select('*')
        .eq('recruiter_id', userProfile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setJobRoles(data || []);
    } catch (error: any) {
      console.error('Error fetching job roles:', error);
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

  const fetchJobInterestCounts = async () => {
    try {
      if (!userProfile?.id) return;
      
      // Get all job IDs
      const jobIds = jobRoles.map(job => job.id);
      if (jobIds.length === 0) return;
      
      // For each job, count messages that mention it
      const counts: {[jobId: string]: number} = {};
      
      for (const jobId of jobIds) {
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', userProfile.id)
          .eq('job_role_id', jobId);
        
        if (error) throw error;
        counts[jobId] = count || 0;
      }
      
      setJobInterestCounts(counts);
    } catch (error: any) {
      console.error('Error fetching job interest counts:', error);
    }
  };

  const handleJobSubmit = async (jobData: Partial<JobRole>) => {
    try {
      setError('');
      
      if (editingJob) {
        // Update existing job
        const { error } = await supabase
          .from('job_roles')
          .update(jobData)
          .eq('id', editingJob.id);
        
        if (error) throw error;
        
        setSuccess('Job updated successfully!');
      } else {
        // Create new job
        const { error } = await supabase
          .from('job_roles')
          .insert([{ ...jobData, recruiter_id: userProfile?.id }]);
        
        if (error) throw error;
        
        setSuccess('Job created successfully!');
      }
      
      // Refresh data
      await fetchJobRoles();
      await fetchStats();
      
      // Reset form state
      setShowJobForm(false);
      setEditingJob(null);
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Error saving job:', error);
      setError(error.message || 'Failed to save job');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
    
    try {
      setError('');
      
      const { error } = await supabase
        .from('job_roles')
        .delete()
        .eq('id', jobId);
      
      if (error) throw error;
      
      setSuccess('Job deleted successfully!');
      
      // Refresh data
      await fetchJobRoles();
      await fetchStats();
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Error deleting job:', error);
      setError(error.message || 'Failed to delete job');
    }
  };

  const handleToggleJobStatus = async (jobId: string, isActive: boolean) => {
    try {
      setError('');
      
      const { error } = await supabase
        .from('job_roles')
        .update({ is_active: !isActive })
        .eq('id', jobId);
      
      if (error) throw error;
      
      setSuccess(`Job ${isActive ? 'paused' : 'activated'} successfully!`);
      
      // Refresh data
      await fetchJobRoles();
      await fetchStats();
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Error updating job status:', error);
      setError(error.message || 'Failed to update job status');
    }
  };

  const handleToggleFeatureJob = async (jobId: string, isFeatured: boolean) => {
    try {
      setError('');
      
      const { error } = await supabase
        .from('job_roles')
        .update({ is_featured: !isFeatured })
        .eq('id', jobId);
      
      if (error) throw error;
      
      setSuccess(`Job ${isFeatured ? 'unfeatured' : 'featured'} successfully!`);
      
      // Refresh data
      await fetchJobRoles();
      await fetchStats();
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Error featuring job:', error);
      setError(error.message || 'Failed to feature job');
    }
  };

  const handleViewJobDetails = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowJobDetails(true);
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

  // Filter jobs based on search term
  const filteredJobs = jobRoles.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.tech_stack.some(tech => tech.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter hires based on search term
  const filteredHires = hires.filter(hire => 
    hire.assignment?.developer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hire.assignment?.job_role?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <Clock className="h-10 w-10 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Pending Approval</h1>
          <p className="text-gray-600 mb-6">
            Your recruiter account is currently pending approval by our admin team. 
            You'll receive an email notification once your account is approved.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This usually takes 1-2 business days. If you have any questions, 
            please contact support@gittalent.dev
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Check Status
          </button>
        </div>
      </div>
    );
  }

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
                    ? 'border-blue-500 text-blue-600'
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
                    ? 'border-blue-500 text-blue-600'
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
                    ? 'border-blue-500 text-blue-600'
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
                    ? 'border-blue-500 text-blue-600'
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
                onClick={() => setActiveTab('hires')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'hires'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-5 h-5 mr-2" />
                Hires
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'my-jobs' && (showJobDetails && selectedJobId ? (
          <div className="space-y-6">
            <button
              onClick={() => {
                setShowJobDetails(false);
                setSelectedJobId(null);
              }}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Job Listings
            </button>
            
            <JobRoleDetails
              jobRoleId={selectedJobId}
              onEdit={() => {
                const job = jobRoles.find(j => j.id === selectedJobId);
                if (job) {
                  setEditingJob(job);
                  setShowJobForm(true);
                  setShowJobDetails(false);
                }
              }}
              onSendMessage={handleMessageDeveloper}
              onViewDeveloper={(developerId) => {
                handleMessageDeveloper(
                  developerId,
                  "Developer", // This will be updated when the message thread is created
                  selectedJobId,
                  jobRoles.find(j => j.id === selectedJobId)?.title || "Job"
                );
              }}
            />
          </div>
        ) : renderMyJobListings())}
        {activeTab === 'search-devs' && renderSearchDevelopers()}
        {activeTab === 'messages' && renderMessages()}
        {activeTab === 'hires' && renderHires()}

        {/* Job Form Modal */}
        {showJobForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <JobRoleForm
                jobRole={editingJob}
                onSuccess={handleJobSubmit}
                onCancel={() => {
                  setShowJobForm(false);
                  setEditingJob(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Job Import Modal */}
        {showImportModal && (
          <JobImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              fetchJobRoles();
              fetchStats();
            }}
          />
        )}
      </div>
    </div>
  );
};