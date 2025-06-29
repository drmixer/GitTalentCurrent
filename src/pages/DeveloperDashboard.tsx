import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GitHubChart } from '../components/GitHub/GitHubChart';
import { RealGitHubChart } from '../components/GitHub/RealGitHubChart';
import { PortfolioManager } from '../components/Portfolio/PortfolioManager';
import { ProfileStrengthIndicator } from '../components/Profile/ProfileStrengthIndicator';
import { MessageList } from '../components/Messages/MessageList';
import { MessageThread } from '../components/Messages/MessageThread';
import { 
  User, 
  Code, 
  Github, 
  Briefcase, 
  MessageSquare, 
  TrendingUp, 
  Eye, 
  Star, 
  Award,
  ArrowUpRight,
  Loader,
  Edit,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Assignment } from '../types';

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

export const DeveloperDashboard = () => {
  const { userProfile, developerProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);

  // Stats data
  const [stats, setStats] = useState({
    profileViews: 0,
    assignmentCount: 0,
    messageCount: 0,
    profileStrength: developerProfile?.profile_strength || 0
  });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (userProfile?.role === 'developer' && developerProfile) {
      fetchDashboardData();
    }
  }, [userProfile, developerProfile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      if (!userProfile?.id) return;

      // Fetch assignments
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

      // Fetch unread messages count
      const { count: unreadCount, error: messagesError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userProfile.id)
        .eq('is_read', false);

      if (messagesError) throw messagesError;

      // Set stats
      setStats({
        profileViews: Math.floor(Math.random() * 20) + 5, // Simulated data
        assignmentCount: assignmentsData?.length || 0,
        messageCount: unreadCount || 0,
        profileStrength: developerProfile?.profile_strength || 0
      });

      setUnreadMessages(unreadCount || 0);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
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

  // Redirect if no developer profile
  if (!developerProfile) {
    console.log('❌ No developer profile, redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'stats', label: 'Stats', icon: Star },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  const renderOverview = () => (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Profile Strength */}
      <ProfileStrengthIndicator
        strength={stats.profileStrength}
        suggestions={[
          'Add more programming languages to showcase your skills',
          'Link your GitHub projects to demonstrate your work',
          'Complete your bio to tell recruiters about yourself',
          'Add your location to receive location-specific opportunities'
        ]}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.profileViews}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Profile Views</div>
          <div className="text-xs text-emerald-600 font-medium">+12% this week</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.assignmentCount}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Job Assignments</div>
          <div className="text-xs text-emerald-600 font-medium">New opportunities</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{stats.messageCount}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Unread Messages</div>
          <div className="text-xs text-emerald-600 font-medium">From recruiters</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mb-1">{developerProfile.top_languages.length}</div>
          <div className="text-sm font-medium text-gray-600 mb-2">Skills Showcased</div>
          <div className="text-xs text-emerald-600 font-medium">Highlight your expertise</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Recent Assignments</h3>
          <div className="space-y-4">
            {assignments.slice(0, 3).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900">{assignment.job_role?.title || 'Unknown Job'}</div>
                  <div className="text-sm text-gray-600">{assignment.recruiter?.name || 'Unknown Recruiter'}</div>
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
          <h3 className="text-lg font-black text-gray-900 mb-6">Profile Completion Tips</h3>
          <div className="space-y-4">
            {developerProfile.github_handle ? (
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                <div className="flex items-center">
                  <Github className="w-5 h-5 text-emerald-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">GitHub Connected</div>
                    <div className="text-sm text-gray-600">Your GitHub profile is linked</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Completed
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center">
                  <Github className="w-5 h-5 text-yellow-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">Connect GitHub</div>
                    <div className="text-sm text-gray-600">Link your GitHub profile to show your work</div>
                  </div>
                </div>
                <button className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white">
                  Connect
                </button>
              </div>
            )}
            
            {developerProfile.top_languages.length > 0 ? (
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                <div className="flex items-center">
                  <Code className="w-5 h-5 text-emerald-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">Skills Added</div>
                    <div className="text-sm text-gray-600">{developerProfile.top_languages.length} languages added</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Completed
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center">
                  <Code className="w-5 h-5 text-yellow-600 mr-3" />
                  <div>
                    <div className="font-semibold text-gray-900">Add Your Skills</div>
                    <div className="text-sm text-gray-600">Add programming languages and technologies</div>
                  </div>
                </div>
                <button className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white">
                  Add Skills
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center">
                <Briefcase className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <div className="font-semibold text-gray-900">Add Portfolio Items</div>
                  <div className="text-sm text-gray-600">Showcase your best work to recruiters</div>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('portfolio')}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white"
              >
                Add Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStats = () => (
    <div className="space-y-8">
      <h2 className="text-2xl font-black text-gray-900">Your Stats</h2>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Eye className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-black text-gray-900 mb-2">{stats.profileViews}</div>
            <div className="text-sm font-medium text-gray-600">Profile Views</div>
            <div className="mt-4 text-xs text-emerald-600 font-medium flex items-center justify-center">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              12% increase this week
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-black text-gray-900 mb-2">{stats.assignmentCount}</div>
            <div className="text-sm font-medium text-gray-600">Job Assignments</div>
            <div className="mt-4 text-xs text-gray-500 font-medium">
              {stats.assignmentCount > 0 ? `${Math.round(stats.assignmentCount * 0.3)} new this month` : 'No assignments yet'}
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-black text-gray-900 mb-2">{stats.messageCount}</div>
            <div className="text-sm font-medium text-gray-600">Unread Messages</div>
            <div className="mt-4">
              {stats.messageCount > 0 ? (
                <button 
                  onClick={() => setActiveTab('messages')}
                  className="text-xs text-blue-600 font-medium hover:text-blue-800 transition-colors"
                >
                  View Messages
                </button>
              ) : (
                <span className="text-xs text-gray-500 font-medium">No new messages</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Star className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-black text-gray-900 mb-2">{stats.profileStrength}%</div>
            <div className="text-sm font-medium text-gray-600">Profile Strength</div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    stats.profileStrength >= 80 ? 'bg-emerald-500' :
                    stats.profileStrength >= 50 ? 'bg-blue-500' :
                    'bg-orange-500'
                  }`}
                  style={{ width: `${stats.profileStrength}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-6">Activity Overview</h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-900">Profile Completion</div>
              <div className="text-sm font-bold text-gray-900">{stats.profileStrength}%</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${stats.profileStrength}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">
              Complete your profile to increase visibility to recruiters
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-900">Response Rate</div>
              <div className="text-sm font-bold text-gray-900">
                {stats.messageCount > 0 ? '85%' : 'N/A'}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: stats.messageCount > 0 ? '85%' : '0%' }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {stats.messageCount > 0 
                ? 'You respond quickly to recruiter messages' 
                : 'No messages to respond to yet'}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-900">GitHub Activity</div>
              <div className="text-sm font-bold text-gray-900">
                {developerProfile.github_handle ? 'Active' : 'Not Connected'}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full bg-purple-500"
                style={{ width: developerProfile.github_handle ? '90%' : '0%' }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {developerProfile.github_handle 
                ? 'Your GitHub activity is visible to recruiters' 
                : 'Connect GitHub to show your coding activity'}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Stats */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-6">Assignment Status</h3>
        
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="text-2xl font-black text-gray-900 mb-1">
              {assignments.length}
            </div>
            <div className="text-sm font-semibold text-gray-600">Total Assignments</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-100">
            <div className="text-2xl font-black text-gray-900 mb-1">
              {assignments.filter(a => a.status === 'New').length}
            </div>
            <div className="text-sm font-semibold text-gray-600">New</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="text-2xl font-black text-gray-900 mb-1">
              {assignments.filter(a => a.status === 'Contacted' || a.status === 'Shortlisted').length}
            </div>
            <div className="text-sm font-semibold text-gray-600">In Progress</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
            <div className="text-2xl font-black text-gray-900 mb-1">
              {assignments.filter(a => a.status === 'Hired').length}
            </div>
            <div className="text-sm font-semibold text-gray-600">Hired</div>
          </div>
        </div>
      </div>

      {/* Profile Visibility */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Profile Visibility</h3>
          <button className="text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors">
            <Edit className="w-4 h-4 mr-1 inline" />
            Edit Settings
          </button>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Availability Status</div>
                <div className="text-sm text-gray-600">
                  {developerProfile.availability ? 'Available for hire' : 'Not available'}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {developerProfile.availability 
                  ? 'Recruiters can see you are open to opportunities' 
                  : 'Your profile is visible but marked as not available'}
              </span>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                developerProfile.availability ? 'bg-emerald-600' : 'bg-gray-200'
              }`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  developerProfile.availability ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Profile Visibility</div>
                <div className="text-sm text-gray-600">
                  Visible to assigned recruiters
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Your profile is visible to recruiters who have been assigned to you by our admin team
            </div>
          </div>
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

  const renderGitHub = () => (
    <div className="space-y-6">
      {developerProfile.github_handle ? (
        <RealGitHubChart 
          githubHandle={developerProfile.github_handle} 
          className="w-full"
        />
      ) : (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Github className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">GitHub Not Connected</h3>
          <p className="text-gray-600 mb-6">
            Connect your GitHub account to showcase your contributions and projects to potential employers.
          </p>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold">
            <Github className="w-4 h-4 mr-2 inline" />
            Connect GitHub
          </button>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Welcome, {userProfile.name}!
              </h1>
              <p className="text-gray-600">Manage your developer profile and connect with recruiters</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                <Code className="w-6 h-6" />
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setActiveTab('portfolio')}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Portfolio Item
            </button>
            <button 
              onClick={fetchDashboardData}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </button>
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
                  {tab.id === 'messages' && unreadMessages > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {unreadMessages}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'portfolio' && renderPortfolio()}
        {activeTab === 'github' && renderGitHub()}
        {activeTab === 'messages' && renderMessages()}
      </div>
    </div>
  );
};