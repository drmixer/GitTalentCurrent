import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Navigate, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Briefcase, 
  Building,
  Code,
  CheckCircle, 
  XCircle, 
  Loader, 
  AlertCircle,
  Search,
  Filter,
  Clock,
  Calendar,
  Mail,
  Shield,
  Star,
  DollarSign,
  Eye,
  Trash2,
  Edit,
  MessageSquare,
  TrendingUp,
  ArrowLeft,
  ExternalLink,
  BarChart,
  PieChart,
  User,
  X
} from 'lucide-react';
import { Developer, JobRole, Hire, User as UserType } from '../types';
import { DeveloperProfileDetails } from '../components/Profile/DeveloperProfileDetails';
import { RecruiterProfileDetails } from '../components/Profile/RecruiterProfileDetails';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import TestInsert from '../components/Assignments/TestInsert';

interface PendingRecruiter {
  user_id: string;
  email: string;
  name: string;
  company_name: string;
  created_at: string;
}

export const AdminDashboard = () => {
  const { user, userProfile, loading: authLoading, updateUserApprovalStatus } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [developers, setDevelopers] = useState<(Developer & { user: any })[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [hires, setHires] = useState<(Hire & { assignment: any })[]>([]);
  const [pendingRecruiters, setPendingRecruiters] = useState<PendingRecruiter[]>([]);
  const [approvedRecruiters, setApprovedRecruiters] = useState<PendingRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [recruiterCount, setRecruiterCount] = useState(0);
  const [developerCount, setDeveloperCount] = useState(0);
  const [hireCount, setHireCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [selectedDeveloperForDetails, setSelectedDeveloperForDetails] = useState<Developer | null>(null);
  const [showDeveloperDetailsModal, setShowDeveloperDetailsModal] = useState(false);
  const [selectedRecruiterForDetails, setSelectedRecruiterForDetails] = useState<string | null>(null);
  const [showRecruiterDetailsModal, setShowRecruiterDetailsModal] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<string | null>(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchAdminData();
    }
  }, [userProfile]);

  useEffect(() => {
    // Fetch specific data based on active tab
    if (userProfile?.role === 'admin') {
      if (activeTab === 'recruiters') {
        fetchRecruiters();
      } else if (activeTab === 'developers') {
        fetchDevelopers();
      } else if (activeTab === 'jobs') {
        fetchJobs();
      } else if (activeTab === 'hires') {
        fetchHires();
      }
    }
  }, [activeTab, userProfile]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch counts for overview
      const { count: recruitersCount, error: recruitersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'recruiter');

      if (recruitersError) throw recruitersError;
      setRecruiterCount(recruitersCount || 0);

      const { count: developersCount, error: developersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'developer');

      if (developersError) throw developersError;
      setDeveloperCount(developersCount || 0);

      const { count: hiresCount, error: hiresError } = await supabase
        .from('hires')
        .select('*', { count: 'exact', head: true });

      if (hiresError) throw hiresError;
      setHireCount(hiresCount || 0);

      // Calculate total revenue (15% of all hire salaries)
      const { data: hiresData, error: hiresDataError } = await supabase
        .from('hires')
        .select('salary');

      if (hiresDataError) throw hiresDataError;
      
      const revenue = (hiresData || []).reduce((sum, hire) => sum + Math.round(hire.salary * 0.15), 0);
      setTotalRevenue(revenue);

      // Fetch initial data for the default tab
      if (activeTab === 'recruiters') {
        fetchRecruiters();
      } else if (activeTab === 'developers') {
        fetchDevelopers();
      } else if (activeTab === 'jobs') {
        fetchJobs();
      } else if (activeTab === 'hires') {
        fetchHires();
      }

    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      setError(error.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecruiters = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch pending recruiters
      const { data: pendingData, error: pendingError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          created_at,
          recruiter:recruiters!user_id(company_name)
        `)
        .eq('role', 'recruiter')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Fetch approved recruiters
      const { data: approvedData, error: approvedError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          created_at,
          recruiter:recruiters!user_id(company_name)
        `)
        .eq('role', 'recruiter')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (approvedError) throw approvedError;

      // Format the data
      const formattedPending = pendingData?.map(item => ({
        user_id: item.id,
        email: item.email,
        name: item.name,
        company_name: item.recruiter.company_name,
        created_at: item.created_at
      })) || [];

      const formattedApproved = approvedData?.map(item => ({
        user_id: item.id,
        email: item.email,
        name: item.name,
        company_name: item.recruiter.company_name,
        created_at: item.created_at
      })) || [];

      setPendingRecruiters(formattedPending);
      setApprovedRecruiters(formattedApproved);
    } catch (error: any) {
      console.error('Error fetching recruiters:', error);
      setError(error.message || 'Failed to load recruiters');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevelopers = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevelopers(data || []);
    } catch (error: any) {
      console.error('Error fetching developers:', error);
      setError(error.message || 'Failed to load developers');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobRoles(data || []);
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      setError(error.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchHires = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('hires')
        .select(`
          *,
          assignment:assignments(
            *,
            developer:users!assignments_developer_id_fkey(*),
            job_role:job_roles(*),
            recruiter:users!assignments_recruiter_id_fkey(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHires(data || []);
    } catch (error: any) {
      console.error('Error fetching hires:', error);
      setError(error.message || 'Failed to load hires');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDeveloperDetails = (developer: Developer) => {
    setSelectedDeveloperForDetails(developer);
    setShowDeveloperDetailsModal(true);
  };

  const handleViewRecruiterDetails = (recruiterId: string) => {
    setSelectedRecruiterForDetails(recruiterId);
    setShowRecruiterDetailsModal(true);
  };

  const handleViewJobDetails = (jobId: string) => {
    setSelectedJobForDetails(jobId);
    setShowJobDetailsModal(true);
  };

  const handleFeatureJob = async (jobId: string, isFeatured: boolean) => {
    try {
      setError('');
      
      const { error } = await supabase
        .from('job_roles')
        .update({ is_featured: !isFeatured })
        .eq('id', jobId);
      
      if (error) throw error;
      
      // Refresh jobs
      fetchJobs();
      
      setSuccessMessage(`Job ${isFeatured ? 'unfeatured' : 'featured'} successfully`);
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('Error featuring job:', error);
      setError(error.message || 'Failed to feature job');
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
      
      setSuccessMessage('Job deleted successfully!');
      fetchJobs();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('Error deleting job:', error);
      setError(error.message || 'Failed to delete job');
    }
  };

  const handleApprove = async (userId: string) => {
    console.log("handleApprove called with userId:", userId);
    setProcessingIds(prev => [...prev, userId]);
    setError('');
    try {
      const success = await updateUserApprovalStatus(userId, true);
      
      if (success) {
        setSuccessMessage('Recruiter approved successfully');
        // Update local state immediately for better UX
        const approvedRecruiter = pendingRecruiters.find(r => r.user_id === userId);
        if (approvedRecruiter) {
          setPendingRecruiters(prev => prev.filter(r => r.user_id !== userId));
          setApprovedRecruiters(prev => [approvedRecruiter, ...prev]);
        }
        
        // Optional: refresh from DB to ensure consistency
        // fetchRecruiters();

        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        // The error is logged in the context, but we can set a UI error here
        setError('Failed to approve recruiter. Please check the logs.');
      }
    } catch (error: any) {
      console.error('Error approving recruiter:', error);
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== userId));
    }
  };

  const handleReject = async (userId: string) => {
    setProcessingIds(prev => [...prev, userId]);
    setError('');
    try {
      // For now, we are just deleting the user record upon rejection.
      // A "soft delete" or a "rejected" status might be better in a real app.
      const { error: deleteError } = await supabase.from('users').delete().eq('id', userId);

      if (deleteError) {
        throw deleteError;
      }

      setSuccessMessage('Recruiter rejected and removed successfully');
      setPendingRecruiters(prev => prev.filter(r => r.user_id !== userId));

      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      console.error('Error rejecting recruiter:', error);
      setError(error.message || 'Failed to reject recruiter. Please check logs.');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== userId));
    }
  };

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{recruiterCount}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Total Recruiters</div>
          <div className="text-xs text-emerald-600 font-medium">
            {pendingRecruiters.length} pending approval
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Code className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{developerCount}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Total Developers</div>
          <div className="text-xs text-emerald-600 font-medium">Active talent pool</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{jobRoles.length}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Active Job Listings</div>
          <div className="text-xs text-emerald-600 font-medium">
            {jobRoles.filter(job => job.is_featured).length} featured jobs
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{hireCount}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Successful Hires</div>
          <div className="text-xs text-emerald-600 font-medium">${totalRevenue.toLocaleString()} in revenue</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <button
            onClick={() => setActiveTab('recruiters')}
            className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <Building className="w-8 h-8 text-blue-600 mb-3" />
            <span className="font-semibold text-gray-900">Manage Recruiters</span>
            <span className="text-sm text-gray-600 mt-1">Approve and monitor recruiters</span>
          </button>
          
          <button
            onClick={() => setActiveTab('developers')}
            className="flex flex-col items-center justify-center p-6 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors"
          >
            <Code className="w-8 h-8 text-purple-600 mb-3" />
            <span className="font-semibold text-gray-900">View Developers</span>
            <span className="text-sm text-gray-600 mt-1">Browse developer profiles</span>
          </button>
          
          <button
            onClick={() => setActiveTab('jobs')}
            className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            <Briefcase className="w-8 h-8 text-emerald-600 mb-3" />
            <span className="font-semibold text-gray-900">Manage Jobs</span>
            <span className="text-sm text-gray-600 mt-1">Feature and monitor job listings</span>
          </button>
          
          <button
            onClick={() => setActiveTab('hires')}
            className="flex flex-col items-center justify-center p-6 bg-orange-50 rounded-xl border border-orange-100 hover:bg-orange-100 transition-colors"
          >
            <DollarSign className="w-8 h-8 text-orange-600 mb-3" />
            <span className="font-semibold text-gray-900">View Hires</span>
            <span className="text-sm text-gray-600 mt-1">Track successful placements</span>
          </button>
          <TestInsert />
          <button
            onClick={() => navigate('/admin/tests')}
            className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <Code className="w-8 h-8 text-gray-600 mb-3" />
            <span className="font-semibold text-gray-900">Manage Tests</span>
            <span className="text-sm text-gray-600 mt-1">Create and edit coding tests</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Pending Recruiters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Approvals</h3>
          {pendingRecruiters.length > 0 ? (
            <div className="space-y-4">
              {pendingRecruiters.slice(0, 3).map((recruiter) => (
                <div key={recruiter.user_id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                  <div>
                    <h4 className="font-semibold text-gray-900">{recruiter.name}</h4>
                    <p className="text-sm text-gray-600">{recruiter.company_name}</p>
                    <div className="text-xs text-gray-500 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Joined {new Date(recruiter.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApprove(recruiter.user_id)}
                      disabled={processingIds.includes(recruiter.user_id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1 inline" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(recruiter.user_id)}
                      disabled={processingIds.includes(recruiter.user_id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 mr-1 inline" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingRecruiters.length > 3 && (
                <button
                  onClick={() => setActiveTab('recruiters')}
                  className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium py-2"
                >
                  View all {pendingRecruiters.length} pending recruiters
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-gray-600">No pending approvals</p>
            </div>
          )}
        </div>

        {/* Recent Hires */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Hires</h3>
          {hires.length > 0 ? (
            <div className="space-y-4">
              {hires.slice(0, 3).map((hire) => (
                <div key={hire.id} className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {hire.assignment?.developer?.name || 'Unknown Developer'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {hire.assignment?.job_role?.title || 'Unknown Position'}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Hired {new Date(hire.hire_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">${Math.round(hire.salary * 0.15).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">15% of ${hire.salary.toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {hires.length > 3 && (
                <button
                  onClick={() => setActiveTab('hires')}
                  className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium py-2"
                >
                  View all {hires.length} hires
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hires recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Platform Stats */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">Platform Statistics</h3>
          <div className="flex space-x-2">
            <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
              Last 30 Days
            </button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-50 rounded-xl p-6 flex items-center justify-center">
            <div className="text-center">
              <BarChart className="w-12 h-12 text-blue-500 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                Detailed analytics will be available soon
              </p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-6 flex items-center justify-center">
            <div className="text-center">
              <PieChart className="w-12 h-12 text-purple-500 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                Detailed analytics will be available soon
              </p>
            </div>
          </div>
        </div>
      </div>
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
            onNewMessage={fetchAdminData}
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

  const filteredPendingRecruiters = pendingRecruiters.filter(recruiter => 
    recruiter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredApprovedRecruiters = approvedRecruiters.filter(recruiter => 
    recruiter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDevelopers = developers.filter(developer => 
    developer.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    developer.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    developer.github_handle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    developer.top_languages.some(lang => lang.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredJobs = jobRoles.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.tech_stack.some(tech => tech.toLowerCase().includes(searchTerm.toLowerCase())) ||
    job.recruiter?.name.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Redirect if not authenticated or not an admin
  if (!userProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  if (userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Render the Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage recruiters, developers, and platform settings</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex flex-wrap space-x-6">
              {[
                { id: 'overview', label: 'Overview', icon: TrendingUp, badge: null },
                { id: 'recruiters', label: 'Recruiters', icon: Building, badge: pendingRecruiters.length > 0 ? pendingRecruiters.length : null },
                { id: 'developers', label: 'Developers', icon: Code, badge: null },
                { id: 'jobs', label: 'Job Listings', icon: Briefcase, badge: null },
                { id: 'hires', label: 'Hires Report', icon: DollarSign, badge: null },
                { id: 'messages', label: 'Messages', icon: MessageSquare, badge: null }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-gray-100'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-2" />
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && renderOverview()}

        {/* Recruiters Tab */}
        {activeTab === 'recruiters' && (
          <div className="space-y-8">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search recruiters by name, email, or company..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Pending Recruiters Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Clock className="w-6 h-6 text-amber-500 mr-3" />
                  <h2 className="text-xl font-black text-gray-900">Pending Approval</h2>
                  {pendingRecruiters.length > 0 && (
                    <span className="ml-3 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                      {pendingRecruiters.length} pending
                    </span>
                  )}
                </div>
                <button
                  onClick={fetchRecruiters}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                  <span className="text-gray-600 font-medium">Loading recruiters...</span>
                </div>
              ) : filteredPendingRecruiters.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Signup Date</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPendingRecruiters.map((recruiter) => (
                        <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                                {recruiter.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {recruiter.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Building className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.company_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {new Date(recruiter.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleApprove(recruiter.user_id)}
                                disabled={processingIds.includes(recruiter.user_id)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              >
                                {processingIds.includes(recruiter.user_id) ? (
                                  <Loader className="animate-spin w-4 h-4 mr-1" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(recruiter.user_id)}
                                disabled={processingIds.includes(recruiter.user_id)}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              >
                                {processingIds.includes(recruiter.user_id) ? (
                                  <Loader className="animate-spin w-4 h-4 mr-1" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-1" />
                                )}
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Recruiters</h3>
                  <p className="text-gray-600">
                    {searchTerm ? "No recruiters match your search criteria" : "All recruiters have been reviewed"}
                  </p>
                </div>
              )}
            </div>

            {/* Approved Recruiters Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center mb-6">
                <CheckCircle className="w-6 h-6 text-emerald-500 mr-3" />
                <h2 className="text-xl font-black text-gray-900">Approved Recruiters</h2>
                {approvedRecruiters.length > 0 && (
                  <span className="ml-3 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                    {approvedRecruiters.length} approved
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                  <span className="text-gray-600 font-medium">Loading recruiters...</span>
                </div>
              ) : filteredApprovedRecruiters.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Signup Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredApprovedRecruiters.map((recruiter) => (
                        <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                                {recruiter.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <button 
                                onClick={() => handleViewRecruiterDetails(recruiter.user_id)}
                                className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center"
                              >
                                {recruiter.name}
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Building className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.company_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {new Date(recruiter.created_at).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Approved Recruiters</h3>
                  <p className="text-gray-600">
                    {searchTerm ? "No recruiters match your search criteria" : "No recruiters have been approved yet"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Developers Tab Placeholder */}
        {activeTab === 'developers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Developers</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search developers..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                <span className="text-gray-600 font-medium">Loading developers...</span>
              </div>
            ) : filteredDevelopers.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">GitHub</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Skills</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Experience</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDevelopers.map((developer) => (
                        <tr key={developer.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                                {developer.user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900">{developer.user.name}</div>
                                <div className="text-sm text-gray-500">{developer.user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {developer.github_handle ? (
                                <a 
                                  href={`https://github.com/${developer.github_handle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  @{developer.github_handle}
                                </a>
                              ) : (
                                <span className="text-gray-500">Not provided</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {developer.top_languages.slice(0, 3).map((lang, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                  {lang}
                                </span>
                              ))}
                              {developer.top_languages.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                                  +{developer.top_languages.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {developer.location || 'Not specified'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {developer.experience_years} years
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              developer.availability 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {developer.availability ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewDeveloperDetails(developer)}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Profile"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedThread({
                                    otherUserId: developer.user_id,
                                    otherUserName: developer.user.name,
                                    otherUserRole: 'developer',
                                    otherUserProfilePicUrl: developer.profile_pic_url
                                  });
                                  setActiveTab('messages');
                                }}
                                className="text-purple-600 hover:text-purple-900"
                                title="Message Developer"
                              >
                                <MessageSquare className="w-5 h-5" />
                              </button>
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
                <Code className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Developers Found</h3>
                <p className="text-gray-600">
                  {searchTerm ? "No developers match your search criteria" : "There are no developers registered yet"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Job Listings</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                <span className="text-gray-600 font-medium">Loading jobs...</span>
              </div>
            ) : filteredJobs.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Title</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recruiter</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Posted</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{job.title}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {job.tech_stack.slice(0, 2).map((tech, index) => (
                                <span key={index} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                  {tech}
                                </span>
                              ))}
                              {job.tech_stack.length > 2 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                                  +{job.tech_stack.length - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{job.recruiter?.name || 'Unknown'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{job.location}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">${job.salary_min}k - ${job.salary_max}k</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              job.is_active 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {job.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {job.is_featured && (
                              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                Featured
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {new Date(job.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleFeatureJob(job.id, !!job.is_featured)}
                                className={`p-1 rounded-lg ${
                                  job.is_featured 
                                    ? 'text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50' 
                                    : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                                }`}
                                title={job.is_featured ? "Unfeature Job" : "Feature Job"}
                              >
                                <Star className="w-5 h-5" fill={job.is_featured ? "currentColor" : "none"} />
                              </button>
                              <button
                                onClick={() => handleViewJobDetails(job.id)}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg"
                                title="View Job Details"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                                title="Delete Job"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
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
                <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jobs Found</h3>
                <p className="text-gray-600">
                  {searchTerm ? "No jobs match your search criteria" : "There are no job postings yet"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hires Tab */}
        {activeTab === 'hires' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">Hires Report</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search hires..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                <span className="text-gray-600 font-medium">Loading hires...</span>
              </div>
            ) : hires.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Title</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recruiter</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Platform Fee</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hire Date</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {hires.map((hire) => (
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
                            <div className="text-sm text-gray-900">
                              {hire.assignment?.recruiter?.name || 'Unknown'}
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
                  {searchTerm ? "No hires match your search criteria" : "There are no successful hires recorded yet"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && renderMessages()}

        {/* Developer Details Modal */}
        {showDeveloperDetailsModal && selectedDeveloperForDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-2xl font-black text-gray-900">Developer Profile</h2>
                <button
                  onClick={() => setShowDeveloperDetailsModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <DeveloperProfileDetails
                  developer={selectedDeveloperForDetails}
                  onClose={() => setShowDeveloperDetailsModal(false)}
                  onSendMessage={(developerId, developerName) => {
                    setSelectedThread({
                      otherUserId: developerId,
                      otherUserName: developerName,
                      otherUserRole: 'developer',
                      otherUserProfilePicUrl: selectedDeveloperForDetails.profile_pic_url
                    });
                    setShowDeveloperDetailsModal(false);
                    setActiveTab('messages');
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Recruiter Details Modal */}
        {showRecruiterDetailsModal && selectedRecruiterForDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-2xl font-black text-gray-900">Recruiter Profile</h2>
                <button
                  onClick={() => setShowRecruiterDetailsModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <RecruiterProfileDetails
                  recruiterId={selectedRecruiterForDetails}
                  onClose={() => setShowRecruiterDetailsModal(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Job Details Modal */}
        {showJobDetailsModal && selectedJobForDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-2xl font-black text-gray-900">Job Details</h2>
                <button
                  onClick={() => setShowJobDetailsModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <JobRoleDetails
                  jobRoleId={selectedJobForDetails}
                  onClose={() => setShowJobDetailsModal(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
