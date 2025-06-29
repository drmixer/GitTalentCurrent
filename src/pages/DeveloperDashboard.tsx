import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
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
  Target
} from 'lucide-react';

export const DeveloperDashboard = () => {
  const { userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [availability, setAvailability] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'developer') {
    return <Navigate to="/dashboard" replace />;
  }

  const stats = [
    {
      title: 'Active Assignments',
      value: '3',
      change: '+1 this week',
      icon: Target,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Profile Views',
      value: '127',
      change: '+23 this week',
      icon: Eye,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Messages',
      value: '8',
      change: '2 unread',
      icon: MessageSquare,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'GitHub Stars',
      value: '892',
      change: '+47 this month',
      icon: Star,
      color: 'from-orange-500 to-red-600',
    },
  ];

  const mockAssignments = [
    {
      id: 1,
      jobTitle: 'Senior React Developer',
      company: 'TechCorp Inc.',
      recruiter: 'John Smith',
      location: 'Remote',
      salary: '$120k - $150k',
      status: 'new',
      assignedDate: '2024-03-15',
      techStack: ['React', 'TypeScript', 'Node.js'],
      description: 'We are looking for a senior React developer to join our growing team...',
    },
    {
      id: 2,
      jobTitle: 'Full-Stack Engineer',
      company: 'StartupIO',
      recruiter: 'Lisa Wang',
      location: 'San Francisco, CA',
      salary: '$110k - $140k',
      status: 'contacted',
      assignedDate: '2024-03-12',
      techStack: ['React', 'Python', 'PostgreSQL'],
      description: 'Join our innovative startup as a full-stack engineer...',
    },
    {
      id: 3,
      jobTitle: 'Frontend Lead',
      company: 'Enterprise Solutions',
      recruiter: 'David Brown',
      location: 'New York, NY',
      salary: '$140k - $170k',
      status: 'shortlisted',
      assignedDate: '2024-03-08',
      techStack: ['Vue.js', 'TypeScript', 'GraphQL'],
      description: 'Lead our frontend team in building next-generation applications...',
    },
  ];

  const mockProjects = [
    {
      id: 1,
      name: 'E-commerce Platform',
      description: 'Full-stack e-commerce solution with React and Node.js',
      stars: 234,
      forks: 67,
      language: 'TypeScript',
      updated: '2 days ago',
      url: 'https://github.com/user/ecommerce-platform',
    },
    {
      id: 2,
      name: 'Task Management App',
      description: 'React-based task management with real-time collaboration',
      stars: 156,
      forks: 43,
      language: 'JavaScript',
      updated: '1 week ago',
      url: 'https://github.com/user/task-manager',
    },
    {
      id: 3,
      name: 'API Gateway',
      description: 'Microservices API gateway built with Node.js and Express',
      stars: 89,
      forks: 23,
      language: 'JavaScript',
      updated: '3 days ago',
      url: 'https://github.com/user/api-gateway',
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
              onClick={() => setAvailability(!availability)}
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

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Recent Assignments</h3>
          <div className="space-y-4">
            {mockAssignments.slice(0, 3).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900">{assignment.jobTitle}</div>
                  <div className="text-sm text-gray-600">{assignment.company}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  assignment.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                  assignment.status === 'contacted' ? 'bg-purple-100 text-purple-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {assignment.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-6">Top Projects</h3>
          <div className="space-y-4">
            {mockProjects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{project.name}</div>
                  <div className="text-sm text-gray-600">{project.language}</div>
                </div>
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Star className="w-4 h-4 mr-1 text-yellow-500" />
                    {project.stars}
                  </div>
                  <div className="flex items-center">
                    <GitFork className="w-4 h-4 mr-1" />
                    {project.forks}
                  </div>
                </div>
              </div>
            ))}
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
          {mockAssignments.length} active assignments
        </div>
      </div>

      <div className="grid gap-6">
        {mockAssignments.map((assignment) => (
          <div key={assignment.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-black text-gray-900">{assignment.jobTitle}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    assignment.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                    assignment.status === 'contacted' ? 'bg-purple-100 text-purple-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {assignment.status}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Building className="w-4 h-4 mr-1" />
                    {assignment.company}
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {assignment.location}
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {assignment.salary}
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  {assignment.techStack.map((tech, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  {assignment.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Assigned {assignment.assignedDate}
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Recruiter: {assignment.recruiter}
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
                <div className="flex items-center">
                  <Github className="w-4 h-4 mr-1" />
                  @sarahchen
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  San Francisco, CA
                </div>
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
            <div className="text-2xl font-black text-gray-900 mb-1">892</div>
            <div className="text-sm font-semibold text-gray-600">GitHub Stars</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
            <div className="text-2xl font-black text-gray-900 mb-1">3.2k</div>
            <div className="text-sm font-semibold text-gray-600">Contributions</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            <div className="text-2xl font-black text-gray-900 mb-1">47</div>
            <div className="text-sm font-semibold text-gray-600">Repositories</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200">
            <div className="text-2xl font-black text-gray-900 mb-1">5+</div>
            <div className="text-sm font-semibold text-gray-600">Years Exp</div>
          </div>
        </div>
      </div>

      {/* Skills & Technologies */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Skills & Technologies</h3>
          <button className="text-blue-600 hover:text-blue-700 font-semibold">
            <Edit className="w-4 h-4 mr-1 inline" />
            Edit
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-bold text-gray-900 mb-3">Frontend</h4>
            <div className="flex flex-wrap gap-2">
              {['React', 'TypeScript', 'Vue.js', 'Tailwind CSS', 'Next.js'].map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-3">Backend</h4>
            <div className="flex flex-wrap gap-2">
              {['Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'GraphQL'].map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-lg">
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-3">Tools & DevOps</h4>
            <div className="flex flex-wrap gap-2">
              {['Docker', 'AWS', 'Git', 'CI/CD', 'Kubernetes'].map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-lg">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Projects */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900">Featured Projects</h3>
          <button className="text-blue-600 hover:text-blue-700 font-semibold">
            <Plus className="w-4 h-4 mr-1 inline" />
            Add Project
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {mockProjects.map((project) => (
            <div key={project.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-2">{project.name}</h4>
                  <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      {project.language}
                    </div>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 mr-1 text-yellow-500" />
                      {project.stars}
                    </div>
                    <div className="flex items-center">
                      <GitFork className="w-4 h-4 mr-1" />
                      {project.forks}
                    </div>
                  </div>
                </div>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="text-xs text-gray-500">Updated {project.updated}</div>
            </div>
          ))}
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