import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Briefcase, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Mail,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  UserCheck,
  Star,
  Github,
  Code,
  Award,
  Building,
  Loader
} from 'lucide-react';
import { JobRole, Assignment, Developer, User } from '../types';

export const RecruiterDashboard = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [stats, setStats] = useState({
    activeJobs: 0,
    assignedDevelopers: 0,
    successfulHires: 0,
    responseRate: 0
  });
  const [jobs, setJobs] = useState<JobRole[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { 
    developer: Developer & { user: User },
    job_role: JobRole 
  })[]>([]);

  useEffect(() => {
    if (userProfile?.role === 'recruiter') {
      fetchDashboardData();
    }
  }, [userProfile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      if (!userProfile?.id) return;

      // Fetch job roles
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_roles')
        .select('*')
        .eq('recruiter_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Fetch assignments with developer and job data
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(
            id,
            name,
            email
          ),
          job_role:job_roles(*)
        `)
        .eq('recruiter_id', userProfile.id)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Fetch developer profiles for assignments
      const assignmentsWithDevProfiles = await Promise.all(
        (assignmentsData || []).map(async (assignment) => {
          const { data: devProfile } = await supabase
            .from('developers')
            .select('*')
            .eq('user_id', assignment.developer_id)
            .single();

          return {
            ...assignment,
            developer: {
              ...devProfile,
              user: assignment.developer
            }
          };
        })
      );

      setAssignments(assignmentsWithDevProfiles);

      // Calculate stats
      const activeJobsCount = jobsData?.filter(job => job.is_active).length || 0;
      const assignedDevsCount = assignmentsData?.length || 0;
      const hiresCount = assignmentsData?.filter(a => a.status === 'Hired').length || 0;
      const contactedCount = assignmentsData?.filter(a => a.status === 'Contacted').length || 0;
      const responseRate = assignedDevsCount > 0 ? Math.round((contactedCount / assignedDevsCount) * 100) : 0;

      setStats({
        activeJobs: activeJobsCount,
        assignedDevelopers: assignedDevsCount,
        successfulHires: hiresCount,
        responseRate
      });

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('id', assignmentId);

      if (error) throw error;

      // Refresh data
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error updating assignment status:', error);
      setError(error.message || 'Failed to update assignment status');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'recruiter') {
    return <Navigate to="/dashboard" replace />;
  }

  const statsCards = [
    {
      title: 'Active Jobs',
      value: stats.activeJobs.toString(),
      change: '+3 this week',
      icon: Briefcase,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Assigned Developers',
      value: stats.assignedDevelopers.toString(),
      change: '+8 this week',
      icon: Users,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Successful Hires',
      value: stats.successfulHires.toString(),
      change: '+2 this month',
      icon: Award,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Response Rate',
      value: `${stats.responseRate}%`,
      change: '+5% this month',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'jobs', label: 'My Jobs', icon: Briefcase },
    { id: 'developers', label: 'Assigned Developers', icon: Users },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-gray-600 mb-2">{stat.title}</div>
            <div className="text-xs text-emerald-600 font-semibold">{stat.change}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <button className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all group">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-900">Post New Job</div>
              <div className="text-sm text-gray-600">Create a new job posting</div>
            </div>
          </button>
          
          <button className="flex items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 hover:from-purple-100 hover:to-pink-100 transition-all group">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-900">Browse Developers</div>
              <div className="text-sm text-gray-600">View assigned talent</div>
            </div>
          </button>
          
          <button className="flex items-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 hover:from-emerald-100 hover:to-teal-100 transition-all group">
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
            {jobs.slice(0, 3).map((job) => (
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
            {jobs.length === 0 && (
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
                    {assignment.developer?.user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{assignment.developer?.user?.name || 'Unknown'}</div>
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
  );

  const renderJobs = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">My Jobs</h2>
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
          <Plus className="w-4 h-4 mr-2 inline" />
          Post New Job
        </button>
      </div>

      <div className="grid gap-6">
        {jobs.map((job) => (
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
                <div className="flex items-center space-x-2 mb-4">
                  {job.tech_stack.map((tech, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2">
                  {job.description}
                </p>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Posted {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold">
                  View Assignments
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                  Edit Job
                </button>
              </div>
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jobs Posted</h3>
            <p className="text-gray-600 mb-6">Start by posting your first job to attract top developers.</p>
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-4 h-4 mr-2 inline" />
              Post Your First Job
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderDevelopers = () => (
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

      <div className="grid gap-6">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {assignment.developer?.user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-black text-gray-900">{assignment.developer?.user?.name || 'Unknown Developer'}</h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      assignment.developer?.availability 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        assignment.developer?.availability ? 'bg-emerald-500' : 'bg-gray-500'
                      }`}></div>
                      {assignment.developer?.availability ? 'Available' : 'Busy'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    {assignment.developer?.github_handle && (
                      <div className="flex items-center">
                        <Github className="w-4 h-4 mr-1" />
                        @{assignment.developer.github_handle}
                      </div>
                    )}
                    {assignment.developer?.location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {assignment.developer.location}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Code className="w-4 h-4 mr-1" />
                      {assignment.developer?.experience_years || 0} years
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    {assignment.developer?.top_languages?.map((lang, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                        {lang}
                      </span>
                    ))}
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
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="text-sm font-semibold text-gray-900 mb-1">Assigned to: {assignment.job_role?.title}</div>
              <div className="text-xs text-gray-600">Assigned on {new Date(assignment.assigned_at).toLocaleDateString()}</div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold">
                  <Eye className="w-4 h-4 mr-2 inline" />
                  View Profile
                </button>
                <button className="px-4 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors font-semibold">
                  <Mail className="w-4 h-4 mr-2 inline" />
                  Message
                </button>
              </div>
              <div className="flex items-center space-x-2">
                {assignment.status === 'New' && (
                  <button 
                    onClick={() => updateAssignmentStatus(assignment.id, 'Contacted')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    <UserCheck className="w-4 h-4 mr-2 inline" />
                    Mark Contacted
                  </button>
                )}
                {assignment.status === 'Contacted' && (
                  <button 
                    onClick={() => updateAssignmentStatus(assignment.id, 'Shortlisted')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                  >
                    <Star className="w-4 h-4 mr-2 inline" />
                    Shortlist
                  </button>
                )}
                {assignment.status === 'Shortlisted' && (
                  <button 
                    onClick={() => updateAssignmentStatus(assignment.id, 'Hired')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                  >
                    <CheckCircle className="w-4 h-4 mr-2 inline" />
                    Mark as Hired
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assigned Developers</h3>
            <p className="text-gray-600">Developers will appear here once they are assigned to your job postings.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
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

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'developers' && renderDevelopers()}
        {activeTab === 'messages' && (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Messages</h3>
            <p className="text-gray-600">Your message center is coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};