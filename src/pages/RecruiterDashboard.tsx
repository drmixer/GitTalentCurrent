import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
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
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Building,
  MapPin,
  DollarSign,
  Calendar
} from 'lucide-react';
import { JobRoleForm } from '../components/JobRoles/JobRoleForm';
import { AssignDeveloperModal } from '../components/Assignments/AssignDeveloperModal';
import { MarkAsHiredModal } from '../components/Hires/MarkAsHiredModal';

interface JobRole {
  id: string;
  title: string;
  description: string;
  location: string;
  job_type: string;
  tech_stack: string[];
  salary_min: number;
  salary_max: number;
  experience_required: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

interface Assignment {
  id: string;
  status: string;
  assigned_at: string;
  updated_at: string;
  notes: string;
  developer: {
    user_id: string;
    name: string;
    email: string;
    github_handle: string;
    bio: string;
    location: string;
    experience_years: number;
    desired_salary: number;
    top_languages: string[];
    availability: boolean;
  };
  job_role: {
    id: string;
    title: string;
    location: string;
    job_type: string;
  };
}

interface Developer {
  user_id: string;
  name: string;
  email: string;
  github_handle: string;
  bio: string;
  location: string;
  experience_years: number;
  desired_salary: number;
  top_languages: string[];
  availability: boolean;
  profile_strength: number;
}

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalAssignments: number;
  hiredCount: number;
}

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'assignments' | 'developers'>('overview');
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    totalAssignments: 0,
    hiredCount: 0
  });
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRole | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedJobForAssign, setSelectedJobForAssign] = useState<string | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [selectedAssignmentForHire, setSelectedAssignmentForHire] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchJobRoles(),
        fetchAssignments(),
        fetchDevelopers()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const { data: jobs } = await supabase
      .from('job_roles')
      .select('id, is_active')
      .eq('recruiter_id', user?.id);

    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, status')
      .eq('recruiter_id', user?.id);

    const { data: hires } = await supabase
      .from('hires')
      .select('id')
      .in('assignment_id', assignments?.map(a => a.id) || []);

    setStats({
      totalJobs: jobs?.length || 0,
      activeJobs: jobs?.filter(j => j.is_active).length || 0,
      totalAssignments: assignments?.length || 0,
      hiredCount: hires?.length || 0
    });
  };

  const fetchJobRoles = async () => {
    const { data, error } = await supabase
      .from('job_roles')
      .select('*')
      .eq('recruiter_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching job roles:', error);
      return;
    }

    setJobRoles(data || []);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        developer:users!assignments_developer_id_fkey(
          id,
          name,
          email,
          developers(
            github_handle,
            bio,
            location,
            experience_years,
            desired_salary,
            top_languages,
            availability
          )
        ),
        job_role:job_roles(
          id,
          title,
          location,
          job_type
        )
      `)
      .eq('recruiter_id', user?.id)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error fetching assignments:', error);
      return;
    }

    const formattedAssignments = data?.map(assignment => ({
      ...assignment,
      developer: {
        user_id: assignment.developer.id,
        name: assignment.developer.name,
        email: assignment.developer.email,
        github_handle: assignment.developer.developers?.[0]?.github_handle || '',
        bio: assignment.developer.developers?.[0]?.bio || '',
        location: assignment.developer.developers?.[0]?.location || '',
        experience_years: assignment.developer.developers?.[0]?.experience_years || 0,
        desired_salary: assignment.developer.developers?.[0]?.desired_salary || 0,
        top_languages: assignment.developer.developers?.[0]?.top_languages || [],
        availability: assignment.developer.developers?.[0]?.availability || false
      }
    })) || [];

    setAssignments(formattedAssignments);
  };

  const fetchDevelopers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        developers(
          github_handle,
          bio,
          location,
          experience_years,
          desired_salary,
          top_languages,
          availability,
          profile_strength
        )
      `)
      .eq('role', 'developer')
      .eq('is_approved', true);

    if (error) {
      console.error('Error fetching developers:', error);
      return;
    }

    const formattedDevelopers = data?.map(dev => ({
      user_id: dev.id,
      name: dev.name,
      email: dev.email,
      github_handle: dev.developers?.[0]?.github_handle || '',
      bio: dev.developers?.[0]?.bio || '',
      location: dev.developers?.[0]?.location || '',
      experience_years: dev.developers?.[0]?.experience_years || 0,
      desired_salary: dev.developers?.[0]?.desired_salary || 0,
      top_languages: dev.developers?.[0]?.top_languages || [],
      availability: dev.developers?.[0]?.availability || false,
      profile_strength: dev.developers?.[0]?.profile_strength || 0
    })).filter(dev => dev.availability) || [];

    setDevelopers(formattedDevelopers);
  };

  const handleJobSubmit = async (jobData: Partial<JobRole>) => {
    try {
      if (editingJob) {
        const { error } = await supabase
          .from('job_roles')
          .update(jobData)
          .eq('id', editingJob.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('job_roles')
          .insert([{ ...jobData, recruiter_id: user?.id }]);

        if (error) throw error;
      }

      await fetchJobRoles();
      await fetchStats();
      setShowJobForm(false);
      setEditingJob(null);
    } catch (error) {
      console.error('Error saving job role:', error);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job role?')) return;

    try {
      const { error } = await supabase
        .from('job_roles')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      await fetchJobRoles();
      await fetchStats();
    } catch (error) {
      console.error('Error deleting job role:', error);
    }
  };

  const handleToggleJobStatus = async (jobId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('job_roles')
        .update({ is_active: !isActive })
        .eq('id', jobId);

      if (error) throw error;

      await fetchJobRoles();
      await fetchStats();
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  };

  const handleAssignDeveloper = (jobId: string) => {
    setSelectedJobForAssign(jobId);
    setShowAssignModal(true);
  };

  const handleAssignmentComplete = async () => {
    setShowAssignModal(false);
    setSelectedJobForAssign(null);
    await fetchAssignments();
    await fetchStats();
  };

  const handleMarkAsHired = (assignmentId: string) => {
    setSelectedAssignmentForHire(assignmentId);
    setShowHireModal(true);
  };

  const handleHireComplete = async () => {
    setShowHireModal(false);
    setSelectedAssignmentForHire(null);
    await fetchAssignments();
    await fetchStats();
  };

  const updateAssignmentStatus = async (assignmentId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status })
        .eq('id', assignmentId);

      if (error) throw error;

      await fetchAssignments();
    } catch (error) {
      console.error('Error updating assignment status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'Contacted': return 'bg-yellow-100 text-yellow-800';
      case 'Shortlisted': return 'bg-purple-100 text-purple-800';
      case 'Hired': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.developer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.job_role.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || assignment.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const filteredDevelopers = developers.filter(dev =>
    dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.top_languages.some(lang => lang.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeJobs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assignments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAssignments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Hires</p>
              <p className="text-2xl font-bold text-gray-900">{stats.hiredCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Assignments</h3>
          </div>
          <div className="p-6">
            {assignments.slice(0, 5).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                <div>
                  <p className="font-medium text-gray-900">{assignment.developer.name}</p>
                  <p className="text-sm text-gray-600">{assignment.job_role.title}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                  {assignment.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Active Job Roles</h3>
          </div>
          <div className="p-6">
            {jobRoles.filter(job => job.is_active).slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                <div>
                  <p className="font-medium text-gray-900">{job.title}</p>
                  <p className="text-sm text-gray-600">{job.location} • {job.job_type}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {job.is_featured && <Star className="h-4 w-4 text-yellow-500" />}
                  <span className="text-xs text-gray-500">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderJobs = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Job Roles</h2>
        <button
          onClick={() => setShowJobForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create Job</span>
        </button>
      </div>

      {jobRoles.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No job roles yet</h3>
          <p className="text-gray-600 mb-4">Create your first job role to start finding developers.</p>
          <button
            onClick={() => setShowJobForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Job Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobRoles.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                      {job.is_featured && <Star className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Building className="h-4 w-4" />
                        <span>{job.job_type}</span>
                      </div>
                      {job.salary_min > 0 && (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4" />
                          <span>${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      job.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {job.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{job.description}</p>

                {job.tech_stack.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {job.tech_stack.slice(0, 5).map((tech, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {tech}
                        </span>
                      ))}
                      {job.tech_stack.length > 5 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{job.tech_stack.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>Created {new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleAssignDeveloper(job.id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Assign Developer"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingJob(job);
                        setShowJobForm(true);
                      }}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleJobStatus(job.id, job.is_active)}
                      className={`p-1 ${job.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                      title={job.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {job.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAssignments = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-900">Assignments</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Hired">Hired</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
          <p className="text-gray-600">Start by creating job roles and assigning developers to them.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Developer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {assignment.developer.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {assignment.developer.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {assignment.developer.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {assignment.job_role.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        {assignment.job_role.location} • {assignment.job_role.job_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={assignment.status}
                        onChange={(e) => updateAssignmentStatus(assignment.id, e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${getStatusColor(assignment.status)}`}
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Shortlisted">Shortlisted</option>
                        <option value="Hired">Hired</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {assignment.status === 'Shortlisted' && (
                          <button
                            onClick={() => handleMarkAsHired(assignment.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Mark as Hired"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
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
    </div>
  );

  const renderDevelopers = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-900">Available Developers</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search developers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredDevelopers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No developers found</h3>
          <p className="text-gray-600">No available developers match your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevelopers.map((developer) => (
            <div key={developer.user_id} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-lg font-medium text-blue-600">
                    {developer.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{developer.name}</h3>
                  <p className="text-sm text-gray-600">{developer.location}</p>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Available</span>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-3">{developer.bio}</p>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Experience:</span>
                  <span className="font-medium">{developer.experience_years} years</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Desired Salary:</span>
                  <span className="font-medium">${developer.desired_salary.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Profile Strength:</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${developer.profile_strength}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium">{developer.profile_strength}%</span>
                  </div>
                </div>
              </div>

              {developer.top_languages.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Top Languages:</p>
                  <div className="flex flex-wrap gap-2">
                    {developer.top_languages.slice(0, 3).map((lang, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {lang}
                      </span>
                    ))}
                    {developer.top_languages.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{developer.top_languages.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-2">
                  {developer.github_handle && (
                    <a
                      href={`https://github.com/${developer.github_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-800"
                      title="GitHub Profile"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                      </svg>
                    </a>
                  )}
                </div>
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  title="View Profile"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Recruiter Dashboard</h1>
          <p className="text-gray-600">Manage your job roles, assignments, and find the perfect developers.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: TrendingUp },
              { id: 'jobs', name: 'Job Roles', icon: Briefcase },
              { id: 'assignments', name: 'Assignments', icon: Users },
              { id: 'developers', name: 'Developers', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'assignments' && renderAssignments()}
        {activeTab === 'developers' && renderDevelopers()}

        {/* Modals */}
        {showJobForm && (
          <JobRoleForm
            job={editingJob}
            onSubmit={handleJobSubmit}
            onCancel={() => {
              setShowJobForm(false);
              setEditingJob(null);
            }}
          />
        )}

        {showAssignModal && selectedJobForAssign && (
          <AssignDeveloperModal
            jobRoleId={selectedJobForAssign}
            onAssign={handleAssignmentComplete}
            onCancel={() => {
              setShowAssignModal(false);
              setSelectedJobForAssign(null);
            }}
          />
        )}

        {showHireModal && selectedAssignmentForHire && (
          <MarkAsHiredModal
            assignmentId={selectedAssignmentForHire}
            onHire={handleHireComplete}
            onCancel={() => {
              setShowHireModal(false);
              setSelectedAssignmentForHire(null);
            }}
          />
        )}
      </div>
    </div>
  );
};