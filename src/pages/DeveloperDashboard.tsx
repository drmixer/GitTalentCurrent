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
import { Code, Github, Star, GitFork, MessageSquare, Briefcase, TrendingUp, Calendar, MapPin, DollarSign, Clock, CheckCircle, Eye, Edit, Plus, Award, Building, Mail, ExternalLink, Activity, Users, Target, Loader, Save, X, AlertCircle, RefreshCw, FolderSync as Sync, Upload, FileText } from 'lucide-react';
import { Assignment, JobRole, Developer, User, SkillCategory } from '../types';

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
    linked_projects: [] as string[],
    skills_categories: {} as SkillCategory,
    resume_url: ''
  });

  // Skills editing state
  const [newSkill, setNewSkill] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);

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

  // Common technologies for autocomplete
  const commonTechnologies = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    'React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js', 'Express.js', 'FastAPI', 'Django', 'Flask',
    'Spring Boot', 'Laravel', 'Ruby on Rails', 'ASP.NET', 'Node.js', 'Deno', 'Bun',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Cassandra', 'DynamoDB', 'Elasticsearch',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'Terraform', 'Ansible', 'Jenkins', 'GitLab CI',
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Slack', 'Discord',
    'HTML', 'CSS', 'Sass', 'Less', 'Tailwind CSS', 'Bootstrap', 'Material-UI', 'Chakra UI',
    'GraphQL', 'REST API', 'gRPC', 'WebSocket', 'Socket.io', 'WebRTC',
    'Jest', 'Cypress', 'Selenium', 'Playwright', 'Mocha', 'Chai', 'PyTest', 'JUnit',
    'Webpack', 'Vite', 'Rollup', 'Parcel', 'Babel', 'ESLint', 'Prettier',
    'Linux', 'macOS', 'Windows', 'Ubuntu', 'CentOS', 'Debian',
    'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'InVision'
  ];

  const filteredTechnologies = commonTechnologies.filter(tech =>
    tech.toLowerCase().includes(newSkill.toLowerCase()) && 
    !getAllSkills().includes(tech)
  );

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
        linked_projects: [...(developerProfile.linked_projects || [])],
        skills_categories: { ...(developerProfile.skills_categories || {}) },
        resume_url: developerProfile.resume_url || ''
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
      
      // Sync languages to skills categories
      const topLanguages = getTopLanguages(15);
      if (topLanguages.length > 0) {
        const updatedSkillsCategories = { ...editFormData.skills_categories };
        
        // Add or update Programming Languages category
        if (!updatedSkillsCategories['Programming Languages']) {
          updatedSkillsCategories['Programming Languages'] = {
            skills: topLanguages,
            proficiency: 'intermediate'
          };
        } else {
          // Merge with existing skills
          const existingSkills = updatedSkillsCategories['Programming Languages'].skills;
          const newSkills = topLanguages.filter(lang => !existingSkills.includes(lang));
          updatedSkillsCategories['Programming Languages'].skills = [...existingSkills, ...newSkills];
        }

        setEditFormData(prev => ({
          ...prev,
          skills_categories: updatedSkillsCategories
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

  // Skills management functions
  const getAllSkills = () => {
    return Object.values(editFormData.skills_categories).flatMap(category => category.skills);
  };

  const addCategory = () => {
    if (newCategory.trim() && !editFormData.skills_categories[newCategory.trim()]) {
      setEditFormData(prev => ({
        ...prev,
        skills_categories: {
          ...prev.skills_categories,
          [newCategory.trim()]: {
            skills: [],
            proficiency: 'intermediate'
          }
        }
      }));
      setNewCategory('');
    }
  };

  const removeCategory = (categoryName: string) => {
    const updatedCategories = { ...editFormData.skills_categories };
    delete updatedCategories[categoryName];
    setEditFormData(prev => ({
      ...prev,
      skills_categories: updatedCategories
    }));
  };

  const addSkillToCategory = (categoryName: string) => {
    if (newSkill.trim() && selectedCategory === categoryName) {
      const updatedCategories = { ...editFormData.skills_categories };
      if (!updatedCategories[categoryName].skills.includes(newSkill.trim())) {
        updatedCategories[categoryName].skills.push(newSkill.trim());
        setEditFormData(prev => ({
          ...prev,
          skills_categories: updatedCategories
        }));
      }
      setNewSkill('');
      setSelectedCategory('');
      setShowSkillSuggestions(false);
    }
  };

  const removeSkillFromCategory = (categoryName: string, skill: string) => {
    const updatedCategories = { ...editFormData.skills_categories };
    updatedCategories[categoryName].skills = updatedCategories[categoryName].skills.filter(s => s !== skill);
    setEditFormData(prev => ({
      ...prev,
      skills_categories: updatedCategories
    }));
  };

  const updateCategoryProficiency = (categoryName: string, proficiency: 'beginner' | 'intermediate' | 'expert') => {
    const updatedCategories = { ...editFormData.skills_categories };
    updatedCategories[categoryName].proficiency = proficiency;
    setEditFormData(prev => ({
      ...prev,
      skills_categories: updatedCategories
    }));
  };

  const addProject = () => {
    // This function is kept for backward compatibility but not used in the new UI
  };

  const removeProject = (project: string) => {
    setEditFormData(prev => ({
      ...prev,
      linked_projects: prev.linked_projects.filter(proj => proj !== project)
    }));
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

      {/* Profile Strength Indicator */}
      <ProfileStrengthIndicator 
        strength={developerProfile.profile_strength || 0}
        suggestions={[
          !developerProfile.github_handle && 'Add your GitHub handle',
          !developerProfile.bio && 'Write a professional bio',
          Object.keys(developerProfile.skills_categories || {}).length === 0 && 'Add your skills and expertise',
          !developerProfile.resume_url && 'Upload your resume',
          !developerProfile.desired_salary && 'Set your salary expectations'
        ].filter(Boolean) as string[]}
      />

      {/* GitHub Activity Chart */}
      {developerProfile.github_handle && (
        <RealGitHubChart 
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
            {Object.keys(developerProfile.skills_categories || {}).length > 0 ? (
              Object.entries(developerProfile.skills_categories || {}).slice(0, 2).map(([category, data]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900 text-sm">{category}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      data.proficiency === 'expert' ? 'bg-emerald-100 text-emerald-800' :
                      data.proficiency === 'intermediate' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {data.proficiency}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.skills.slice(0, 5).map((skill, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                        {skill}
                      </span>
                    ))}
                    {data.skills.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                        +{data.skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <Code className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No skills added yet</p>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-semibold mt-2"
                >
                  Add your skills
                </button>
              </div>
            )}
            
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-2" />
                  {developerProfile.experience_years} years of experience
                </div>
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
    <div className="space-y-8">
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

        <div className="grid md:grid-cols-4 gap-6">
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4">About</h3>
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

      {/* Profile Details */}
      {isEditingProfile && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900">Edit Profile Details</h3>
            {developerProfile.github_handle && !githubError && (
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
          
          {githubError && (
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

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">GitHub Handle</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="your-github-username"
                value={editFormData.github_handle}
                onChange={(e) => setEditFormData(prev => ({ ...prev, github_handle: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Location</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Years of Experience</label>
              <input
                type="number"
                min="0"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={editFormData.experience_years}
                onChange={(e) => setEditFormData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Desired Annual Salary (USD)</label>
              <input
                type="number"
                min="0"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="120000"
                value={editFormData.desired_salary}
                onChange={(e) => setEditFormData(prev => ({ ...prev, desired_salary: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Resume URL */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Resume URL</label>
            <div className="relative">
              <FileText className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="url"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="https://example.com/resume.pdf"
                value={editFormData.resume_url}
                onChange={(e) => setEditFormData(prev => ({ ...prev, resume_url: e.target.value }))}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Link to your resume (PDF, Google Drive, Dropbox, etc.)
            </p>
          </div>

          {/* Skills & Expertise */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-bold text-gray-700">Skills & Expertise</label>
              <span className="text-xs text-gray-500">
                Organize your skills by category and proficiency level
              </span>
            </div>

            {/* Add New Category */}
            <div className="flex space-x-2 mb-6">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Add a skill category (e.g., Frontend, Backend, DevOps)..."
              />
              <button
                type="button"
                onClick={addCategory}
                className="px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Skill Categories */}
            <div className="space-y-6">
              {Object.entries(editFormData.skills_categories).map(([categoryName, categoryData]) => (
                <div key={categoryName} className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-900">{categoryName}</h4>
                    <div className="flex items-center space-x-2">
                      {/* Proficiency selector */}
                      <select
                        value={categoryData.proficiency}
                        onChange={(e) => updateCategoryProficiency(categoryName, e.target.value as any)}
                        className="px-3 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="expert">Expert</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeCategory(categoryName)}
                        className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Add skill to category */}
                  <div className="relative mb-4">
                    <input
                      type="text"
                      value={selectedCategory === categoryName ? newSkill : ''}
                      onChange={(e) => {
                        setNewSkill(e.target.value);
                        setSelectedCategory(categoryName);
                        setShowSkillSuggestions(e.target.value.length > 0);
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkillToCategory(categoryName))}
                      onFocus={() => {
                        setSelectedCategory(categoryName);
                        setShowSkillSuggestions(newSkill.length > 0);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSkillSuggestions(false), 200);
                      }}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder={`Add a skill to ${categoryName}...`}
                    />
                    
                    {/* Autocomplete suggestions */}
                    {showSkillSuggestions && selectedCategory === categoryName && filteredTechnologies.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredTechnologies.slice(0, 8).map((tech) => (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => {
                              setNewSkill(tech);
                              addSkillToCategory(categoryName);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                          >
                            {tech}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Skills in category */}
                  <div className="flex flex-wrap gap-2">
                    {categoryData.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkillFromCategory(categoryName, skill)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(editFormData.skills_categories).length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No skill categories yet</p>
                <p className="text-sm text-gray-400">Add categories like "Frontend", "Backend", "DevOps" to organize your skills</p>
              </div>
            )}
          </div>

          {/* GitHub Projects */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-bold text-gray-700">GitHub Projects</label>
              {repos.length > 0 && (
                <span className="text-xs text-gray-500">
                  {repos.length} repos found on GitHub
                </span>
              )}
            </div>
            <div className="space-y-2">
              {editFormData.linked_projects.map((project) => (
                <div
                  key={project}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
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
          </div>

          {/* Save/Cancel Buttons */}
          <div className="flex items-center justify-end space-x-4">
            <button
              onClick={() => setIsEditingProfile(false)}
              className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {saving ? (
                <div className="flex items-center">
                  <Loader className="animate-spin rounded-full h-5 w-5 mr-3" />
                  Saving...
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="w-5 h-5 mr-3" />
                  Save Changes
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Skills & Technologies (Read-only when not editing) */}
      {!isEditingProfile && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Skills & Technologies</h3>
          {Object.keys(developerProfile.skills_categories || {}).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(developerProfile.skills_categories || {}).map(([category, data]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-gray-900">{category}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      data.proficiency === 'expert' ? 'bg-emerald-100 text-emerald-800' :
                      data.proficiency === 'intermediate' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {data.proficiency}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.skills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No skills specified</p>
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-semibold mt-2"
              >
                Add your skills
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resume */}
      {(developerProfile.resume_url || isEditingProfile) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-4">Resume</h3>
          {developerProfile.resume_url ? (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <div className="font-semibold text-gray-900">Resume</div>
                  <div className="text-sm text-gray-600">Click to view or download</div>
                </div>
              </div>
              <a
                href={developerProfile.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Resume
              </a>
            </div>
          ) : (
            <div className="text-center py-8">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No resume uploaded</p>
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-semibold mt-2"
              >
                Add your resume
              </button>
            </div>
          )}
        </div>
      )}

      {/* Portfolio */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <PortfolioManager 
          developerId={developerProfile.user_id}
          isEditable={true}
        />
      </div>

      {/* GitHub Projects (Read-only when not editing) */}
      {!isEditingProfile && developerProfile.linked_projects.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">GitHub Projects</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {developerProfile.linked_projects.map((project, index) => {
              const repo = repos.find(r => r.html_url === project);
              return (
                <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-2">
                        {repo ? repo.name : `Project ${index + 1}`}
                      </h4>
                      {repo?.description && (
                        <p className="text-gray-600 text-sm mb-3">{repo.description}</p>
                      )}
                      <p className="text-gray-600 text-sm mb-3 break-all">{project}</p>
                      {repo && (
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
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
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
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