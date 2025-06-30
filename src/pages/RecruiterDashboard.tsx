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
  RefreshCw
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

    setTimeout(() => {
      setSuccess('');
    }, 3000);
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

  console.log('RecruiterDashboard - Rendering main UI, activeTab:', activeTab);

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalJobs}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Total Job Listings</div>
          <div className="text-xs text-blue-600 font-medium">
            {stats.activeJobs} active, {stats.featuredJobs} featured
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalMessages}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Total Messages</div>
          <div className="text-xs text-purple-600 font-medium">
            {stats.unreadMessages} unread messages
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalHires}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Successful Hires</div>
          <div className="text-xs text-emerald-600 font-medium">
            Pay-per-hire model
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">${stats.totalRevenue.toLocaleString()}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Platform Fees</div>
          <div className="text-xs text-orange-600 font-medium">
            15% of first-year salary
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => {
              setEditingJob(null);
              setShowJobForm(true);
            }}
            className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <Briefcase className="w-8 h-8 text-blue-600 mb-3" />
            <span className="font-semibold text-blue-800">Post New Job</span>
          </button>
          
          <button
            onClick={() => setShowImportModal(true)}
            className="flex flex-col items-center justify-center p-6 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors"
          >
            <Plus className="w-8 h-8 text-purple-600 mb-3" />
            <span className="font-semibold text-purple-800">Import Jobs</span>
          </button>
          
          <button
            onClick={() => setActiveTab('search-devs')}
            className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            <Search className="w-8 h-8 text-emerald-600 mb-3" />
            <span className="font-semibold text-emerald-800">Search Developers</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Job Listings */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900">Recent Job Listings</h3>
            <button
              onClick={() => setActiveTab('my-jobs')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All
            </button>
          </div>
          
          {jobRoles.length > 0 ? (
            <div className="space-y-4">
              {jobRoles.slice(0, 3).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-gray-900">{job.title}</h4>
                      {job.is_featured && <Star className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <p className="text-sm text-gray-600">{job.location} • {job.job_type}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      job.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {job.is_active ? 'Active' : 'Paused'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {jobInterestCounts[job.id] || 0} interests
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No job listings yet</p>
              <button
                onClick={() => {
                  setEditingJob(null);
                  setShowJobForm(true);
                }}
                className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
              >
                Create Your First Job
              </button>
            </div>
          )}
        </div>
        
        {/* Recent Hires */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900">Recent Hires</h3>
            <button
              onClick={() => setActiveTab('hires')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All
            </button>
          </div>
          
          {hires.length > 0 ? (
            <div className="space-y-4">
              {hires.slice(0, 3).map((hire) => (
                <div key={hire.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <h4 className="font-semibold text-gray-900">{hire.assignment?.developer?.name || 'Unknown Developer'}</h4>
                    <p className="text-sm text-gray-600">{hire.assignment?.job_role?.title || 'Unknown Position'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${hire.salary.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{new Date(hire.hire_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hires recorded yet</p>
              <p className="text-xs text-gray-400 mt-2">
                Hires will appear here once you've successfully hired developers
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMyJobListings = () => (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-black text-gray-900">My Job Listings</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={() => {
              setEditingJob(null);
              setShowJobForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post New Job
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Import Jobs
          </button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search job listings..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}

      {/* Job listings */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
          <span className="text-gray-600 font-medium">Loading job listings...</span>
        </div>
      ) : filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                    {job.is_featured && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                        Featured
                      </span>
                    )}
                  </div>
                  
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
                    {job.tech_stack.slice(0, 4).map((tech, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
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
                
                <div className="flex flex-col items-end">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                    job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {job.is_active ? 'Active' : 'Paused'}
                  </span>
                  
                    {jobInterestCounts[job.id] || 0} interests
                    <MessageSquare className="w-4 h-4 mr-1" />
                    <span>{jobInterestCounts[job.id] || 0} interests</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleViewJobDetails(job.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                >
                  <Eye className="w-4 h-4 mr-1 inline" />
                  View Details
                  <p className="text-sm text-gray-600">{job.location} • {job.job_type}</p>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleFeatureJob(job.id, !!job.is_featured)}
                    className={`p-2 rounded-lg ${
                      job.is_featured 
                        ? 'text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50' 
                        : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                    }`}
                    title={job.is_featured ? "Unfeature Job" : "Feature Job"}
                  >
                    <Star className="w-5 h-5" fill={job.is_featured ? "currentColor" : "none"} />
                  </button>
                  
                  <button
                    onClick={() => {
                      setEditingJob(job);
                      setShowJobForm(true);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit Job"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={() => handleToggleJobStatus(job.id, job.is_active)}
                    className={`p-2 rounded-lg ${
                      job.is_active 
                        ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' 
                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                    }`}
                    title={job.is_active ? "Pause Job" : "Activate Job"}
                  >
                    {job.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete Job"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Job Listings Found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? "No jobs match your search criteria" : "You haven't created any job listings yet"}
          </p>
          <button
            onClick={() => {
              setEditingJob(null);
              setShowJobForm(true);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Create Your First Job
          </button>
        </div>
      )}
    </div>
  );

  const renderSearchDevelopers = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Search Developers</h2>
      <p className="text-gray-600">
        Browse all available developers and find the perfect match for your job openings.
      </p>
      
      <DeveloperList 
        fetchType="all"
        onSendMessage={handleMessageDeveloper}
      />
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
            onBack={() => setSelectedThread(null)}
          />
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-gray-900">Messages</h2>
        <p className="text-gray-600">
          Manage your conversations with developers and track your hiring pipeline.
        </p>
        
        <MessageList
          onThreadSelect={setSelectedThread}
        />
      </div>
    );
  };

  const renderHires = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Successful Hires</h2>
      <p className="text-gray-600">
        Track your successful hires and manage platform fees.
      </p>
      
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHires.map((hire) => (
                  <tr key={hire.id} className="hover:bg-gray-50 transition-colors">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Hires Found</h3>
          <p className="text-gray-600">
            {searchTerm ? "No hires match your search criteria" : "You haven't recorded any successful hires yet"}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            When you successfully hire a developer, mark them as hired to track your platform fees.
          </p>
        </div>
      )}
    </div>
  );

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