import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AssignDeveloperModal } from '../components/Assignments/AssignDeveloperModal';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { 
  Users, 
  Briefcase, 
  UserCheck, 
  TrendingUp, 
  Search, 
  Filter,
  MoreVertical,
  Eye,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  Building,
  Code,
  Mail,
  Phone,
  Calendar,
  ArrowUpRight,
  Plus,
  Loader,
  Download,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { User, Developer, Recruiter, Assignment, Hire, JobRole } from '../types';

interface MessageThread {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  unreadCount: number;
  jobContext?: {
    id: string;
    title: string;
  };
}

export const AdminDashboard = () => {
  const { userProfile, loading: authLoading, updateUserApprovalStatus } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterRecruiter, setFilterRecruiter] = useState('');
  const [filterTechStack, setFilterTechStack] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobRole | null>(null);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [preSelectedDeveloperId, setPreSelectedDeveloperId] = useState<string | undefined>(undefined);
  const [preSelectedJobId, setPreSelectedJobId] = useState<string | undefined>(undefined);

  // Data states
  const [stats, setStats] = useState({
    totalDevelopers: 0,
    activeRecruiters: 0,
    successfulHires: 0,
    revenue: 0
  });
  const [developers, setDevelopers] = useState<(Developer & { user: User })[]>([]);
  const [recruiters, setRecruiters] = useState<(Recruiter & { user: User })[]>([]);
  const [jobRoles, setJobRoles] = useState<(JobRole & { recruiter: User })[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & {
    developer: User,
    job_role: JobRole,
    recruiter: User
  })[]>([]);
  const [hires, setHires] = useState<(Hire & { 
    assignment: Assignment & {
      developer: User,
      job_role: JobRole,
      recruiter: User
    }
  })[]>([]);
  const [pendingRecruiters, setPendingRecruiters] = useState<(Recruiter & { user: User })[]>([]);

  useEffect(() => {
    if (userProfile?.role === 'admin') fetchDashboardData();
  }, [userProfile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch stats
      const [
        { count: developersCount },
        { count: recruitersCount },
        { count: hiresCount }
      ] = await Promise.all([
        supabase.from('developers').select('*', { count: 'exact', head: true }),
        supabase.from('recruiters').select('*', { count: 'exact', head: true }),
        supabase.from('hires').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        totalDevelopers: developersCount || 0,
        activeRecruiters: recruitersCount || 0,
        successfulHires: hiresCount || 0,
        revenue: (hiresCount || 0) * 15000 // Estimate based on average hire fee
      });

      // Fetch developers with user data
      const { data: developersData, error: devError } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(*)
        `)
        .limit(50);

      if (devError) throw devError;
      setDevelopers(developersData || []);

      // Fetch recruiters with user data
      const { data: recruitersData, error: recError } = await supabase
        .from('recruiters')
        .select(`
          *,
          user:users(*)
        `)
        .limit(50);

      if (recError) throw recError;
      setRecruiters(recruitersData || []);

      // Fetch pending recruiters
      const { data: pendingData, error: pendingError } = await supabase
        .from('recruiters')
        .select(`
          *,
          user:users!inner(*)
        `)
        .eq('user.is_approved', false)
        .limit(10);

      if (pendingError) throw pendingError;
      setPendingRecruiters(pendingData || []);

      // Fetch job roles with recruiter data
      const { data: jobRolesData, error: jobError } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users!job_roles_recruiter_id_fkey(*)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobError) throw jobError;
      setJobRoles(jobRolesData || []);

      // Fetch assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(*),
          job_role:job_roles(*),
          recruiter:users!assignments_recruiter_id_fkey(*)
        `)
        .order('assigned_at', { ascending: false })
        .limit(50);

      if (assignError) throw assignError;
      setAssignments(assignmentsData || []);

      // Fetch hires
      const { data: hiresData, error: hiresError } = await supabase
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
        .order('hire_date', { ascending: false })
        .limit(50);

      if (hiresError) throw hiresError;
      setHires(hiresData || []);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const approveRecruiter = async (userId: string) => {
    try {
      const result = await updateUserApprovalStatus(userId, true);
      if (result) {
        fetchDashboardData();
      }
    } catch (error: any) {
      console.error('Error approving recruiter:', error);
      setError(error.message || 'Failed to approve recruiter');
    }
  };

  const rejectRecruiter = async (userId: string) => {
    try {
      const result = await updateUserApprovalStatus(userId, false);
      if (result) {
        // Also delete the recruiter profile
        await supabase.from('recruiters').delete().eq('user_id', userId);
        await supabase.from('users').delete().eq('id', userId);
        fetchDashboardData();
      }
    } catch (error: any) {
      console.error('Error rejecting recruiter:', error);
      setError(error.message || 'Failed to reject recruiter');
    }
  };

  const exportHiresToCSV = () => {
    if (hires.length === 0) return;

    const csvData = hires.map(hire => ({
      'Developer Name': hire.assignment?.developer?.name || 'Unknown',
      'Recruiter Name': hire.assignment?.recruiter?.name || 'Unknown',
      'Job Title': hire.assignment?.job_role?.title || 'Unknown',
      'Salary': hire.salary,
      'Hire Date': new Date(hire.hire_date).toLocaleDateString(),
      'Start Date': hire.start_date ? new Date(hire.start_date).toLocaleDateString() : 'Not specified',
      'Notes': hire.notes || ''
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-hires-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter functions
  const getFilteredRecruiters = () => {
    return recruiters.filter(recruiter => 
      (searchTerm === '' || 
       recruiter.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
       recruiter.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       recruiter.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus === 'all' || 
       (filterStatus === 'approved' && recruiter.user?.is_approved) ||
       (filterStatus === 'pending' && !recruiter.user?.is_approved))
    );
  };

  const getFilteredDevelopers = () => {
    return developers.filter(dev => 
      (searchTerm === '' || 
       dev.user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       dev.github_handle.toLowerCase().includes(searchTerm.toLowerCase()) ||
       dev.user.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterLanguage === '' || 
       dev.top_languages.some(lang => lang.toLowerCase().includes(filterLanguage.toLowerCase())))
    );
  };

  const getFilteredJobs = () => {
    return jobRoles.filter(job => 
      (searchTerm === '' || 
       job.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
       job.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterRecruiter === '' || job.recruiter_id === filterRecruiter) &&
      (filterTechStack === '' || 
       job.tech_stack.some(tech => tech.toLowerCase().includes(filterTechStack.toLowerCase())))
    );
  };

  const getFilteredAssignments = () => {
    return assignments.filter(assignment => 
      searchTerm === '' || 
      assignment.developer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      assignment.job_role?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.recruiter?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getFilteredHires = () => {
    return hires.filter(hire => 
      searchTerm === '' || 
      hire.assignment?.developer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      hire.assignment?.job_role?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hire.assignment?.recruiter?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get unique languages from all developers
  const getUniqueLanguages = () => {
    const allLanguages = developers.flatMap(dev => dev.top_languages);
    return [...new Set(allLanguages)].sort();
  };

  // Get unique tech stack items from all jobs
  const getUniqueTechStack = () => {
    const allTechStack = jobRoles.flatMap(job => job.tech_stack);
    return [...new Set(allTechStack)].sort();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Fetching admin data...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!userProfile) {
    console.log('❌ No user profile, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect if not an admin
  if (userProfile.role !== 'admin') {
    console.log('❌ Not an admin role, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  const statsCards = [
    {
      title: 'Total Developers',
      value: stats.totalDevelopers.toString(),
      change: '+12%',
      changeType: 'positive',
      icon: Code,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Active Recruiters',
      value: stats.activeRecruiters.toString(),
      change: '+8%',
      changeType: 'positive',
      icon: Building,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Successful Hires',
      value: stats.successfulHires.toString(),
      change: '+23%',
      changeType: 'positive',
      icon: Award,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Revenue (Est.)',
      value: `$${Math.round(stats.revenue / 1000)}K`,
      change: '+18%',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'recruiters', label: 'Recruiters', icon: Building },
    { id: 'developers', label: 'Developers', icon: Code },
    { id: 'jobs', label: 'Job Roles', icon: Briefcase },
    { id: 'assignments', label: 'Assignments', icon: UserCheck },
    { id: 'hires', label: 'Hires', icon: Award },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  const renderOverview = () => (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-gray-900">Overview</h2>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh Data
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className={`flex items-center text-sm font-semibold ${
                stat.changeType === 'positive' ? 'text-emerald-600' : 'text-red-600'
              }`}>
                <ArrowUpRight className="w-4 h-4 mr-1" />
                {stat.change}
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-gray-600">{stat.title}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Recent Assignments</h3>
          <div className="space-y-4">
            {assignments.slice(0, 5).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900">{assignment.developer?.name}</div>
                  <div className="text-sm text-gray-600">{assignment.job_role?.title} at {assignment.recruiter?.name}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                  assignment.status === 'Contacted' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {assignment.status}
                </span>
              </div>
            ))}
            {assignments.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent assignments</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Pending Approvals</h3>
          <div className="space-y-4">
            {pendingRecruiters.slice(0, 5).map((recruiter) => (
              <div key={recruiter.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{recruiter.user?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-600">{recruiter.company_name || 'Unknown Company'}</div>
                  <div className="text-xs text-gray-500">
                    {recruiter.user?.email || 'No email'} • Created {new Date(recruiter.user?.created_at || Date.now()).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => approveRecruiter(recruiter.user_id)}
                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => rejectRecruiter(recruiter.user_id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {pendingRecruiters.length === 0 && (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No pending approvals</p>
                <p className="text-sm text-gray-500 mt-2">
                  New recruiter signups will appear here for approval
                </p>
                <button
                  onClick={fetchDashboardData}
                  className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium inline-flex items-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Check Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecruiters = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-gray-900">Recruiters</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search recruiters..."
              className="w-full sm:w-auto pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full sm:w-auto px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recruiter</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Industry</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredRecruiters()
                .filter(rec => 
                  !searchTerm || 
                  rec.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  rec.company_name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((recruiter) => (
                <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-4">
                        {recruiter.user?.name?.split(' ').map(n => n[0]).join('') || 'R'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{recruiter.user?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{recruiter.user?.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{recruiter.company_name}</div>
                    <div className="text-sm text-gray-500">{recruiter.company_size}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      recruiter.user?.is_approved 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {recruiter.user?.is_approved ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {recruiter.user?.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {recruiter.industry || 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {!recruiter.user?.is_approved && (
                        <>
                          <button 
                            onClick={() => approveRecruiter(recruiter.user_id)}
                            className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => rejectRecruiter(recruiter.user_id)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDevelopers = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-gray-900">Developers</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search developers..."
              className="w-full sm:w-auto pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full sm:w-auto px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
          >
            <option value="">All Languages</option>
            {getUniqueLanguages().map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              setPreSelectedDeveloperId(undefined);
              setPreSelectedJobId(undefined);
              setShowAssignModal(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Assign Developer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Skills</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Experience</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredDevelopers()
                .filter(dev => 
                  !searchTerm || 
                  dev.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  dev.github_handle.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((developer) => (
                <tr key={developer.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-4">
                        {developer.user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{developer.user.name}</div>
                        <div className="text-sm text-gray-500">{developer.user.email}</div>
                        {developer.github_handle && (
                          <div className="text-xs text-gray-400">@{developer.github_handle}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {developer.top_languages.slice(0, 3).map((lang, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-lg">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      developer.availability 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        developer.availability ? 'bg-emerald-500' : 'bg-gray-500'
                      }`}></div>
                      {developer.availability ? 'Available' : 'Busy'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {developer.experience_years} years
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {developer.location || 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => {
                          setSelectedDeveloper(developer.user_id);
                          setShowDeveloperDetails(true); 
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          // Pre-select this developer in the assignment modal
                          setPreSelectedDeveloperId(developer.user_id);
                          setPreSelectedJobId(undefined);
                          setShowAssignModal(true);
                        }}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderJobRoles = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-gray-900">Job Roles</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search jobs..."
              className="w-full sm:w-auto pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full sm:w-auto px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={filterRecruiter}
            onChange={(e) => setFilterRecruiter(e.target.value)}
          >
            <option value="">All Recruiters</option>
            {recruiters.map(recruiter => (
              <option key={recruiter.user_id} value={recruiter.user_id}>
                {recruiter.user?.name || 'Unknown'} ({recruiter.company_name})
              </option>
            ))}
          </select>
          <select
            className="w-full sm:w-auto px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={filterTechStack}
            onChange={(e) => setFilterTechStack(e.target.value)}
          >
            <option value="">All Technologies</option>
            {getUniqueTechStack().map(tech => (
              <option key={tech} value={tech}>{tech}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {getFilteredJobs()
          .filter(job => 
            !searchTerm || 
            job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.recruiter?.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((job) => (
          <div key={job.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-black text-gray-900">{job.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {job.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Building className="w-4 h-4 mr-1" />
                    {job.recruiter?.name}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Posted {new Date(job.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {assignments.filter(a => a.job_role_id === job.id).length} assigned
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  {job.tech_stack.slice(0, 4).map((tech, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                  {job.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>${job.salary_min}k - ${job.salary_max}k</span>
                <span>{job.location}</span>
                <span>{job.job_type}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => {
                    setSelectedJob(job);
                    setShowJobDetails(true);
                  }}
                  className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
                >
                  View Details
                </button>
                <button 
                  onClick={() => {
                    // Pre-select this job in the assignment modal
                    setPreSelectedJobId(job.id);
                    setPreSelectedDeveloperId(undefined);
                    setShowAssignModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Assign Developer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAssignments = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-gray-900">Assignments</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search assignments..."
              className="w-full sm:w-auto pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setPreSelectedDeveloperId(undefined);
              setPreSelectedJobId(undefined);
              setShowAssignModal(true);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            New Assignment
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Role</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recruiter</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredAssignments().map((assignment) => (
                <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                        {assignment.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {assignment.developer?.name || 'Unknown'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {assignment.job_role?.title || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {assignment.recruiter?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                      assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                      assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {assignment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => {
                          setSelectedDeveloper(assignment.developer_id);
                          setShowDeveloperDetails(true);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setSelectedThread({
                          otherUserId: assignment.developer_id,
                          otherUserName: assignment.developer?.name || 'Developer',
                          otherUserRole: 'developer',
                          unreadCount: 0,
                          jobContext: {
                            id: assignment.job_role_id,
                            title: assignment.job_role?.title || 'Job'
                          }
                        })}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderHires = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-gray-900">All Hires</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search hires..."
              className="w-full sm:w-auto pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {hires.length > 0 && (
            <button 
              onClick={exportHiresToCSV}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {hires.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recruiter</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hire Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredHires().map((hire) => (
                  <tr key={hire.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                          {hire.assignment?.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(hire.hire_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-emerald-600">
                        ${Math.round(hire.salary * 0.15).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Hires Yet</h3>
          <p className="text-gray-600">Successful hires will appear here once recruiters mark developers as hired.</p>
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
          <h1 className="text-3xl font-black text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage developers, recruiters, and platform operations</p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-semibold text-sm transition-all ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-2" />
                  {tab.label}
                  {tab.id === 'recruiters' && pendingRecruiters.length > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {pendingRecruiters.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'recruiters' && renderRecruiters()}
        {activeTab === 'developers' && renderDevelopers()}
        {activeTab === 'jobs' && renderJobRoles()}
        {activeTab === 'assignments' && renderAssignments()}
        {activeTab === 'hires' && renderHires()}
        {activeTab === 'messages' && renderMessages()}
      </div>

      {/* Modals */}
      <AssignDeveloperModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        preSelectedDeveloperId={preSelectedDeveloperId}
        preSelectedJobId={preSelectedJobId}
        onSuccess={() => {
          setShowAssignModal(false);
          setPreSelectedDeveloperId(undefined);
          setPreSelectedJobId(undefined);
          fetchDashboardData();
        }}
      />

      {showJobDetails && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
            <div className="p-6 border-b border-gray-200">
              <button
                onClick={() => {
                  setShowJobDetails(false);
                  setSelectedJob(null);
                }}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Jobs
              </button>
            </div>
            <div className="p-6">
              <JobRoleDetails
                jobRoleId={selectedJob.id}
                onAssignDeveloper={() => {
                  setShowJobDetails(false);
                  setShowAssignModal(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};