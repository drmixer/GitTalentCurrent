import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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
  Loader
} from 'lucide-react';
import { User, Developer, Recruiter, Assignment, Hire } from '../types';

export const AdminDashboard = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [stats, setStats] = useState({
    totalDevelopers: 0,
    activeRecruiters: 0,
    successfulHires: 0,
    revenue: 0
  });
  const [developers, setDevelopers] = useState<(Developer & { user: User })[]>([]);
  const [recruiters, setRecruiters] = useState<(Recruiter & { user: User })[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);
  const [pendingRecruiters, setPendingRecruiters] = useState<(Recruiter & { user: User })[]>([]);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchDashboardData();
    }
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
        .limit(10);

      if (devError) throw devError;
      setDevelopers(developersData || []);

      // Fetch recruiters with user data
      const { data: recruitersData, error: recError } = await supabase
        .from('recruiters')
        .select(`
          *,
          user:users(*)
        `)
        .limit(10);

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
        .limit(5);

      if (pendingError) throw pendingError;
      setPendingRecruiters(pendingData || []);

      // Fetch recent assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(name),
          job_role:job_roles(title),
          recruiter:users!assignments_recruiter_id_fkey(name)
        `)
        .order('assigned_at', { ascending: false })
        .limit(5);

      if (assignError) throw assignError;
      setRecentAssignments(assignmentsData || []);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const approveRecruiter = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_approved: true })
        .eq('id', userId);

      if (error) throw error;

      // Refresh data
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error approving recruiter:', error);
      setError(error.message || 'Failed to approve recruiter');
    }
  };

  const rejectRecruiter = async (userId: string) => {
    try {
      // In a real app, you might want to soft delete or mark as rejected
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      // Refresh data
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error rejecting recruiter:', error);
      setError(error.message || 'Failed to reject recruiter');
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

  if (!userProfile || userProfile.role !== 'admin') {
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
    { id: 'developers', label: 'Developers', icon: Code },
    { id: 'recruiters', label: 'Recruiters', icon: Building },
    { id: 'assignments', label: 'Assignments', icon: UserCheck },
    { id: 'hires', label: 'Hires', icon: Award },
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
            {recentAssignments.length > 0 ? (
              recentAssignments.map((assignment) => (
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
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent assignments</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Pending Approvals</h3>
          <div className="space-y-4">
            {pendingRecruiters.length > 0 ? (
              pendingRecruiters.map((recruiter) => (
                <div key={recruiter.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-semibold text-gray-900">{recruiter.user.name}</div>
                    <div className="text-sm text-gray-600">{recruiter.company_name}</div>
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
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No pending approvals</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDevelopers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Developers</h2>
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Developer
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search developers..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="flex items-center px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Filter className="w-5 h-5 mr-2 text-gray-500" />
              Filter
            </button>
          </div>
        </div>

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
              {developers
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
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                        <MessageSquare className="w-4 h-4" />
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

  const renderRecruiters = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Recruiters</h2>
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Recruiter
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search recruiters..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <button className="flex items-center px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Filter className="w-5 h-5 mr-2 text-gray-500" />
              Filter
            </button>
          </div>
        </div>

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
              {recruiters.map((recruiter) => (
                <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-4">
                        {recruiter.user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{recruiter.user.name}</div>
                        <div className="text-sm text-gray-500">{recruiter.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{recruiter.company_name}</div>
                    <div className="text-sm text-gray-500">{recruiter.company_size}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      recruiter.user.is_approved 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {recruiter.user.is_approved ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {recruiter.user.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {recruiter.industry || 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {!recruiter.user.is_approved && (
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
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'developers' && renderDevelopers()}
        {activeTab === 'recruiters' && renderRecruiters()}
        {activeTab === 'assignments' && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Assignments Management</h3>
            <p className="text-gray-600">Coming soon...</p>
          </div>
        )}
        {activeTab === 'hires' && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Hires Management</h3>
            <p className="text-gray-600">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};