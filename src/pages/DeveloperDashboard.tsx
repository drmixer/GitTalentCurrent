import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RealGitHubChart } from '../components/GitHub/RealGitHubChart';
import { GitHubProvider, useGitHub } from '../hooks/useGitHub';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { PortfolioManager } from '../components/Portfolio/PortfolioManager';
import { ProfileStrengthIndicator } from '../components/Profile/ProfileStrengthIndicator';
import { Code, Github, Star, GitFork, MessageSquare, Briefcase, TrendingUp, Calendar, MapPin, DollarSign, Clock, CheckCircle, Eye, Edit, Plus, Award, Building, Mail, ExternalLink, Activity, Users, Target, Loader, Save, X, AlertCircle, RefreshCw, FolderSync as Sync } from 'lucide-react';
import { Assignment, JobRole, Developer, User } from '../types';

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

const DeveloperDashboardContent = () => {
  const { userProfile, developerProfile, loading: authLoading, updateDeveloperProfile } = useAuth();
  const { 
    user: githubUser, 
    repos, 
    totalStars, 
    getTopLanguages, 
    getTopRepos,
    loading: githubLoading, 
    error: githubError,
    refreshGitHubData,
    syncLanguagesToProfile,
    syncProjectsToProfile
  } = useGitHub();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [availability, setAvailability] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Profile editing state
  const [editFormData, setEditFormData] = useState({
    bio: '',
    github_handle: '',
    location: '',
    experience_years: 0,
    desired_salary: 0,
    top_languages: [] as string[],
    linked_projects: [] as string[]
  });
  const [newLanguage, setNewLanguage] = useState('');
  const [newProject, setNewProject] = useState('');

  // Data states
  const [stats, setStats] = useState({
    activeAssignments: 0,
    totalAssignments: 0,
    messages: 0,
    githubRepos: 0
  });
  const [assignments, setAssignments] = useState<(Assignment & { 
    job_role: JobRole,
    recruiter: User 
  })[]>([]);

  useEffect(() => {
    if (userProfile?.role === 'developer' && developerProfile) {
      setAvailability(developerProfile.availability);
      setEditFormData({
        bio: developerProfile.bio || '',
        github_handle: developerProfile.github_handle || '',
        location: developerProfile.location || '',
        experience_years: developerProfile.experience_years || 0,
        desired_salary: developerProfile.desired_salary || 0,
        top_languages: [...(developerProfile.top_languages || [])],
        linked_projects: [...(developerProfile.linked_projects || [])]
      });
      fetchDashboardData();
    }
  }, [userProfile, developerProfile]);

  // Update stats when GitHub data loads
  useEffect(() => {
    if (githubUser && repos) {
      setStats(prev => ({
        ...prev,
        githubRepos: githubUser.public_repos || repos.length
      }));
    }
  }, [githubUser, repos]);

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

      // Fetch unread messages count
      const { count: unreadMessagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userProfile.id)
        .eq('is_read', false);

      setStats(prev => ({
        ...prev,
        activeAssignments: activeAssignmentsCount,
        totalAssignments: assignmentsData?.length || 0,
        messages: unreadMessagesCount || 0
      }));

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const updateAvailability = async (newAvailability: boolean) => {
    try {
      const result = await updateDeveloperProfile({ availability: newAvailability });
      if (result) {
        setAvailability(newAvailability);
      }
    } catch (error: any) {
      console.error('Error updating availability:', error);
      setError(error.message || 'Failed to update availability');
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError('');

      const result = await updateDeveloperProfile(editFormData);
      if (result) {
        setIsEditingProfile(false);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setError(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromGitHub = async () => {
    try {
      setSyncing(true);
      
      // Sync languages
      const topLanguages = getTopLanguages(15);
      if (topLanguages.length > 0) {
        setEditFormData(prev => ({
          ...prev,
          top_languages: topLanguages
        }));
      }

      // Sync projects
      const topRepos = getTopRepos(8).map(repo => repo.html_url);
      if (topRepos.length > 0) {
        setEditFormData(prev => ({
          ...prev,
          linked_projects: [...new Set([...prev.linked_projects, ...topRepos])]
        }));
      }

      // Sync bio and location if not set
      if (githubUser) {
        if (!editFormData.bio && githubUser.bio) {
          setEditFormData(prev => ({
            ...prev,
            bio: githubUser.bio || ''
          }));
        }
        if (!editFormData.location && githubUser.location) {
          setEditFormData(prev => ({
            ...prev,
            location: githubUser.location || ''
          }));
        }
      }
    } catch (error: any) {
      console.error('Error syncing from GitHub:', error);
      setError(error.message || 'Failed to sync from GitHub');
    } finally {
      setSyncing(false);
    }
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !editFormData.top_languages.includes(newLanguage.trim())) {
      setEditFormData(prev => ({
        ...prev,
        top_languages: [...prev.top_languages, newLanguage.trim()]
      }));
      setNewLanguage('');
    }
  };

  const removeLanguage = (language: string) => {
    setEditFormData(prev => ({
      ...prev,
      top_languages: prev.top_languages.filter(lang => lang !== language)
    }));
  };

  const addProject = () => {
    if (newProject.trim() && !editFormData.linked_projects.includes(newProject.trim())) {
      setEditFormData(prev => ({
        ...prev,
        linked_projects: [...prev.linked_projects, newProject.trim()]
      }));
      setNewProject('');
    }
  };

  const removeProject = (project: string) => {
    setEditFormData(prev => ({
      ...prev,
      linked_projects: prev.linked_projects.filter(proj => proj !== project)
    }));
  };

  // Generate profile strength suggestions
  const getProfileSuggestions = () => {
    const suggestions = [];
    if (!developerProfile?.github_handle) suggestions.push('Connect your GitHub account');
    if (!developerProfile?.bio) suggestions.push('Add a bio to tell your story');
    if (!developerProfile?.top_languages?.length) suggestions.push('Add your programming languages');
    if (!developerProfile?.linked_projects?.length) suggestions.push('Showcase your projects');
    if (!developerProfile?.location) suggestions.push('Add your location');
    if (!developerProfile?.desired_salary) suggestions.push('Set your salary expectations');
    return suggestions;
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Fetching your developer profile...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!userProfile) {
    console.log('❌ No user profile, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect if not a developer
  if (userProfile.role !== 'developer') {
    console.log('❌ Not a developer role, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect to onboarding if no developer profile
  if (!developerProfile) {
    console.log('❌ No developer profile, redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  // Show loading state while dashboard data is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
            <span className="text-gray-600 font-medium">Loading dashboard data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Get display name in format: FirstName (GitHubUsername)
  const displayName = developerProfile.github_handle 
    ? `${userProfile.name.split(' ')[0]} (${developerProfile.github_handle})`
    : userProfile.name;

  const statsCards = [
    {
      title: 'Active Assignments',
      value: stats.activeAssignments.toString(),
      change: stats.activeAssignments > 0 ? `${stats.activeAssignments} active` : 'No active assignments',
      icon: Target,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Total Assignments',
      value: stats.totalAssignments.toString(),
      change: 'All time',
      icon: Briefcase,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Unread Messages',
      value: stats.messages.toString(),
      change: stats.messages > 0 ? 'New messages' : 'All caught up',
      icon: MessageSquare,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'GitHub Stars',
      value: totalStars.toString(),
      change: developerProfile.github_handle ? `@${developerProfile.github_handle}` : 'Add GitHub',
      icon: Star,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'assignments', label: 'Job Assignments', icon: Briefcase },
    { id: 'profile', label: 'My Profile', icon: Code },
    { id: 'portfolio', label: 'Portfolio', icon: Award },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  const renderOverview = () => (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black mb-2">Welcome back, {displayName}!</h2>
            <p className="text-blue-100 mb-4">
              {developerProfile.github_handle 
                ? `Connected to GitHub • ${githubUser?.public_repos || 0} public repos • ${totalStars} stars earned` 
                : 'Complete your profile to get started'
              }
            </p>
            <div className="flex items-center space-x-4">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                availability 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-gray-500 text-white'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  availability ? 'bg-emerald-200 animate-pulse' : 'bg-gray-300'
                }`}></div>
                {availability ? 'Available for hire' : 'Not available'}
              </div>
              <button
                onClick={() => updateAvailability(!availability)}
                className="text-blue-100 hover:text-white transition-colors text-sm font-semibold"
              >
                Change status
              </button>
            </div>
          </div>
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
            <Code className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>

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
            <div className="text-xs text-gray-500 font-medium">{stat.change}</div>
          </div>
        ))}
      </div>

      {/* Profile Strength */}
      <ProfileStrengthIndicator
        strength={developerProfile.profile_strength || 0}
        suggestions={getProfileSuggestions()}
      />

      {/* GitHub Activity Chart */}
      {developerProfile.github_handle && (
        <RealGitHubChart 
          githubHandle={developerProfile.github_handle}
          className="w-full"
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
                  <div className="text-xs text-gray-500">
                    Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                  assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                  assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {assignment.status}
                </span>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No assignments yet</p>
                <p className="text-sm text-gray-400">Job assignments will appear here when recruiters assign you to positions.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Your Skills</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-gray-900 mb-3 text-sm">Programming Languages</h4>
              <div className="flex flex-wrap gap-2">
                {(developerProfile.top_languages.length > 0 ? developerProfile.top_languages : getTopLanguages(5)).map((lang, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                    {lang}
                  </span>
                ))}
                {developerProfile.top_languages.length === 0 && getTopLanguages().length === 0 && (
                  <p className="text-gray-500 text-sm">No languages specified</p>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-gray-900 mb-3 text-sm">Experience & Location</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-2" />
                  {developerProfile.experience_years} years of experience
                </div>
                {(developerProfile.location || githubUser?.location) && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {developerProfile.location || githubUser?.location}
                  </div>
                )}
                {developerProfile.desired_salary > 0 && (
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-2" />
                    ${developerProfile.desired_salary.toLocaleString()}/year
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
                <button 
                  onClick={() => setSelectedThread({
                    otherUserId: assignment.recruiter_id,
                    otherUserName: assignment.recruiter?.name || 'Recruiter',
                    otherUserRole: 'recruiter',
                    unreadCount: 0,
                    jobContext: {
                      id: assignment.job_role_id,
                      title: assignment.job_role?.title || 'Job'
                    }
                  })}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
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
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">
              {userProfile.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">{displayName}</h2>
              <p className="text-gray-600 mb-3">
                {developerProfile.experience_years > 0 
                  ? `${developerProfile.experience_years} years experience` 
                  : 'Developer'
                }
              </p>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {developerProfile.github_handle && (
                  <a
                    href={`https://github.com/${developerProfile.github_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:text-blue-600 transition-colors"
                  >
                    <Github className="w-4 h-4 mr-1" />
                    @{developerProfile.github_handle}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
                {(developerProfile.location || githubUser?.location) && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {developerProfile.location || githubUser?.location}
                  </div>
                )}
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-1" />
                  {userProfile.email}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {developerProfile.github_handle && !isEditingProfile && (
              <button
                onClick={refreshGitHubData}
                disabled={githubLoading}
                className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 inline ${githubLoading ? 'animate-spin' : ''}`} />
                Refresh GitHub
              </button>
            )}
            <button 
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <Edit className="w-4 h-4 mr-2 inline" />
              {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalAssignments}</div>
            <div className="text-sm font-semibold text-gray-600">Total Assignments</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{developerProfile.experience_years}</div>
            <div className="text-sm font-semibold text-gray-600">Years Experience</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{githubUser?.public_repos || 0}</div>
            <div className="text-sm font-semibold text-gray-600">GitHub Repos</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{totalStars}</div>
            <div className="text-sm font-semibold text-gray-600">GitHub Stars</div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {/* Comprehensive Profile Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Developer Profile</h3>
          {developerProfile.github_handle && !githubError && isEditingProfile && (
            <button
              onClick={handleSyncFromGitHub}
              disabled={syncing || githubLoading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
            >
              <Sync className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from GitHub'}
            </button>
          )}
        </div>
        
        {githubError && isEditingProfile && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-yellow-800">GitHub sync unavailable</p>
                <p className="text-sm text-yellow-700">{githubError}</p>
              </div>
            </div>
          </div>
        )}

        {/* About / Bio Section */}
        <div className="mb-6 border-b border-gray-100 pb-6">
          <h4 className="font-bold text-gray-900 mb-3">About</h4>
          {isEditingProfile ? (
            <textarea
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              rows={4}
              placeholder="Tell us about yourself, your experience, and what you're passionate about..."
              value={editFormData.bio}
              onChange={(e) => setEditFormData(prev => ({ ...prev, bio: e.target.value }))}
            />
          ) : (
            <p className="text-gray-600 leading-relaxed">
              {developerProfile.bio || githubUser?.bio || 'No bio provided yet.'}
            </p>
          )}
        </div>

        {/* Basic Information */}
        <div className="mb-6 border-b border-gray-100 pb-6">
          <h4 className="font-bold text-gray-900 mb-3">Basic Information</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">GitHub Handle</div>
              {isEditingProfile ? (
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="your-github-username"
                  value={editFormData.github_handle}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, github_handle: e.target.value }))}
                />
              ) : (
                <div className="text-gray-900 font-medium">
                  {developerProfile.github_handle ? `@${developerProfile.github_handle}` : 'Not specified'}
                </div>
              )}
            </div>
            
            <div>
              <div className="text-sm text-gray-500 mb-1">Location</div>
              {isEditingProfile ? (
                <div>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="San Francisco, CA"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                  {githubUser?.location && editFormData.location !== githubUser.location && (
                    <button
                      type="button"
                      onClick={() => setEditFormData(prev => ({ ...prev, location: githubUser.location || '' }))}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      Use GitHub location: {githubUser.location}
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-gray-900 font-medium">
                  {developerProfile.location || githubUser?.location || 'Not specified'}
                </div>
              )}
            </div>
            
            <div>
              <div className="text-sm text-gray-500 mb-1">Years of Experience</div>
              {isEditingProfile ? (
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={editFormData.experience_years}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                />
              ) : (
                <div className="text-gray-900 font-medium">
                  {developerProfile.experience_years} years
                </div>
              )}
            </div>
            
            <div>
              <div className="text-sm text-gray-500 mb-1">Desired Annual Salary (USD)</div>
              {isEditingProfile ? (
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="120000"
                  value={editFormData.desired_salary}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, desired_salary: parseInt(e.target.value) || 0 }))}
                />
              ) : (
                <div className="text-gray-900 font-medium">
                  {developerProfile.desired_salary > 0 ? `$${developerProfile.desired_salary.toLocaleString()}` : 'Not specified'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Programming Languages */}
        <div className="mb-6 border-b border-gray-100 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-900">Programming Languages</h4>
            {isEditingProfile && getTopLanguages().length > 0 && (
              <span className="text-xs text-gray-500">
                {getTopLanguages().length} languages detected from GitHub
              </span>
            )}
          </div>
          
          {isEditingProfile ? (
            <>
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Add a programming language..."
                />
                <button
                  type="button"
                  onClick={addLanguage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {editFormData.top_languages.map((language) => (
                  <span
                    key={language}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg"
                  >
                    {language}
                    <button
                      type="button"
                      onClick={() => removeLanguage(language)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(developerProfile.top_languages.length > 0 ? developerProfile.top_languages : getTopLanguages(10)).map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                  {skill}
                </span>
              ))}
              {developerProfile.top_languages.length === 0 && getTopLanguages().length === 0 && (
                <p className="text-gray-500">No languages specified</p>
              )}
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-900">Linked Projects</h4>
            {isEditingProfile && repos.length > 0 && (
              <span className="text-xs text-gray-500">
                {repos.length} repos found on GitHub
              </span>
            )}
          </div>
          
          {isEditingProfile ? (
            <>
              <div className="flex space-x-2 mb-4">
                <input
                  type="url"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProject())}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="https://github.com/username/project-name"
                />
                <button
                  type="button"
                  onClick={addProject}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {editFormData.linked_projects.map((project) => (
                  <div
                    key={project}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-900 truncate break-all">{project}</span>
                    <button
                      type="button"
                      onClick={() => removeProject(project)}
                      className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {(developerProfile.linked_projects.length > 0 ? developerProfile.linked_projects : repos.slice(0, 4).map(r => r.html_url)).map((project, index) => {
                const repo = repos.find(r => r.html_url === project);
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-300">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-1">
                          {repo ? repo.name : `Project ${index + 1}`}
                        </h4>
                        {repo?.description && (
                          <p className="text-gray-600 text-sm mb-2">{repo.description}</p>
                        )}
                        <p className="text-gray-600 text-xs mb-2 break-all">{project}</p>
                        {repo && (
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            {repo.language && (
                              <span className="px-2 py-1 bg-gray-100 rounded">{repo.language}</span>
                            )}
                            <div className="flex items-center">
                              <Star className="w-3 h-3 mr-1" />
                              {repo.stargazers_count}
                            </div>
                          </div>
                        )}
                      </div>
                      <a
                        href={project}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
              {developerProfile.linked_projects.length === 0 && repos.length === 0 && (
                <div className="col-span-2 text-center py-4">
                  <Github className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No projects linked yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-100">
          {isEditingProfile ? (
            <>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="px-6 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
              >
                {saving ? (
                  <div className="flex items-center">
                    <Loader className="animate-spin rounded-full h-4 w-4 mr-2" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </div>
                )}
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <Edit className="w-4 h-4 mr-2 inline" />
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderPortfolio = () => (
    <PortfolioManager 
      developerId={userProfile.id} 
      isEditable={true}
    />
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
        {/* Dashboard Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Developer Dashboard
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
        <div className="mb-6">
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
                  {tab.id === 'messages' && stats.messages > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {stats.messages}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'assignments' && renderAssignments()}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'portfolio' && renderPortfolio()}
        {activeTab === 'messages' && renderMessages()}
      </div>
    </div>
  );
};

export const DeveloperDashboard = () => {
  return (
    <GitHubProvider>
      <DeveloperDashboardContent />
    </GitHubProvider>
  );
};