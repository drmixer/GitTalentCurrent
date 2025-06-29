import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
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
  Building
} from 'lucide-react';

export const RecruiterDashboard = () => {
  const { userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'recruiter') {
    return <Navigate to="/dashboard" replace />;
  }

  const stats = [
    {
      title: 'Active Jobs',
      value: '12',
      change: '+3 this week',
      icon: Briefcase,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Assigned Developers',
      value: '47',
      change: '+8 this week',
      icon: Users,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Successful Hires',
      value: '23',
      change: '+2 this month',
      icon: Award,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Response Rate',
      value: '89%',
      change: '+5% this month',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const mockJobs = [
    {
      id: 1,
      title: 'Senior React Developer',
      location: 'Remote',
      type: 'Full-time',
      salary: '$120k - $150k',
      posted: '2 days ago',
      applicants: 8,
      status: 'active',
      techStack: ['React', 'TypeScript', 'Node.js'],
    },
    {
      id: 2,
      title: 'Python Backend Engineer',
      location: 'San Francisco, CA',
      type: 'Full-time',
      salary: '$130k - $160k',
      posted: '1 week ago',
      applicants: 12,
      status: 'active',
      techStack: ['Python', 'Django', 'PostgreSQL'],
    },
    {
      id: 3,
      title: 'DevOps Engineer',
      location: 'New York, NY',
      type: 'Contract',
      salary: '$90/hour',
      posted: '3 days ago',
      applicants: 5,
      status: 'paused',
      techStack: ['AWS', 'Kubernetes', 'Docker'],
    },
  ];

  const mockDevelopers = [
    {
      id: 1,
      name: 'Sarah Chen',
      github: 'sarahchen',
      languages: ['TypeScript', 'React', 'Node.js'],
      experience: '5+ years',
      location: 'San Francisco, CA',
      availability: true,
      jobTitle: 'Senior React Developer',
      status: 'new',
      assignedDate: '2024-03-15',
      stars: 892,
      contributions: '3.2k',
    },
    {
      id: 2,
      name: 'Marcus Johnson',
      github: 'marcusj',
      languages: ['Python', 'Django', 'PostgreSQL'],
      experience: '7+ years',
      location: 'Remote',
      availability: false,
      jobTitle: 'Python Backend Engineer',
      status: 'contacted',
      assignedDate: '2024-03-12',
      stars: 1247,
      contributions: '4.1k',
    },
    {
      id: 3,
      name: 'Elena Rodriguez',
      github: 'elenarodriguez',
      languages: ['Go', 'Kubernetes', 'Docker'],
      experience: '6+ years',
      location: 'Austin, TX',
      availability: true,
      jobTitle: 'DevOps Engineer',
      status: 'shortlisted',
      assignedDate: '2024-03-10',
      stars: 654,
      contributions: '2.8k',
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
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
              <div className="text-sm text-gray-600">3 unread messages</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Recent Job Activity</h3>
          <div className="space-y-4">
            {mockJobs.slice(0, 3).map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900">{job.title}</div>
                  <div className="text-sm text-gray-600">{job.applicants} developers assigned</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  job.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Top Assigned Developers</h3>
          <div className="space-y-4">
            {mockDevelopers.slice(0, 3).map((developer) => (
              <div key={developer.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                    {developer.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{developer.name}</div>
                    <div className="text-sm text-gray-600">@{developer.github}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-semibold text-gray-900">{developer.stars}</span>
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">My Jobs</h2>
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
          <Plus className="w-4 h-4 mr-2 inline" />
          Post New Job
        </button>
      </div>

      <div className="grid gap-6">
        {mockJobs.map((job) => (
          <div key={job.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-black text-gray-900">{job.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    job.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {job.location}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {job.type}
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {job.salary}
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  {job.techStack.map((tech, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {job.applicants} assigned
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Posted {job.posted}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold">
                  View Developers
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                  Edit Job
                </button>
              </div>
            </div>
          </div>
        ))}
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
        {mockDevelopers.map((developer) => (
          <div key={developer.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {developer.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-black text-gray-900">{developer.name}</h3>
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
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center">
                      <Github className="w-4 h-4 mr-1" />
                      @{developer.github}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {developer.location}
                    </div>
                    <div className="flex items-center">
                      <Code className="w-4 h-4 mr-1" />
                      {developer.experience}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    {developer.languages.map((lang, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                        {lang}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 mr-1 text-yellow-500" />
                      {developer.stars} stars
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 mr-1 text-green-500" />
                      {developer.contributions} contributions
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  developer.status === 'hired' ? 'bg-emerald-100 text-emerald-800' :
                  developer.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                  developer.status === 'contacted' ? 'bg-purple-100 text-purple-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {developer.status}
                </span>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="text-sm font-semibold text-gray-900 mb-1">Assigned to: {developer.jobTitle}</div>
              <div className="text-xs text-gray-600">Assigned on {developer.assignedDate}</div>
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
                {developer.status === 'new' && (
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                    <UserCheck className="w-4 h-4 mr-2 inline" />
                    Shortlist
                  </button>
                )}
                {developer.status === 'shortlisted' && (
                  <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold">
                    <CheckCircle className="w-4 h-4 mr-2 inline" />
                    Mark as Hired
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
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