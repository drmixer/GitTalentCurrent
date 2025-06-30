import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Briefcase, 
  UserPlus, 
  CheckCircle, 
  Loader, 
  AlertCircle,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  X,
  Plus,
  Building,
  Code,
  MessageSquare,
  Clock,
  DollarSign,
  Calendar,
  ArrowLeft,
  RefreshCw,
  FileText
} from 'lucide-react';
import { DeveloperProfileDetails } from '../components/Profile/DeveloperProfileDetails';
import { RecruiterProfileDetails } from '../components/Profile/RecruiterProfileDetails';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { AssignDeveloperModal } from '../components/Assignments/AssignDeveloperModal';
import { MarkAsHiredModal } from '../components/Hires/MarkAsHiredModal';
import { JobRoleForm } from '../components/JobRoles/JobRoleForm';
import { User, Developer, Recruiter, JobRole, Assignment, Hire } from '../types';

export const AdminDashboard: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('recruiters');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Recruiters tab state
  const [recruiters, setRecruiters] = useState<(User & { recruiter: Recruiter })[]>([]);
  const [pendingRecruiters, setPendingRecruiters] = useState<(User & { recruiter: Recruiter })[]>([]);
  const [approvedRecruiters, setApprovedRecruiters] = useState<(User & { recruiter: Recruiter })[]>([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState<string | null>(null);
  const [showRecruiterDetails, setShowRecruiterDetails] = useState(false);
  const [recruiterSearchTerm, setRecruiterSearchTerm] = useState('');

  // Developers tab state
  const [developers, setDevelopers] = useState<(User & { developer: Developer })[]>([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState<string | null>(null);
  const [showDeveloperDetails, setShowDeveloperDetails] = useState(false);
  const [showAssignDeveloperModal, setShowAssignDeveloperModal] = useState(false);
  const [developerSearchTerm, setDeveloperSearchTerm] = useState('');
  const [filterAvailableDevelopers, setFilterAvailableDevelopers] = useState<boolean | null>(null);

  // Job roles tab state
  const [jobRoles, setJobRoles] = useState<(JobRole & { recruiter: User })[]>([]);
  const [selectedJobRole, setSelectedJobRole] = useState<JobRole | null>(null);
  const [showJobRoleDetails, setShowJobRoleDetails] = useState(false);
  const [showJobRoleForm, setShowJobRoleForm] = useState(false);
  const [jobRoleSearchTerm, setJobRoleSearchTerm] = useState('');
  const [filterActiveJobs, setFilterActiveJobs] = useState<boolean | null>(null);

  // Assignments tab state
  const [assignments, setAssignments] = useState<(Assignment & { 
    developer: User, 
    recruiter: User, 
    job_role: JobRole 
  })[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<string | null>(null);

  // Hires tab state
  const [hires, setHires] = useState<(Hire & { 
    assignment: Assignment & { 
      developer: User, 
      recruiter: User, 
      job_role: JobRole 
    } 
  })[]>([]);
  const [hireSearchTerm, setHireSearchTerm] = useState('');
  const [filterHireDate, setFilterHireDate] = useState<{start?: string, end?: string}>({});
  const [filterHireRecruiter, setFilterHireRecruiter] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchData();
    }
  }, [userProfile]);

  useEffect(() => {
    // Filter recruiters when search term changes
    if (recruiters.length > 0) {
      const filtered = recruiters.filter(recruiter => 
        recruiter.name.toLowerCase().includes(recruiterSearchTerm.toLowerCase()) ||
        recruiter.email.toLowerCase().includes(recruiterSearchTerm.toLowerCase()) ||
        recruiter.recruiter.company_name.toLowerCase().includes(recruiterSearchTerm.toLowerCase())
      );
      
      setPendingRecruiters(filtered.filter(r => !r.is_approved));
      setApprovedRecruiters(filtered.filter(r => r.is_approved));
    }
  }, [recruiters, recruiterSearchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch data based on active tab
      switch (activeTab) {
        case 'recruiters':
          await fetchRecruiters();
          break;
        case 'developers':
          await fetchDevelopers();
          break;
        case 'jobs':
          await fetchJobRoles();
          break;
        case 'assignments':
          await fetchAssignments();
          break;
        case 'hires':
          await fetchHires();
          break;
        default:
          await fetchRecruiters();
      }
    } catch (error: any) {
      console.error(`Error fetching ${activeTab} data:`, error);
      setError(error.message || `Failed to load ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecruiters = async () => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        recruiter:recruiters(*)
      `)
      .eq('role', 'recruiter')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setRecruiters(data || []);
    setPendingRecruiters(data?.filter(r => !r.is_approved) || []);
    setApprovedRecruiters(data?.filter(r => r.is_approved) || []);
  };

  const fetchDevelopers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        developer:developers(*)
      `)
      .eq('role', 'developer')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setDevelopers(data || []);
  };

  const fetchJobRoles = async () => {
    const { data, error } = await supabase
      .from('job_roles')
      .select(`
        *,
        recruiter:users!job_roles_recruiter_id_fkey(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setJobRoles(data || []);
  };

  const fetchAssignments = async () => {
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
  };

  const fetchHires = async () => {
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
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setLoading(true);
    
    // Reset search terms and filters when changing tabs
    setRecruiterSearchTerm('');
    setDeveloperSearchTerm('');
    setJobRoleSearchTerm('');
    setAssignmentSearchTerm('');
    setHireSearchTerm('');
    setFilterAvailableDevelopers(null);
    setFilterActiveJobs(null);
    setFilterAssignmentStatus(null);
    setFilterHireDate({});
    setFilterHireRecruiter(null);
    
    fetchData();
  };

  const handleApproveRecruiter = async (recruiterId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_approved: true })
        .eq('id', recruiterId);

      if (error) throw error;
      
      setSuccessMessage('Recruiter approved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Update local state
      setRecruiters(prev => 
        prev.map(r => 
          r.id === recruiterId ? { ...r, is_approved: true } : r
        )
      );
      setPendingRecruiters(prev => prev.filter(r => r.id !== recruiterId));
      setApprovedRecruiters(prev => [
        ...prev, 
        recruiters.find(r => r.id === recruiterId)!
      ]);
    } catch (error: any) {
      console.error('Error approving recruiter:', error);
      setError(error.message || 'Failed to approve recruiter');
    }
  };

  const handleDeactivateRecruiter = async (recruiterId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_approved: false })
        .eq('id', recruiterId);

      if (error) throw error;
      
      setSuccessMessage('Recruiter deactivated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Update local state
      setRecruiters(prev => 
        prev.map(r => 
          r.id === recruiterId ? { ...r, is_approved: false } : r
        )
      );
      setApprovedRecruiters(prev => prev.filter(r => r.id !== recruiterId));
      setPendingRecruiters(prev => [
        ...prev, 
        recruiters.find(r => r.id === recruiterId)!
      ]);
    } catch (error: any) {
      console.error('Error deactivating recruiter:', error);
      setError(error.message || 'Failed to deactivate recruiter');
    }
  };

  const handleDeleteJobRole = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job role? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('job_roles')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
      
      setSuccessMessage('Job role deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Update local state
      setJobRoles(prev => prev.filter(job => job.id !== jobId));
    } catch (error: any) {
      console.error('Error deleting job role:', error);
      setError(error.message || 'Failed to delete job role');
    }
  };

  const handleToggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('job_roles')
        .update({ is_active: !currentStatus })
        .eq('id', jobId);

      if (error) throw error;
      
      setSuccessMessage(`Job ${!currentStatus ? 'activated' : 'paused'} successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Update local state
      setJobRoles(prev => 
        prev.map(job => 
          job.id === jobId ? { ...job, is_active: !currentStatus } : job
        )
      );
    } catch (error: any) {
      console.error('Error toggling job status:', error);
      setError(error.message || 'Failed to update job status');
    }
  };

  const handleUpdateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('id', assignmentId);

      if (error) throw error;
      
      setSuccessMessage(`Assignment status updated to ${newStatus}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Update local state
      setAssignments(prev => 
        prev.map(assignment => 
          assignment.id === assignmentId ? { ...assignment, status: newStatus } : assignment
        )
      );
    } catch (error: any) {
      console.error('Error updating assignment status:', error);
      setError(error.message || 'Failed to update assignment status');
    }
  };

  const handleExportHiresCSV = () => {
    // Filter hires based on current filters
    const filteredHires = hires.filter(hire => {
      const matchesSearch = !hireSearchTerm || 
        hire.assignment.developer.name.toLowerCase().includes(hireSearchTerm.toLowerCase()) ||
        hire.assignment.job_role.title.toLowerCase().includes(hireSearchTerm.toLowerCase()) ||
        hire.assignment.recruiter.name.toLowerCase().includes(hireSearchTerm.toLowerCase());
      
      const matchesRecruiter = !filterHireRecruiter || hire.assignment.recruiter_id === filterHireRecruiter;
      
      const matchesDateRange = 
        (!filterHireDate.start || new Date(hire.hire_date) >= new Date(filterHireDate.start)) &&
        (!filterHireDate.end || new Date(hire.hire_date) <= new Date(filterHireDate.end));
      
      return matchesSearch && matchesRecruiter && matchesDateRange;
    });
    
    // Create CSV content
    const headers = ['Developer', 'Job Title', 'Recruiter', 'Company', 'Salary', 'Hire Date', 'Start Date'];
    const rows = filteredHires.map(hire => [
      hire.assignment.developer.name,
      hire.assignment.job_role.title,
      hire.assignment.recruiter.name,
      hire.assignment.recruiter.company_name,
      hire.salary,
      new Date(hire.hire_date).toLocaleDateString(),
      hire.start_date ? new Date(hire.start_date).toLocaleDateString() : 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hires_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter developers based on search term and availability
  const filteredDevelopers = developers.filter(dev => {
    const matchesSearch = !developerSearchTerm || 
      dev.name.toLowerCase().includes(developerSearchTerm.toLowerCase()) ||
      dev.email.toLowerCase().includes(developerSearchTerm.toLowerCase()) ||
      dev.developer?.github_handle?.toLowerCase().includes(developerSearchTerm.toLowerCase()) ||
      dev.developer?.top_languages?.some(lang => lang.toLowerCase().includes(developerSearchTerm.toLowerCase()));
    
    const matchesAvailability = filterAvailableDevelopers === null || 
      dev.developer?.availability === filterAvailableDevelopers;
    
    return matchesSearch && matchesAvailability;
  });

  // Filter job roles based on search term and active status
  const filteredJobRoles = jobRoles.filter(job => {
    const matchesSearch = !jobRoleSearchTerm || 
      job.title.toLowerCase().includes(jobRoleSearchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(jobRoleSearchTerm.toLowerCase()) ||
      job.recruiter?.name?.toLowerCase().includes(jobRoleSearchTerm.toLowerCase()) ||
      job.tech_stack?.some(tech => tech.toLowerCase().includes(jobRoleSearchTerm.toLowerCase()));
    
    const matchesActive = filterActiveJobs === null || job.is_active === filterActiveJobs;
    
    return matchesSearch && matchesActive;
  });

  // Filter assignments based on search term and status
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = !assignmentSearchTerm || 
      assignment.developer?.name?.toLowerCase().includes(assignmentSearchTerm.toLowerCase()) ||
      assignment.recruiter?.name?.toLowerCase().includes(assignmentSearchTerm.toLowerCase()) ||
      assignment.job_role?.title?.toLowerCase().includes(assignmentSearchTerm.toLowerCase());
    
    const matchesStatus = !filterAssignmentStatus || assignment.status === filterAssignmentStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Filter hires based on search term, date range, and recruiter
  const filteredHires = hires.filter(hire => {
    const matchesSearch = !hireSearchTerm || 
      hire.assignment?.developer?.name?.toLowerCase().includes(hireSearchTerm.toLowerCase()) ||
      hire.assignment?.recruiter?.name?.toLowerCase().includes(hireSearchTerm.toLowerCase()) ||
      hire.assignment?.job_role?.title?.toLowerCase().includes(hireSearchTerm.toLowerCase());
    
    const matchesRecruiter = !filterHireRecruiter || hire.assignment?.recruiter_id === filterHireRecruiter;
    
    const matchesDateRange = 
      (!filterHireDate.start || new Date(hire.hire_date) >= new Date(filterHireDate.start)) &&
      (!filterHireDate.end || new Date(hire.hire_date) <= new Date(filterHireDate.end));
    
    return matchesSearch && matchesRecruiter && matchesDateRange;
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, job roles, assignments, and view reports</p>
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
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
          <button
            onClick={() => handleTabChange('recruiters')}
            className={`flex items-center whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'recruiters'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building className="w-5 h-5 mr-2" />
            Recruiters
            {pendingRecruiters.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {pendingRecruiters.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('developers')}
            className={`flex items-center whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'developers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Code className="w-5 h-5 mr-2" />
            Developers
          </button>
          <button
            onClick={() => handleTabChange('jobs')}
            className={`flex items-center whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'jobs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Briefcase className="w-5 h-5 mr-2" />
            Job Roles
          </button>
          <button
            onClick={() => handleTabChange('assignments')}
            className={`flex items-center whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Assignments
          </button>
          <button
            onClick={() => handleTabChange('hires')}
            className={`flex items-center whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'hires'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Hires Report
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
            <span className="text-gray-600 font-medium">Loading data...</span>
          </div>
        ) : (
          <>
            {/* Recruiters Tab */}
            {activeTab === 'recruiters' && (
              <div className="space-y-8">
                {/* Pending Recruiters */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Pending Approval</h2>
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

                  {pendingRecruiters.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pendingRecruiters.map((recruiter) => (
                              <tr key={recruiter.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                      {recruiter.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{recruiter.name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{recruiter.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{recruiter.recruiter?.company_name || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">{new Date(recruiter.created_at).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center space-x-3">
                                    <button
                                      onClick={() => {
                                        setSelectedRecruiter(recruiter.id);
                                        setShowRecruiterDetails(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-900 font-medium"
                                    >
                                      <Eye className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => handleApproveRecruiter(recruiter.id)}
                                      className="text-green-600 hover:text-green-900 font-medium"
                                    >
                                      <CheckCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeactivateRecruiter(recruiter.id)}
                                      className="text-red-600 hover:text-red-900 font-medium"
                                    >
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {pendingRecruiters.length === 0 && recruiterSearchTerm && (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No pending recruiters match your search</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                      <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Recruiters</h3>
                      <p className="text-gray-500">
                        {recruiterSearchTerm 
                          ? "No pending recruiters match your search" 
                          : "All recruiters have been reviewed"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Approved Recruiters */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Approved Recruiters</h2>
                  
                  {approvedRecruiters.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {approvedRecruiters.map((recruiter) => (
                              <tr key={recruiter.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                      {recruiter.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{recruiter.name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{recruiter.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{recruiter.recruiter?.company_name || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">{new Date(recruiter.created_at).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center space-x-3">
                                    <button
                                      onClick={() => {
                                        setSelectedRecruiter(recruiter.id);
                                        setShowRecruiterDetails(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-900 font-medium"
                                    >
                                      <Eye className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeactivateRecruiter(recruiter.id)}
                                      className="text-red-600 hover:text-red-900 font-medium"
                                    >
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {approvedRecruiters.length === 0 && recruiterSearchTerm && (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No approved recruiters match your search</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                      <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Approved Recruiters</h3>
                      <p className="text-gray-500">
                        {recruiterSearchTerm 
                          ? "No approved recruiters match your search" 
                          : "Approve recruiters to see them here"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Developers Tab */}
            {activeTab === 'developers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Developers</h2>
                  <div className="flex items-center space-x-4">
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
                        value={filterAvailableDevelopers === null ? 'all' : filterAvailableDevelopers.toString()}
                        onChange={(e) => setFilterAvailableDevelopers(e.target.value === 'all' ? null : e.target.value === 'true')}
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value="all">All Developers</option>
                        <option value="true">Available Only</option>
                        <option value="false">Unavailable Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {filteredDevelopers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDevelopers.map((developer) => (
                      <div key={developer.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                              {developer.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="ml-4">
                              <h3 className="text-lg font-bold text-gray-900">{developer.name}</h3>
                              <div className="flex items-center space-x-2">
                                {developer.developer?.github_handle && (
                                  <span className="text-sm text-gray-600">@{developer.developer.github_handle}</span>
                                )}
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                  developer.developer?.availability 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  <div className={`w-2 h-2 rounded-full mr-1 ${
                                    developer.developer?.availability ? 'bg-emerald-500' : 'bg-gray-500'
                                  }`}></div>
                                  {developer.developer?.availability ? 'Available' : 'Busy'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Experience:</span> {developer.developer?.experience_years || 0} years
                          </div>
                          {developer.developer?.location && (
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Location:</span> {developer.developer.location}
                            </div>
                          )}
                          {developer.developer?.desired_salary > 0 && (
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Desired Salary:</span> ${developer.developer.desired_salary.toLocaleString()}
                            </div>
                          )}
                        </div>
                        
                        {developer.developer?.top_languages && developer.developer.top_languages.length > 0 && (
                          <div className="mb-4">
                            <div className="text-sm font-medium text-gray-700 mb-2">Top Languages:</div>
                            <div className="flex flex-wrap gap-2">
                              {developer.developer.top_languages.slice(0, 5).map((lang, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                                  {lang}
                                </span>
                              ))}
                              {developer.developer.top_languages.length > 5 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg">
                                  +{developer.developer.top_languages.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={() => {
                              setSelectedDeveloper(developer.id);
                              setShowDeveloperDetails(true);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                          >
                            <Eye className="w-4 h-4 mr-2 inline" />
                            View Profile
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDeveloper(developer.id);
                              setShowAssignDeveloperModal(true);
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm"
                          >
                            <UserPlus className="w-4 h-4 mr-2 inline" />
                            Assign to Job
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <Code className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Developers Found</h3>
                    <p className="text-gray-500">
                      {developerSearchTerm || filterAvailableDevelopers !== null
                        ? "No developers match your search criteria"
                        : "There are no developers registered in the system"}
                    </p>
                    {(developerSearchTerm || filterAvailableDevelopers !== null) && (
                      <button
                        onClick={() => {
                          setDeveloperSearchTerm('');
                          setFilterAvailableDevelopers(null);
                        }}
                        className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Job Roles Tab */}
            {activeTab === 'jobs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Job Roles</h2>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search job roles..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        value={jobRoleSearchTerm}
                        onChange={(e) => setJobRoleSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="w-5 h-5 text-gray-400" />
                      <select
                        value={filterActiveJobs === null ? 'all' : filterActiveJobs.toString()}
                        onChange={(e) => setFilterActiveJobs(e.target.value === 'all' ? null : e.target.value === 'true')}
                        className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value="all">All Jobs</option>
                        <option value="true">Active Only</option>
                        <option value="false">Inactive Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {filteredJobRoles.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recruiter</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary Range</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredJobRoles.map((job) => (
                            <tr key={job.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{job.title}</div>
                                <div className="text-xs text-gray-500">{job.job_type}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{job.recruiter?.name || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{job.recruiter?.email || ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{job.location}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">${job.salary_min}k - ${job.salary_max}k</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  job.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {job.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={() => {
                                      setSelectedJobRole(job);
                                      setShowJobRoleDetails(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedJobRole(job);
                                      setShowJobRoleForm(true);
                                    }}
                                    className="text-green-600 hover:text-green-900"
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteJobRole(job.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleJobStatus(job.id, job.is_active)}
                                    className={`${
                                      job.is_active ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'
                                    }`}
                                  >
                                    {job.is_active ? (
                                      <Clock className="w-5 h-5" />
                                    ) : (
                                      <CheckCircle className="w-5 h-5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredJobRoles.length === 0 && jobRoleSearchTerm && (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No job roles match your search</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Job Roles Found</h3>
                    <p className="text-gray-500">
                      {jobRoleSearchTerm || filterActiveJobs !== null
                        ? "No job roles match your search criteria"
                        : "There are no job roles in the system"}
                    </p>
                    {(jobRoleSearchTerm || filterActiveJobs !== null) && (
                      <button
                        onClick={() => {
                          setJobRoleSearchTerm('');
                          setFilterActiveJobs(null);
                        }}
                        className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Assignments Tab */}
            {activeTab === 'assignments' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Assignments</h2>
                  <div className="flex items-center space-x-4">
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
                        value={filterAssignmentStatus || ''}
                        onChange={(e) => setFilterAssignmentStatus(e.target.value || null)}
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
                      onClick={() => setShowAssignDeveloperModal(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                    >
                      <UserPlus className="w-4 h-4 mr-2 inline" />
                      New Assignment
                    </button>
                  </div>
                </div>

                {filteredAssignments.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Developer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recruiter</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredAssignments.map((assignment) => (
                            <tr key={assignment.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    {assignment.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900">{assignment.developer?.name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-500">{assignment.developer?.email || ''}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{assignment.job_role?.title || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{assignment.job_role?.location || ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{assignment.recruiter?.name || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{assignment.recruiter?.email || ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  assignment.status === 'Hired' ? 'bg-green-100 text-green-800' :
                                  assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                                  assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                                  assignment.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {assignment.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{new Date(assignment.assigned_at).toLocaleDateString()}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-3">
                                  <select
                                    value={assignment.status}
                                    onChange={(e) => handleUpdateAssignmentStatus(assignment.id, e.target.value)}
                                    className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                  >
                                    <option value="New">New</option>
                                    <option value="Contacted">Contacted</option>
                                    <option value="Shortlisted">Shortlisted</option>
                                    <option value="Hired">Hired</option>
                                    <option value="Rejected">Rejected</option>
                                  </select>
                                  {assignment.status === 'Shortlisted' && (
                                    <button
                                      onClick={() => {
                                        setSelectedAssignment(assignment);
                                        setShowHireModal(true);
                                      }}
                                      className="text-green-600 hover:text-green-900"
                                    >
                                      <CheckCircle className="w-5 h-5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredAssignments.length === 0 && (assignmentSearchTerm || filterAssignmentStatus) && (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No assignments match your search</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments Found</h3>
                    <p className="text-gray-500">
                      {assignmentSearchTerm || filterAssignmentStatus
                        ? "No assignments match your search criteria"
                        : "There are no assignments in the system"}
                    </p>
                    {(assignmentSearchTerm || filterAssignmentStatus) && (
                      <button
                        onClick={() => {
                          setAssignmentSearchTerm('');
                          setFilterAssignmentStatus(null);
                        }}
                        className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Hires Report Tab */}
            {activeTab === 'hires' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Hires Report</h2>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search hires..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        value={hireSearchTerm}
                        onChange={(e) => setHireSearchTerm(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={handleExportHiresCSV}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      <Download className="w-4 h-4 mr-2 inline" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Filters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">From</label>
                          <input
                            type="date"
                            value={filterHireDate.start || ''}
                            onChange={(e) => setFilterHireDate(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">To</label>
                          <input
                            type="date"
                            value={filterHireDate.end || ''}
                            onChange={(e) => setFilterHireDate(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Recruiter</label>
                      <select
                        value={filterHireRecruiter || ''}
                        onChange={(e) => setFilterHireRecruiter(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value="">All Recruiters</option>
                        {Array.from(new Set(hires.map(hire => hire.assignment?.recruiter_id))).map(recruiterId => {
                          const recruiter = hires.find(h => h.assignment?.recruiter_id === recruiterId)?.assignment?.recruiter;
                          return (
                            <option key={recruiterId} value={recruiterId}>
                              {recruiter?.name || 'Unknown'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setHireSearchTerm('');
                          setFilterHireDate({});
                          setFilterHireRecruiter(null);
                        }}
                        className="w-full px-3 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      >
                        <RefreshCw className="w-4 h-4 mr-2 inline" />
                        Reset Filters
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hires Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Total Hires</h3>
                    <p className="text-3xl font-bold text-gray-900">{filteredHires.length}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Average Salary</h3>
                    <p className="text-3xl font-bold text-gray-900">
                      ${filteredHires.length > 0 
                        ? Math.round(filteredHires.reduce((sum, hire) => sum + hire.salary, 0) / filteredHires.length).toLocaleString()
                        : 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Total Revenue</h3>
                    <p className="text-3xl font-bold text-gray-900">
                      ${filteredHires.reduce((sum, hire) => sum + Math.round(hire.salary * 0.15), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Based on 15% commission</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Active Recruiters</h3>
                    <p className="text-3xl font-bold text-gray-900">
                      {new Set(filteredHires.map(hire => hire.assignment?.recruiter_id)).size}
                    </p>
                  </div>
                </div>

                {filteredHires.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Developer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recruiter</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hire Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredHires.map((hire) => (
                            <tr key={hire.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    {hire.assignment?.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900">{hire.assignment?.developer?.name || 'Unknown'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{hire.assignment?.job_role?.title || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{hire.assignment?.job_role?.location || ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{hire.assignment?.recruiter?.name || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{hire.assignment?.recruiter?.company_name || ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">${hire.salary.toLocaleString()}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-green-600">${Math.round(hire.salary * 0.15).toLocaleString()}</div>
                                <div className="text-xs text-gray-500">15%</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{new Date(hire.hire_date).toLocaleDateString()}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
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
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Hires Found</h3>
                    <p className="text-gray-500">
                      {hireSearchTerm || filterHireDate.start || filterHireDate.end || filterHireRecruiter
                        ? "No hires match your search criteria"
                        : "There are no hires recorded in the system"}
                    </p>
                    {(hireSearchTerm || filterHireDate.start || filterHireDate.end || filterHireRecruiter) && (
                      <button
                        onClick={() => {
                          setHireSearchTerm('');
                          setFilterHireDate({});
                          setFilterHireRecruiter(null);
                        }}
                        className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Recruiter Details Modal */}
        {showRecruiterDetails && selectedRecruiter && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowRecruiterDetails(false);
                    setSelectedRecruiter(null);
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Recruiters
                </button>
              </div>
              <div className="p-6">
                <RecruiterProfileDetails
                  recruiterId={selectedRecruiter}
                  onClose={() => {
                    setShowRecruiterDetails(false);
                    setSelectedRecruiter(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Developer Details Modal */}
        {showDeveloperDetails && selectedDeveloper && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowDeveloperDetails(false);
                    setSelectedDeveloper(null);
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Developers
                </button>
              </div>
              <div className="p-6">
                <DeveloperProfileDetails
                  developerId={selectedDeveloper}
                  onClose={() => {
                    setShowDeveloperDetails(false);
                    setSelectedDeveloper(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Job Role Details Modal */}
        {showJobRoleDetails && selectedJobRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowJobRoleDetails(false);
                    setSelectedJobRole(null);
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Job Roles
                </button>
              </div>
              <div className="p-6">
                <JobRoleDetails
                  jobRoleId={selectedJobRole.id}
                  jobRole={selectedJobRole}
                  onClose={() => {
                    setShowJobRoleDetails(false);
                    setSelectedJobRole(null);
                  }}
                  onEdit={() => {
                    setShowJobRoleDetails(false);
                    setShowJobRoleForm(true);
                  }}
                  onAssignDeveloper={() => {
                    setShowJobRoleDetails(false);
                    setShowAssignDeveloperModal(true);
                  }}
                  onJobRoleUpdated={() => {
                    setShowJobRoleDetails(false);
                    setSelectedJobRole(null);
                    fetchJobRoles();
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Job Role Form Modal */}
        {showJobRoleForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <JobRoleForm
                jobRole={selectedJobRole || undefined}
                onSuccess={() => {
                  setShowJobRoleForm(false);
                  setSelectedJobRole(null);
                  setSuccessMessage(selectedJobRole ? 'Job role updated successfully' : 'Job role created successfully');
                  setTimeout(() => setSuccessMessage(''), 3000);
                  fetchJobRoles();
                }}
                onCancel={() => {
                  setShowJobRoleForm(false);
                  setSelectedJobRole(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Assign Developer Modal */}
        {showAssignDeveloperModal && (
          <AssignDeveloperModal
            isOpen={showAssignDeveloperModal}
            onClose={() => {
              setShowAssignDeveloperModal(false);
              setSelectedDeveloper(null);
              setSelectedJobRole(null);
            }}
            preSelectedDeveloperId={selectedDeveloper || undefined}
            preSelectedJobId={selectedJobRole?.id || undefined}
            onSuccess={() => {
              setShowAssignDeveloperModal(false);
              setSelectedDeveloper(null);
              setSelectedJobRole(null);
              setSuccessMessage('Developer assigned successfully');
              setTimeout(() => setSuccessMessage(''), 3000);
              fetchAssignments();
            }}
          />
        )}

        {/* Hire Modal */}
        {showHireModal && selectedAssignment && (
          <MarkAsHiredModal
            isOpen={showHireModal}
            onClose={() => {
              setShowHireModal(false);
              setSelectedAssignment(null);
            }}
            assignment={selectedAssignment}
            onSuccess={() => {
              setShowHireModal(false);
              setSelectedAssignment(null);
              setSuccessMessage('Developer marked as hired successfully');
              setTimeout(() => setSuccessMessage(''), 3000);
              fetchAssignments();
              fetchHires();
            }}
          />
        )}
      </div>
    </div>
  );
};