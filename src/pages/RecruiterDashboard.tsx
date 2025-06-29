import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { 
  MessageSquare,
  Building, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  UserPlus
} from 'lucide-react';
import { JobRoleForm } from '../components/JobRoles/JobRoleForm';
import { JobRoleDetails } from '../components/JobRoles/JobRoleDetails';
import { AssignDeveloperModal } from '../components/Assignments/AssignDeveloperModal';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { DeveloperList } from '../components/DeveloperList';

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
  created_at: string;
  updated_at: string;
}

interface Assignment {
  id: string;
  developer_id: string;
  job_role_id: string;
  status: string;
  assigned_at: string;
  developer: {
    name: string;
    email: string;
  };
  job_role: {
    title: string;
  };
}

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

export const RecruiterDashboard: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedJobRole, setSelectedJobRole] = useState<JobRole | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeTab, setActiveTab] = useState('jobs');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [selectedDeveloper, setSelectedDeveloper] = useState<string | null>(null);
  const [showDeveloperProfile, setShowDeveloperProfile] = useState(false);
  const [showHireModal, setShowHireModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  console.log('RecruiterDashboard render - authLoading:', authLoading, 'userProfile:', userProfile);

  useEffect(() => {
    console.log('RecruiterDashboard useEffect - user:', user?.id, 'userProfile:', userProfile?.id);
    if (userProfile?.role === 'recruiter') {
      console.log('RecruiterDashboard - Fetching data for recruiter:', userProfile.id);
      fetchJobRoles();
      fetchAssignments();
    }
  }, [userProfile]);

  const fetchJobRoles = async () => {
    try {
      console.log('Fetching job roles for recruiter:', userProfile?.id);
      const { data, error } = await supabase
        .from('job_roles')
        .select('*')
        .eq('recruiter_id', userProfile?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching job roles:', error);
        throw error;
      }
      console.log('Fetched job roles:', data?.length || 0);
      setJobRoles(data || []);
    } catch (error) {
      console.error('Error fetching job roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      console.log('Fetching assignments for recruiter:', userProfile?.id);
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(name, email),
          job_role:job_roles(title)
        `)
        .eq('recruiter_id', userProfile?.id)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  // Handler functions
  const handleJobRoleCreated = () => {
    setShowJobForm(false);
    fetchJobRoles();
  };

  const handleJobRoleUpdated = () => {
    setShowJobDetails(false);
    setSelectedJobRole(null);
    fetchJobRoles();
  };

  const handleAssignmentCreated = () => {
    setShowAssignModal(false);
    setSelectedJobRole(null);
    fetchAssignments();
  };

  const handleViewJobRole = (jobRole: JobRole) => {
    setSelectedJobRole(jobRole);
    setShowJobDetails(true);
  };

  const handleAssignDeveloper = (jobRole: JobRole) => {
    setSelectedJobRole(jobRole);
    setShowAssignModal(true);
  };

  const filteredJobRoles = jobRoles.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.tech_stack.some(tech => tech.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterActive === null || job.is_active === filterActive;
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalJobs: jobRoles.length,
    activeJobs: jobRoles.filter(job => job.is_active).length,
    totalAssignments: assignments.length,
    pendingAssignments: assignments.filter(a => a.status === 'New').length
  };

  const tabs: { id: string; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'jobs', label: 'My Jobs', icon: Briefcase },
    { id: 'developers', label: 'Assigned Developers', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  if (loading) {
    console.log('RecruiterDashboard - Showing loading state');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Fetching your recruiter profile...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!userProfile) {
    console.log('❌ No user profile, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect if not a recruiter
  if (userProfile.role !== 'recruiter') {
    console.log('❌ Not a recruiter role, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Show pending approval message
  if (!userProfile.is_approved) {
    console.log('⚠️ Recruiter not approved yet');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-4">Account Pending Approval</h1>
            <p className="text-gray-600 mb-6">
              Your recruiter account is currently under review by our admin team. 
              You'll receive an email notification once your account is approved and you can access the dashboard.
            </p>
            <div className="text-sm text-gray-500">
              This usually takes 1-2 business days.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const StatsCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  // Job Role Card Component
  const JobRoleCard = ({ job }: { job: JobRole }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              job.is_active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {job.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{job.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>📍 {job.location}</span>
            <span>💼 {job.job_type}</span>
            <span>💰 ${job.salary_min?.toLocaleString()} - ${job.salary_max?.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewJobRole(job)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAssignDeveloper(job)}
            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
            title="Assign Developer"
          >
            <UserPlus className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {job.tech_stack && job.tech_stack.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.tech_stack.slice(0, 4).map((tech, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium"
            >
              {tech}
            </span>
          ))}
          {job.tech_stack.length > 4 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
              +{job.tech_stack.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );

  // Recent Assignments Component
  const RecentAssignments = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Recent Assignments</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {assignments.slice(0, 5).map((assignment) => (
          <div key={assignment.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {assignment.developer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{assignment.developer.name}</p>
                    <p className="text-sm text-gray-500">{assignment.developer.email}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Assigned to: <span className="font-medium">{assignment.job_role.title}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    assignment.status === 'New' ? 'bg-blue-100 text-blue-800' :
                    assignment.status === 'Contacted' ? 'bg-yellow-100 text-yellow-800' :
                    assignment.status === 'Shortlisted' ? 'bg-purple-100 text-purple-800' :
                    assignment.status === 'Hired' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {assignment.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  console.log('RecruiterDashboard - Rendering main UI, activeTab:', activeTab);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Welcome back, {userProfile.name}!
              </h1>
              <p className="text-gray-600">Manage your job postings and connect with top developers</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                <Building className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button 
            onClick={() => setShowJobForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post New Job
          </button>
        </div>

        {/* Tabs */}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
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
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            icon={Briefcase}
            title="Total Jobs"
            value={stats.totalJobs}
            subtitle="All time"
            color="bg-gradient-to-r from-blue-500 to-blue-600"
          />
          <StatsCard
            icon={TrendingUp}
            title="Active Jobs"
            value={stats.activeJobs}
            subtitle="Currently hiring"
            color="bg-gradient-to-r from-green-500 to-green-600"
          />
          <StatsCard
            icon={Users}
            title="Total Assignments"
            value={stats.totalAssignments}
            subtitle="All time"
            color="bg-gradient-to-r from-purple-500 to-purple-600"
          />
          <StatsCard
            icon={UserPlus}
            title="Pending"
            value={stats.pendingAssignments}
            subtitle="Awaiting response"
            color="bg-gradient-to-r from-orange-500 to-orange-600"
          />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-6">Quick Actions</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <button 
                onClick={() => setShowJobForm(true)}
                className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all group"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900">Post New Job</div>
                  <div className="text-sm text-gray-600">Create a new job posting</div>
                </div> 
              </button>
              
              <button 
                onClick={() => setActiveTab('developers')}
                className="flex items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 hover:from-purple-100 hover:to-pink-100 transition-all group"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900">Browse Developers</div>
                  <div className="text-sm text-gray-600">View assigned talent</div>
                </div>
              </button>
              
              <button 
                onClick={() => setActiveTab('messages')}
                className="flex items-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 hover:from-emerald-100 hover:to-teal-100 transition-all group"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900">Check Messages</div>
                  <div className="text-sm text-gray-600">View communications</div>
                </div>
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-6">Recent Job Activity</h3>
              <div className="space-y-4">
                {jobRoles.slice(0, 3).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <div className="font-semibold text-gray-900">{job.title}</div>
                      <div className="text-sm text-gray-600">Posted {new Date(job.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {job.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                ))}
                {jobRoles.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No jobs posted yet</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-6">Recent Assignments</h3>
              <div className="space-y-4">
                {assignments.slice(0, 3).map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                        {assignment.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{assignment.developer?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-600">{assignment.job_role?.title}</div>
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
          </div>
        </div>
        )}

        {/* Jobs Tab */}
        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Job Roles</h2>
              <button
                onClick={() => setShowJobForm(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Job Role
              </button>
            </div>

            {/* Search and Filter */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search job roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={filterActive === null ? 'all' : filterActive.toString()}
                  onChange={(e) => setFilterActive(e.target.value === 'all' ? null : e.target.value === 'true')}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All Jobs</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Job Roles Grid */}
            {filteredJobRoles.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredJobRoles.map((job) => (
                  <JobRoleCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No job roles found</h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm || filterActive !== null 
                    ? "Try adjusting your search or filter criteria"
                    : "Create your first job role to start hiring developers"
                  }
                </p>
                {!searchTerm && filterActive === null && (
                  <button
                    onClick={() => setShowJobForm(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    Create Your First Job Role
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Developers Tab - Using DeveloperList component */}
        {activeTab === 'developers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">Assigned Developers</h2>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search developers..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <button className="flex items-center px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <Filter className="w-4 h-4 mr-2 text-gray-500" />
                  Filter
                </button>
              </div>
            </div>

            {assignments && assignments.length > 0 ? (
              <div className="grid gap-6">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {assignment.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-xl font-black text-gray-900">{assignment.developer?.name || 'Unknown Developer'}</h3>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                            <div className="flex items-center">
                              <Code className="w-4 h-4 mr-1" />
                              Developer
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                          assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                          assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {assignment.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <div className="text-sm font-semibold text-gray-900 mb-1">Assigned to: {assignment.job_role?.title}</div>
                      <div className="text-xs text-gray-600">Assigned on {new Date(assignment.assigned_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assigned Developers</h3>
                <p className="text-gray-600">Developers will appear here once they are assigned to your job postings.</p>
              </div>
            )}
          </div>
        )}

        {/* Messages Tab - Using MessageList/MessageThread components */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Messages</h2>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Messages Yet</h3>
                <p className="text-gray-600 mb-6">Your messages with developers will appear here.</p>
              </div>
            </div>
          </div>
        )}

        {/* Job Form Modal */}
        {showJobForm && (
          <JobRoleForm
            onClose={() => setShowJobForm(false)}
            onJobRoleCreated={handleJobRoleCreated}
          />
        )}

        {/* Job Details Modal */}
        {showJobDetails && selectedJobRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6">
                <JobRoleDetails
                  jobRole={selectedJobRole}
                  onClose={() => {
                    setShowJobDetails(false);
                    setSelectedJobRole(null);
                  }}
                  onJobRoleUpdated={handleJobRoleUpdated}
                />
              </div>
            </div>
          </div>
        )}

        {/* Assign Developer Modal */}
        {showAssignModal && selectedJobRole && (
          <AssignDeveloperModal
            isOpen={showAssignModal}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedJobRole(null);
            }}
            preSelectedJobId={selectedJobRole.id}
            onSuccess={handleAssignmentCreated}
          />
        )}

        {/* Job Details Component */}
        {showJobDetails && selectedJobRole && (
          <JobRoleDetails
            jobRole={selectedJobRole}
            onClose={() => {
              setShowJobDetails(false);
              setSelectedJobRole(null);
            }}
            onJobRoleUpdated={handleJobRoleUpdated}
          />
        )}

        {/* Assign Developer Component */}
        {showAssignModal && selectedJobRole && (
          <AssignDeveloperModal
            jobRole={selectedJobRole}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedJobRole(null);
            }}
            onAssignmentCreated={handleAssignmentCreated}
          />
        )}
      </div>
    </div>
  );
};