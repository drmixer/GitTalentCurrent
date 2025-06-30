import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { 
  Users, 
  Briefcase, 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  Download, 
  Loader, 
  AlertCircle, 
  Eye, 
  MessageSquare, 
  BarChart3, 
  Calendar, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Building,
  Code,
  Clock,
  X,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { User, Developer, Recruiter, JobRole, Assignment, Hire } from '../types';
import { DeveloperProfileDetails } from '../components/Profile/DeveloperProfileDetails';
import { RecruiterProfileDetails } from '../components/Profile/RecruiterProfileDetails';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { AssignDeveloperModal } from '../components/Assignments/AssignDeveloperModal';
import { MessageThread } from '../components/Messages/MessageThread';

export const AdminDashboard = () => {
  const { userProfile, loading: authLoading, updateUserApprovalStatus } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Data states
  const [recruiters, setRecruiters] = useState<(Recruiter & { user: User })[]>([]);
  const [pendingRecruiters, setPendingRecruiters] = useState<(Recruiter & { user: User })[]>([]);
  const [developers, setDevelopers] = useState<(Developer & { user: User })[]>([]);
  const [jobRoles, setJobRoles] = useState<(JobRole & { recruiter: User })[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { 
    developer: User, 
    recruiter: User, 
    job_role: JobRole 
  })[]>([]);
  const [hires, setHires] = useState<(Hire & { 
    assignment: Assignment & { 
      developer: User, 
      recruiter: User, 
      job_role: JobRole 
    } 
  })[]>([]);
  
  // Filter states
  const [recruiterSearchTerm, setRecruiterSearchTerm] = useState('');
  const [developerSearchTerm, setDeveloperSearchTerm] = useState('');
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string | null>(null);
  const [jobActiveFilter, setJobActiveFilter] = useState<boolean | null>(null);
  const [developerAvailabilityFilter, setDeveloperAvailabilityFilter] = useState<boolean | null>(null);
  
  // Modal states
  const [showDeveloperProfile, setShowDeveloperProfile] = useState(false);
  const [showRecruiterProfile, setShowRecruiterProfile] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showAssignDeveloperModal, setShowAssignDeveloperModal] = useState(false);
  const [showMessageThread, setShowMessageThread] = useState(false);
  
  // Selected item states
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string | null>(null);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedMessageUser, setSelectedMessageUser] = useState<{id: string, name: string, role: string} | null>(null);
  
  // Hires report states
  const [hiresReportData, setHiresReportData] = useState<any[]>([]);
  const [hiresDateRange, setHiresDateRange] = useState<{start: string, end: string}>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [hiresRecruiterFilter, setHiresRecruiterFilter] = useState<string | null>(null);
  const [hiresExpandedRows, setHiresExpandedRows] = useState<{[key: string]: boolean}>({});
  
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchDashboardData();
    }
  }, [userProfile]);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      await Promise.all([
        fetchRecruiters(),
        fetchDevelopers(),
        fetchJobRoles(),
        fetchAssignments(),
        fetchHires()
      ]);
      
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRecruiters = async () => {
    try {
      const { data, error } = await supabase
        .from('recruiters')
        .select(`
          *,
          user:users(*)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      const allRecruiters = data || [];
      setRecruiters(allRecruiters);
      
      // Filter pending recruiters
      const pending = allRecruiters.filter(r => !r.user.is_approved);
      setPendingRecruiters(pending);
      
    } catch (error: any) {
      console.error('Error fetching recruiters:', error);
      throw error;
    }
  };
  
  const fetchDevelopers = async () => {
    try {
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
      throw error;
    }
  };
  
  const fetchJobRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users!job_roles_recruiter_id_fkey(*)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setJobRoles(data || []);
      
    } catch (error: any) {
      console.error('Error fetching job roles:', error);
      throw error;
    }
  };
  
  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(*),
          recruiter:users!assignments_recruiter_id_fkey(*),
          job_role:job_roles(*)
        `)
        .order('assigned_at', { ascending: false });
        
      if (error) throw error;
      setAssignments(data || []);
      
    } catch (error: any) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  };
  
  const fetchHires = async () => {
    try {
      const { data, error } = await supabase
        .from('hires')
        .select(`
          *,
          assignment:assignments(
            *,
            developer:users!assignments_developer_id_fkey(*),
            recruiter:users!assignments_recruiter_id_fkey(*),
            job_role:job_roles(*)
          )
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setHires(data || []);
      
      // Process data for hires report
      processHiresReportData(data || []);
      
    } catch (error: any) {
      console.error('Error fetching hires:', error);
      throw error;
    }
  };
  
  const processHiresReportData = (hiresData: any[]) => {
    // Group hires by recruiter
    const recruiterGroups: {[key: string]: any} = {};
    
    hiresData.forEach(hire => {
      const recruiterId = hire.assignment.recruiter_id;
      const recruiterName = hire.assignment.recruiter.name;
      
      if (!recruiterGroups[recruiterId]) {
        recruiterGroups[recruiterId] = {
          id: recruiterId,
          name: recruiterName,
          hires: [],
          totalHires: 0,
          totalSalary: 0,
          totalCommission: 0
        };
      }
      
      recruiterGroups[recruiterId].hires.push(hire);
      recruiterGroups[recruiterId].totalHires += 1;
      recruiterGroups[recruiterId].totalSalary += hire.salary;
      recruiterGroups[recruiterId].totalCommission += Math.round(hire.salary * 0.15);
    });
    
    setHiresReportData(Object.values(recruiterGroups));
  };
  
  const handleApproveRecruiter = async (userId: string) => {
    try {
      setLoading(true);
      
      const success = await updateUserApprovalStatus?.(userId, true);
      
      if (success) {
        setSuccessMessage('Recruiter approved successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        await fetchRecruiters();
      } else {
        throw new Error('Failed to approve recruiter');
      }
    } catch (error: any) {
      console.error('Error approving recruiter:', error);
      setError(error.message || 'Failed to approve recruiter');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRejectRecruiter = async (userId: string) => {
    try {
      setLoading(true);
      
      const success = await updateUserApprovalStatus?.(userId, false);
      
      if (success) {
        setSuccessMessage('Recruiter rejected successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        await fetchRecruiters();
      } else {
        throw new Error('Failed to reject recruiter');
      }
    } catch (error: any) {
      console.error('Error rejecting recruiter:', error);
      setError(error.message || 'Failed to reject recruiter');
    } finally {
      setLoading(false);
    }
  };
  
  const handleViewDeveloperProfile = (developerId: string) => {
    setSelectedDeveloperId(developerId);
    setShowDeveloperProfile(true);
  };
  
  const handleViewRecruiterProfile = (recruiterId: string) => {
    setSelectedRecruiterId(recruiterId);
    setShowRecruiterProfile(true);
  };
  
  const handleViewJobDetails = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowJobDetails(true);
  };
  
  const handleAssignDeveloper = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowAssignDeveloperModal(true);
  };
  
  const handleSendMessage = (userId: string, userName: string, userRole: string) => {
    setSelectedMessageUser({id: userId, name: userName, role: userRole});
    setShowMessageThread(true);
  };
  
  const handleHiresDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setHiresDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const toggleHiresExpandedRow = (recruiterId: string) => {
    setHiresExpandedRows(prev => ({
      ...prev,
      [recruiterId]: !prev[recruiterId]
    }));
  };
  
  const exportHiresReport = () => {
    // Filter hires based on date range and recruiter filter
    const filteredHires = hires.filter(hire => {
      const hireDate = new Date(hire.hire_date);
      const startDate = new Date(hiresDateRange.start);
      const endDate = new Date(hiresDateRange.end);
      endDate.setHours(23, 59, 59); // Set to end of day
      
      const dateInRange = hireDate >= startDate && hireDate <= endDate;
      const matchesRecruiter = hiresRecruiterFilter ? hire.assignment.recruiter_id === hiresRecruiterFilter : true;
      
      return dateInRange && matchesRecruiter;
    });
    
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Developer,Recruiter,Job Title,Salary,Hire Date,Commission\n";
    
    filteredHires.forEach(hire => {
      const row = [
        hire.assignment.developer.name,
        hire.assignment.recruiter.name,
        hire.assignment.job_role.title,
        hire.salary,
        new Date(hire.hire_date).toLocaleDateString(),
        Math.round(hire.salary * 0.15)
      ];
      csvContent += row.join(",") + "\n";
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hires-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Filter functions
  const filteredRecruiters = recruiters.filter(recruiter => 
    recruiter.user.name.toLowerCase().includes(recruiterSearchTerm.toLowerCase()) ||
    recruiter.user.email.toLowerCase().includes(recruiterSearchTerm.toLowerCase()) ||
    recruiter.company_name.toLowerCase().includes(recruiterSearchTerm.toLowerCase())
  );
  
  const filteredDevelopers = developers.filter(developer => {
    const matchesSearch = 
      developer.user.name.toLowerCase().includes(developerSearchTerm.toLowerCase()) ||
      developer.user.email.toLowerCase().includes(developerSearchTerm.toLowerCase()) ||
      (developer.github_handle && developer.github_handle.toLowerCase().includes(developerSearchTerm.toLowerCase())) ||
      (developer.location && developer.location.toLowerCase().includes(developerSearchTerm.toLowerCase()));
    
    const matchesAvailability = developerAvailabilityFilter === null || developer.availability === developerAvailabilityFilter;
    
    return matchesSearch && matchesAvailability;
  });
  
  const filteredJobs = jobRoles.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(jobSearchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(jobSearchTerm.toLowerCase()) ||
      job.recruiter.name.toLowerCase().includes(jobSearchTerm.toLowerCase()) ||
      job.tech_stack.some(tech => tech.toLowerCase().includes(jobSearchTerm.toLowerCase()));
    
    const matchesActive = jobActiveFilter === null || job.is_active === jobActiveFilter;
    
    return matchesSearch && matchesActive;
  });
  
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = 
      assignment.developer.name.toLowerCase().includes(assignmentSearchTerm.toLowerCase()) ||
      assignment.recruiter.name.toLowerCase().includes(assignmentSearchTerm.toLowerCase()) ||
      assignment.job_role.title.toLowerCase().includes(assignmentSearchTerm.toLowerCase());
    
    const matchesStatus = assignmentStatusFilter === null || assignment.status === assignmentStatusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  const filteredHires = hires.filter(hire => {
    const hireDate = new Date(hire.hire_date);
    const startDate = new Date(hiresDateRange.start);
    const endDate = new Date(hiresDateRange.end);
    endDate.setHours(23, 59, 59); // Set to end of day
    
    const dateInRange = hireDate >= startDate && hireDate <= endDate;
    const matchesRecruiter = hiresRecruiterFilter ? hire.assignment.recruiter_id === hiresRecruiterFilter : true;
    
    return dateInRange && matchesRecruiter;
  });
  
  // Calculate dashboard stats
  const stats = {
    totalDevelopers: developers.length,
    availableDevelopers: developers.filter(d => d.availability).length,
    totalRecruiters: recruiters.length,
    pendingRecruiters: pendingRecruiters.length,
    totalJobs: jobRoles.length,
    activeJobs: jobRoles.filter(j => j.is_active).length,
    totalAssignments: assignments.length,
    totalHires: hires.length,
    totalRevenue: hires.reduce((sum, hire) => sum + Math.round(hire.salary * 0.15), 0)
  };
  
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
  if (!userProfile || userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, job roles, and platform operations</p>
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
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'recruiters', label: 'Recruiters', icon: Building },
                { id: 'developers', label: 'Developers', icon: Code },
                { id: 'jobs', label: 'Job Roles', icon: Briefcase },
                { id: 'assignments', label: 'Assignments', icon: UserPlus },
                { id: 'hires', label: 'Hires Report', icon: FileText }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
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
        
        {/* Content based on active tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-4">Developers</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalDevelopers}</div>
                    <div className="text-sm font-semibold text-gray-600">Total</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.availableDevelopers}</div>
                    <div className="text-sm font-semibold text-gray-600">Available</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-4">Recruiters</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalRecruiters}</div>
                    <div className="text-sm font-semibold text-gray-600">Total</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.pendingRecruiters}</div>
                    <div className="text-sm font-semibold text-gray-600">Pending</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-4">Jobs</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalJobs}</div>
                    <div className="text-sm font-semibold text-gray-600">Total</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.activeJobs}</div>
                    <div className="text-sm font-semibold text-gray-600">Active</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-4">Assignments</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalAssignments}</div>
                    <div className="text-sm font-semibold text-gray-600">Total Assignments</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-4">Hires</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalHires}</div>
                    <div className="text-sm font-semibold text-gray-600">Total Hires</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-4">Revenue</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-100">
                    <div className="text-2xl font-black text-gray-900 mb-1">${stats.totalRevenue.toLocaleString()}</div>
                    <div className="text-sm font-semibold text-gray-600">Total Commission</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Pending Approvals */}
            {pendingRecruiters.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-6">Pending Recruiter Approvals</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingRecruiters.map((recruiter) => (
                        <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                                {recruiter.user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {recruiter.user.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {recruiter.user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {recruiter.company_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(recruiter.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleApproveRecruiter(recruiter.user_id)}
                                className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium"
                              >
                                <CheckCircle className="w-4 h-4 mr-1 inline" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRecruiter(recruiter.user_id)}
                                className="px-3 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                              >
                                <XCircle className="w-4 h-4 mr-1 inline" />
                                Reject
                              </button>
                              <button
                                onClick={() => handleViewRecruiterProfile(recruiter.user_id)}
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                              >
                                <Eye className="w-4 h-4 mr-1 inline" />
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-6">Recent Assignments</h3>
                <div className="space-y-4">
                  {assignments.slice(0, 5).map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                          {assignment.developer.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{assignment.developer.name}</div>
                          <div className="text-sm text-gray-600">{assignment.job_role.title}</div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                        assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                        assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {assignment.status}
                      </span>
                    </div>
                  ))}
                  {assignments.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No assignments yet</p>
                  )}
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-6">Recent Hires</h3>
                <div className="space-y-4">
                  {hires.slice(0, 5).map((hire) => (
                    <div key={hire.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                          {hire.assignment.developer.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{hire.assignment.developer.name}</div>
                          <div className="text-sm text-gray-600">{hire.assignment.job_role.title}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">${hire.salary.toLocaleString()}</div>
                        <div className="text-sm text-emerald-600">${Math.round(hire.salary * 0.15).toLocaleString()} commission</div>
                      </div>
                    </div>
                  ))}
                  {hires.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No hires yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Recruiters Tab */}
        {activeTab === 'recruiters' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Recruiters</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search recruiters..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={recruiterSearchTerm}
                  onChange={(e) => setRecruiterSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {/* Pending Approvals Section */}
            {pendingRecruiters.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6">
                <h3 className="text-lg font-bold text-yellow-800 mb-4">Pending Approvals ({pendingRecruiters.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-yellow-100/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-200/50">
                      {pendingRecruiters.map((recruiter) => (
                        <tr key={recruiter.user_id} className="hover:bg-yellow-100/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                                {recruiter.user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {recruiter.user.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {recruiter.user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {recruiter.company_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(recruiter.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleApproveRecruiter(recruiter.user_id)}
                                className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium"
                              >
                                <CheckCircle className="w-4 h-4 mr-1 inline" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRecruiter(recruiter.user_id)}
                                className="px-3 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                              >
                                <XCircle className="w-4 h-4 mr-1 inline" />
                                Reject
                              </button>
                              <button
                                onClick={() => handleViewRecruiterProfile(recruiter.user_id)}
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                              >
                                <Eye className="w-4 h-4 mr-1 inline" />
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* All Recruiters */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-6">All Recruiters</h3>
              
              {filteredRecruiters.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Jobs</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hires</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRecruiters.map((recruiter) => {
                        const recruiterJobs = jobRoles.filter(job => job.recruiter_id === recruiter.user_id);
                        const recruiterHires = hires.filter(hire => hire.assignment.recruiter_id === recruiter.user_id);
                        
                        return (
                          <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                                  {recruiter.user.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {recruiter.user.name}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {recruiter.user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {recruiter.company_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                recruiter.user.is_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {recruiter.user.is_approved ? 'Approved' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {recruiterJobs.length}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {recruiterHires.length}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleViewRecruiterProfile(recruiter.user_id)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View Profile"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSendMessage(recruiter.user_id, recruiter.user.name, 'recruiter')}
                                  className="p-1 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Send Message"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                                {!recruiter.user.is_approved ? (
                                  <button
                                    onClick={() => handleApproveRecruiter(recruiter.user_id)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Approve"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRejectRecruiter(recruiter.user_id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Deactivate"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recruiters Found</h3>
                  <p className="text-gray-600">
                    {recruiterSearchTerm
                      ? "No recruiters match your search criteria" 
                      : "There are no recruiters in the system yet"}
                  </p>
                  {recruiterSearchTerm && (
                    <button 
                      onClick={() => setRecruiterSearchTerm('')}
                      className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Developers Tab */}
        {activeTab === 'developers' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-2xl font-black text-gray-900">Developers</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search developers..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={developerSearchTerm}
                    onChange={(e) => setDeveloperSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <select
                    value={developerAvailabilityFilter === null ? 'all' : developerAvailabilityFilter.toString()}
                    onChange={(e) => setDeveloperAvailabilityFilter(e.target.value === 'all' ? null : e.target.value === 'true')}
                    className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="all">All Developers</option>
                    <option value="true">Available Only</option>
                    <option value="false">Unavailable Only</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              {filteredDevelopers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">GitHub</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Experience</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Profile</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDevelopers.map((developer) => {
                        const developerAssignments = assignments.filter(a => a.developer_id === developer.user_id);
                        
                        return (
                          <tr key={developer.user_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                                  {developer.user.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {developer.user.name}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {developer.user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {developer.github_handle ? (
                                <a 
                                  href={`https://github.com/${developer.github_handle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  @{developer.github_handle}
                                </a>
                              ) : (
                                <span className="text-gray-400">Not set</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {developer.location || <span className="text-gray-400">Not set</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {developer.experience_years > 0 ? `${developer.experience_years} years` : <span className="text-gray-400">Not set</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                developer.availability ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {developer.availability ? 'Available' : 'Unavailable'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      developer.profile_strength >= 80 ? 'bg-emerald-500' :
                                      developer.profile_strength >= 50 ? 'bg-blue-500' :
                                      'bg-orange-500'
                                    }`}
                                    style={{ width: `${developer.profile_strength}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-500">{developer.profile_strength}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleViewDeveloperProfile(developer.user_id)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View Profile"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSendMessage(developer.user_id, developer.user.name, 'developer')}
                                  className="p-1 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Send Message"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    // Find a job to assign to
                                    const activeJobs = jobRoles.filter(job => job.is_active);
                                    if (activeJobs.length > 0) {
                                      handleAssignDeveloper(activeJobs[0].id);
                                    } else {
                                      setError('No active jobs available for assignment');
                                    }
                                  }}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Assign to Job"
                                  disabled={jobRoles.filter(job => job.is_active).length === 0}
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Code className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Developers Found</h3>
                  <p className="text-gray-600">
                    {developerSearchTerm || developerAvailabilityFilter !== null
                      ? "No developers match your search criteria" 
                      : "There are no developers in the system yet"}
                  </p>
                  {(developerSearchTerm || developerAvailabilityFilter !== null) && (
                    <button 
                      onClick={() => {
                        setDeveloperSearchTerm('');
                        setDeveloperAvailabilityFilter(null);
                      }}
                      className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Job Roles Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-2xl font-black text-gray-900">Job Roles</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search jobs..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={jobSearchTerm}
                    onChange={(e) => setJobSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <select
                    value={jobActiveFilter === null ? 'all' : jobActiveFilter.toString()}
                    onChange={(e) => setJobActiveFilter(e.target.value === 'all' ? null : e.target.value === 'true')}
                    className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="all">All Jobs</option>
                    <option value="true">Active Only</option>
                    <option value="false">Inactive Only</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              {filteredJobs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recruiter</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Posted</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredJobs.map((job) => {
                        const jobAssignments = assignments.filter(a => a.job_role_id === job.id);
                        const jobHires = hires.filter(h => h.assignment.job_role_id === job.id);
                        
                        return (
                          <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900">
                                {job.title}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-2">
                                  {job.recruiter.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {job.recruiter.name}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.location}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.job_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              ${job.salary_min}k - ${job.salary_max}k
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {job.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(job.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleViewJobDetails(job.id)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleAssignDeveloper(job.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Assign Developer"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jobs Found</h3>
                  <p className="text-gray-600">
                    {jobSearchTerm || jobActiveFilter !== null
                      ? "No jobs match your search criteria" 
                      : "There are no job roles in the system yet"}
                  </p>
                  {(jobSearchTerm || jobActiveFilter !== null) && (
                    <button 
                      onClick={() => {
                        setJobSearchTerm('');
                        setJobActiveFilter(null);
                      }}
                      className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-2xl font-black text-gray-900">Assignments</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search assignments..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={assignmentSearchTerm}
                    onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <select
                    value={assignmentStatusFilter || ''}
                    onChange={(e) => setAssignmentStatusFilter(e.target.value || null)}
                    className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Hired">Hired</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    // Find an active job to assign a developer to
                    const activeJobs = jobRoles.filter(job => job.is_active);
                    if (activeJobs.length > 0) {
                      handleAssignDeveloper(activeJobs[0].id);
                    } else {
                      setError('No active jobs available for assignment');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                  disabled={jobRoles.filter(job => job.is_active).length === 0}
                >
                  <UserPlus className="w-4 h-4 mr-2 inline" />
                  Create Assignment
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              {filteredAssignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Role</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recruiter</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAssignments.map((assignment) => (
                        <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                                {assignment.developer.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {assignment.developer.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {assignment.job_role.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-2">
                                {assignment.recruiter.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="text-sm text-gray-500">
                                {assignment.recruiter.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                              assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                              assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                              assignment.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {assignment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(assignment.assigned_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(assignment.updated_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewDeveloperProfile(assignment.developer_id)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View Developer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleViewJobDetails(assignment.job_role_id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="View Job"
                              >
                                <Briefcase className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assignments Found</h3>
                  <p className="text-gray-600">
                    {assignmentSearchTerm || assignmentStatusFilter
                      ? "No assignments match your search criteria" 
                      : "There are no assignments in the system yet"}
                  </p>
                  {(assignmentSearchTerm || assignmentStatusFilter) && (
                    <button 
                      onClick={() => {
                        setAssignmentSearchTerm('');
                        setAssignmentStatusFilter(null);
                      }}
                      className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Hires Report Tab */}
        {activeTab === 'hires' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-2xl font-black text-gray-900">Hires Report</h2>
              <button
                onClick={exportHiresReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                disabled={filteredHires.length === 0}
              >
                <Download className="w-4 h-4 mr-2 inline" />
                Export CSV
              </button>
            </div>
            
            {/* Filters */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-4">Filters</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        name="start"
                        value={hiresDateRange.start}
                        onChange={handleHiresDateRangeChange}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        name="end"
                        value={hiresDateRange.end}
                        onChange={handleHiresDateRangeChange}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Recruiter
                  </label>
                  <select
                    value={hiresRecruiterFilter || ''}
                    onChange={(e) => setHiresRecruiterFilter(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">All Recruiters</option>
                    {recruiters.map(recruiter => (
                      <option key={recruiter.user_id} value={recruiter.user_id}>
                        {recruiter.user.name} ({recruiter.company_name})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setHiresDateRange({
                        start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
                        end: new Date().toISOString().split('T')[0]
                      });
                      setHiresRecruiterFilter(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    <RefreshCw className="w-4 h-4 mr-2 inline" />
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
            
            {/* Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-6">Summary</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="text-2xl font-black text-gray-900 mb-1">{filteredHires.length}</div>
                  <div className="text-sm font-semibold text-gray-600">Total Hires</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                  <div className="text-2xl font-black text-gray-900 mb-1">
                    ${filteredHires.reduce((sum, hire) => sum + hire.salary, 0).toLocaleString()}
                  </div>
                  <div className="text-sm font-semibold text-gray-600">Total Salary</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                  <div className="text-2xl font-black text-gray-900 mb-1">
                    ${filteredHires.reduce((sum, hire) => sum + Math.round(hire.salary * 0.15), 0).toLocaleString()}
                  </div>
                  <div className="text-sm font-semibold text-gray-600">Total Commission</div>
                </div>
              </div>
            </div>
            
            {/* Hires by Recruiter */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-6">Hires by Recruiter</h3>
              
              {hiresReportData.length > 0 ? (
                <div className="space-y-4">
                  {hiresReportData
                    .filter(recruiterData => {
                      // Filter by selected recruiter
                      if (hiresRecruiterFilter && recruiterData.id !== hiresRecruiterFilter) {
                        return false;
                      }
                      
                      // Check if any hires match the date range
                      const hiresInRange = recruiterData.hires.filter((hire: any) => {
                        const hireDate = new Date(hire.hire_date);
                        const startDate = new Date(hiresDateRange.start);
                        const endDate = new Date(hiresDateRange.end);
                        endDate.setHours(23, 59, 59); // Set to end of day
                        
                        return hireDate >= startDate && hireDate <= endDate;
                      });
                      
                      return hiresInRange.length > 0;
                    })
                    .map(recruiterData => {
                      // Filter hires by date range
                      const hiresInRange = recruiterData.hires.filter((hire: any) => {
                        const hireDate = new Date(hire.hire_date);
                        const startDate = new Date(hiresDateRange.start);
                        const endDate = new Date(hiresDateRange.end);
                        endDate.setHours(23, 59, 59); // Set to end of day
                        
                        return hireDate >= startDate && hireDate <= endDate;
                      });
                      
                      // Calculate totals for filtered hires
                      const totalSalary = hiresInRange.reduce((sum: number, hire: any) => sum + hire.salary, 0);
                      const totalCommission = Math.round(totalSalary * 0.15);
                      
                      const isExpanded = hiresExpandedRows[recruiterData.id] || false;
                      
                      return (
                        <div key={recruiterData.id} className="border border-gray-200 rounded-xl overflow-hidden">
                          {/* Recruiter Summary Row */}
                          <div 
                            className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => toggleHiresExpandedRow(recruiterData.id)}
                          >
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                                {recruiterData.name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{recruiterData.name}</div>
                                <div className="text-sm text-gray-600">{hiresInRange.length} hires in selected period</div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-8">
                              <div className="text-right">
                                <div className="text-sm text-gray-500">Total Salary</div>
                                <div className="font-semibold text-gray-900">${totalSalary.toLocaleString()}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-500">Commission</div>
                                <div className="font-semibold text-emerald-600">${totalCommission.toLocaleString()}</div>
                              </div>
                              <div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="p-4 border-t border-gray-200">
                              <table className="w-full">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Role</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hire Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Commission</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {hiresInRange.map((hire: any) => (
                                    <tr key={hire.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-2">
                                            {hire.assignment.developer.name.split(' ').map((n: string) => n[0]).join('')}
                                          </div>
                                          <div className="text-sm text-gray-900">
                                            {hire.assignment.developer.name}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                        {hire.assignment.job_role.title}
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                        ${hire.salary.toLocaleString()}
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(hire.hire_date).toLocaleDateString()}
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-emerald-600">
                                        ${Math.round(hire.salary * 0.15).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Hires Found</h3>
                  <p className="text-gray-600">
                    {hiresDateRange.start !== new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0] ||
                     hiresDateRange.end !== new Date().toISOString().split('T')[0] ||
                     hiresRecruiterFilter
                      ? "No hires match your filter criteria" 
                      : "There are no hires in the system yet"}
                  </p>
                  {(hiresDateRange.start !== new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0] ||
                    hiresDateRange.end !== new Date().toISOString().split('T')[0] ||
                    hiresRecruiterFilter) && (
                    <button 
                      onClick={() => {
                        setHiresDateRange({
                          start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
                          end: new Date().toISOString().split('T')[0]
                        });
                        setHiresRecruiterFilter(null);
                      }}
                      className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Developer Profile Modal */}
        {showDeveloperProfile && selectedDeveloperId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowDeveloperProfile(false);
                    setSelectedDeveloperId(null);
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Dashboard
                </button>
              </div>
              <div className="p-6">
                <DeveloperProfileDetails
                  developerId={selectedDeveloperId}
                  onClose={() => {
                    setShowDeveloperProfile(false);
                    setSelectedDeveloperId(null);
                  }}
                  onSendMessage={(developerId, developerName) => {
                    setShowDeveloperProfile(false);
                    setSelectedDeveloperId(null);
                    handleSendMessage(developerId, developerName, 'developer');
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Recruiter Profile Modal */}
        {showRecruiterProfile && selectedRecruiterId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowRecruiterProfile(false);
                    setSelectedRecruiterId(null);
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Dashboard
                </button>
              </div>
              <div className="p-6">
                <RecruiterProfileDetails
                  recruiterId={selectedRecruiterId}
                  onClose={() => {
                    setShowRecruiterProfile(false);
                    setSelectedRecruiterId(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Job Details Modal */}
        {showJobDetails && selectedJobId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowJobDetails(false);
                    setSelectedJobId(null);
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Dashboard
                </button>
              </div>
              <div className="p-6">
                <JobRoleDetails
                  jobRoleId={selectedJobId}
                  onClose={() => {
                    setShowJobDetails(false);
                    setSelectedJobId(null);
                  }}
                  onAssignDeveloper={() => {
                    setShowJobDetails(false);
                    setShowAssignDeveloperModal(true);
                  }}
                  onSendMessage={(developerId, developerName, jobRoleId, jobRoleTitle) => {
                    setShowJobDetails(false);
                    setSelectedJobId(null);
                    handleSendMessage(developerId, developerName, 'developer');
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Assign Developer Modal */}
        {showAssignDeveloperModal && selectedJobId && (
          <AssignDeveloperModal
            isOpen={showAssignDeveloperModal}
            onClose={() => {
              setShowAssignDeveloperModal(false);
              setSelectedJobId(null);
            }}
            preSelectedJobId={selectedJobId}
            onSuccess={() => {
              setShowAssignDeveloperModal(false);
              setSelectedJobId(null);
              setSuccessMessage('Developer assigned successfully');
              setTimeout(() => setSuccessMessage(''), 3000);
              fetchAssignments();
            }}
          />
        )}
        
        {/* Message Thread Modal */}
        {showMessageThread && selectedMessageUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-2xl flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowMessageThread(false);
                    setSelectedMessageUser(null);
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Dashboard
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <MessageThread
                  otherUserId={selectedMessageUser.id}
                  otherUserName={selectedMessageUser.name}
                  otherUserRole={selectedMessageUser.role}
                  onBack={() => {
                    setShowMessageThread(false);
                    setSelectedMessageUser(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};