import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GitHubChart } from '../components/GitHub/GitHubChart';
import { 
  Code, 
  Github, 
  Star, 
  GitFork, 
  MessageSquare, 
  Briefcase,
  TrendingUp,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  Eye,
  Edit,
  Plus,
  Award,
  Building,
  Mail,
  ExternalLink,
  Activity,
  Users,
  Target,
  Loader
} from 'lucide-react';
import { Assignment, JobRole, Developer, User } from '../types';

export const DeveloperDashboard = () => {
  const { userProfile, developerProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [availability, setAvailability] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [stats, setStats] = useState({
    activeAssignments: 0,
    profileViews: 0,
    messages: 0,
    githubStars: 0
  });
  const [assignments, setAssignments] = useState<(Assignment & { 
    job_role: JobRole,
    recruiter: User 
  })[]>([]);

  useEffect(() => {
    if (userProfile?.role === 'developer' && developerProfile) {
      setAvailability(developerProfile.availability);
      fetchDashboardData();
    }
  }, [userProfile, developerProfile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      if (!userProfile?.id) return;

      // Fetch assignments with job and recruiter data
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          job_role:job_roles(*),
          recruiter:users!assignments_recruiter_id_fkey(*)
        `)
        .eq('developer_id', userProfile.id)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Calculate stats
      const activeAssignmentsCount = assignmentsData?.filter(a => 
        a.status !== 'Hired' && a.status !== 'Rejected'
      ).length || 0;

      // For now, we'll use placeholder values for profile views and messages
      // In a real app, you'd track these metrics
      setStats({
        activeAssignments: activeAssignmentsCount,
        profileViews: Math.floor(Math.random() * 200) + 50, // Placeholder
        messages: Math.floor(Math.random() * 20) + 5, // Placeholder
        githubStars: Math.floor(Math.random() * 1000) + 100 // Placeholder
      });

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const updateAvailability = async (newAvailability: boolean) => {
    try {
      if (!userProfile?.id) return;

      const { error } = await supabase
        .from('developers')
        .update({ availability: newAvailability })
        .eq('user_id', userProfile.id);

      if (error) throw error;

      setAvailability(newAvailability);
    } catch (error: any) {
      console.error('Error updating availability:', error);
      setError(error.message || 'Failed to update availability');
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

  if (!userProfile || userProfile.role !== 'developer') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!developerProfile) {
    return <Navigate to="/onboarding" replace />;
  }

  const statsCards = [
    {
      title: 'Active Assignments',
      value: stats.activeAssignments.toString(),
      change: '+1 this week',
      icon: Target,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Profile Views',
      value: stats.profileViews.toString(),
      change: '+23 this week',
      icon: Eye,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Messages',
      value: stats.messages.toString(),
      change: '2 unread',
      icon: MessageSquare,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'GitHub Stars',
      value: stats.githubStars.toString(),
      change: '+47 this month',
      icon: Star,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'assignments', label: 'Job Assignments', icon: Briefcase },
    { id: 'profile', label: 'My Profile', icon: Code },
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

      {/* Availability Toggle */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Availability Status</h3>
            <p className="text-gray-600">Let recruiters know if you're open to new opportunities</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`text-sm font-semibold ${availability ? 'text-emerald-600' : 'text-gray-500'}`}>
              {availability ? 'Available for hire' : 'Not available'}
            </span>
            <button
              onClick={() => updateAvailability(!availability)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                availability ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  availability ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* GitHub Activity Chart */}
      {developerProfile.github_handle && (
        <GitHubChart 
          githubHandle={developerProfile.github_handle}
          className="col-span-full"
        />
      )}

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Recent Assignments</h3>
          <div className="space-y-4">
            {assignments.slice(0, 3).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900">{assignment.job_role?.title}</div>
                  <div className="text-sm text-gray-600">{assignment.recruiter?.name}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
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
          <h3 className="text-lg font-black text-gray-900 mb-6">Skills & Languages</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-gray-900 mb-3 text-sm">Programming Languages</h4>
              <div className="flex flex-wrap gap-2">
                {developerProfile.top_languages.map((lang, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                    {lang}
                  </span>
                ))}
                {developerProfile.top_languages.length === 0 && (
                  <p className="text-gray-500 text-sm">No languages specified</p>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-gray-900 mb-3 text-sm">Experience</h4>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-1" />
                  {developerProfile.experience_years} years
                </div>
                {developerProfile.location && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {developerProfile.location}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAssignments = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Job Assignments</h2>
        <div className="text-sm text-gray-600">
          {assignments.length} total assignments
        </div>
      </div>

      <div className="grid gap-6">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-black text-gray-900">{assignment.job_role?.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                    assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                    assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {assignment.status}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Building className="w-4 h-4 mr-1" />
                    {assignment.recruiter?.name}
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {assignment.job_role?.location}
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    ${assignment.job_role?.salary_min}k - ${assignment.job_role?.salary_max}k
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  {assignment.job_role?.tech_stack?.map((tech, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2">
                  {assignment.job_role?.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Recruiter: {assignment.recruiter?.name}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold">
                  <Eye className="w-4 h-4 mr-2 inline" />
                  View Details
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                  <Mail className="w-4 h-4 mr-2 inline" />
                  Contact Recruiter
                </button>
              </div>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assignments Yet</h3>
            <p className="text-gray-600">Job assignments will appear here when recruiters assign you to positions.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">
              {userProfile.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">{userProfile.name}</h2>
              <p className="text-gray-600 mb-3">Full-Stack Developer</p>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {developerProfile.github_handle && (
                  <div className="flex items-center">
                    <Github className="w-4 h-4 mr-1" />
                    @{developerProfile.github_handle}
                  </div>
                )}
                {developerProfile.location && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {developerProfile.location}
                  </div>
                )}
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-1" />
                  {userProfile.email}
                </div>
              </div>
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            <Edit className="w-4 h-4 mr-2 inline" />
            Edit Profile
          </button>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{stats.githubStars}</div>
            <div className="text-sm font-semibold text-gray-600">GitHub Stars</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{developerProfile.experience_years}</div>
            <div className="text-sm font-semibold text-gray-600">Years Experience</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{assignments.length}</div>
            <div className="text-sm font-semibold text-gray-600">Total Assignments</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{developerProfile.hourly_rate ? `$${developerProfile.hourly_rate}` : 'N/A'}</div>
            <div className="text-sm font-semibold text-gray-600">Hourly Rate</div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {developerProfile.bio && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-4">About</h3>
          <p className="text-gray-600 leading-relaxed">{developerProfile.bio}</p>
        </div>
      )}

      {/* Skills & Technologies */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Skills & Technologies</h3>
          <button className="text-blue-600 hover:text-blue-700 font-semibold">
            <Edit className="w-4 h-4 mr-1 inline" />
            Edit
          </button>
        </div>
        <div className="grid md:grid-cols-1 gap-6">
          <div>
            <h4 className="font-bold text-gray-900 mb-3">Programming Languages</h4>
            <div className="flex flex-wrap gap-2">
              {developerProfile.top_languages.map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                  {skill}
                </span>
              ))}
              {developerProfile.top_languages.length === 0 && (
                <p className="text-gray-500">No languages specified</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Projects</h3>
          <button className="text-blue-600 hover:text-blue-700 font-semibold">
            <Plus className="w-4 h-4 mr-1 inline" />
            Add Project
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {developerProfile.linked_projects.map((project, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-2">Project {index + 1}</h4>
                  <p className="text-gray-600 text-sm mb-3">{project}</p>
                </div>
                <a
                  href={project}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
          {developerProfile.linked_projects.length === 0 && (
            <div className="col-span-2 text-center py-8">
              <Github className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No projects linked yet</p>
            </div>
          )}
        </div>
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
              <p className="text-gray-600">Track your assignments and manage your developer profile</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                availability 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  availability ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'
                }`}></div>
                {availability ? 'Available for hire' : 'Not available'}
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                <Code className="w-6 h-6" />
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
        {activeTab === 'assignments' && renderAssignments()}
        {activeTab === 'profile' && renderProfile()}
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