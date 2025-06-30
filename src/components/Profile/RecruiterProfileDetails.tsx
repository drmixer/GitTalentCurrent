import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Building, 
  Globe, 
  Users, 
  Briefcase, 
  Award, 
  Mail, 
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  Loader,
  AlertCircle,
  X,
  Lock
} from 'lucide-react';
import { Recruiter, User as UserType, JobRole, Assignment, Hire } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface RecruiterProfileDetailsProps {
  recruiterId: string;
  onClose?: () => void;
}

export const RecruiterProfileDetails: React.FC<RecruiterProfileDetailsProps> = ({
  recruiterId,
  onClose
}) => {
  const { userProfile } = useAuth();
  const [recruiter, setRecruiter] = useState<Recruiter & { user: UserType } | null>(null);
  const [jobs, setJobs] = useState<JobRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [hasRecruiterContact, setHasRecruiterContact] = useState(false);

  useEffect(() => {
    if (recruiterId) {
      fetchRecruiterData();
    }
  }, [recruiterId]);

  const fetchRecruiterData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch recruiter with user data
      const { data: recruiterData, error: recruiterError } = await supabase
        .from('recruiters')
        .select(`
          *,
          user:users(*)
        `)
        .eq('user_id', recruiterId)
        .single();

      if (recruiterError) throw recruiterError;
      setRecruiter(recruiterData);

      // Check if the current user (if developer) has been contacted by this recruiter
      if (userProfile?.role === 'developer') {
        const { count, error: messagesError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', recruiterId)
          .eq('receiver_id', userProfile.id);
          
        if (messagesError) throw messagesError;
        
        setHasRecruiterContact(count ? count > 0 : false);
      } else {
        // Admin or recruiter viewing - always show full profile
        setHasRecruiterContact(true);
      }

      // Fetch job roles
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_roles')
        .select('*')
        .eq('recruiter_id', recruiterId)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(*),
          job_role:job_roles(*)
        `)
        .eq('recruiter_id', recruiterId)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch hires
      const { data: hiresData, error: hiresError } = await supabase
        .from('hires')
        .select(`
          *,
          assignment:assignments(
            *,
            developer:users!assignments_developer_id_fkey(*),
            job_role:job_roles(*)
          )
        `)
        .eq('assignment.recruiter_id', recruiterId);

      if (hiresError) throw hiresError;
      setHires(hiresData || []);

    } catch (error: any) {
      console.error('Error fetching recruiter data:', error);
      setError(error.message || 'Failed to load recruiter profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading recruiter profile...</span>
      </div>
    );
  }

  if (error || !recruiter) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <p className="text-red-800 font-medium">{error || 'Recruiter profile not found'}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Determine if we should show limited info (for developers who haven't been contacted)
  const showLimitedInfo = userProfile?.role === 'developer' && !hasRecruiterContact;

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'hires', label: 'Hires' },
  ];

  // Calculate stats
  const stats = {
    totalJobs: jobs.length,
    activeJobs: jobs.filter(job => job.is_active).length,
    totalAssignments: assignments.length,
    totalHires: hires.length,
    totalRevenue: hires.reduce((sum, hire) => sum + Math.round(hire.salary * 0.15), 0)
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-5xl mx-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-gray-900">Recruiter Profile</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Profile Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-8 border border-purple-100">
        <div className="flex items-start md:items-center flex-col md:flex-row md:justify-between">
          <div className="flex items-center space-x-6 mb-4 md:mb-0">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">
              {recruiter.user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">{recruiter.user.name}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {!showLimitedInfo && (
                  <div className="flex items-center">
                    <Building className="w-4 h-4 mr-1" />
                    {recruiter.company_name}
                  </div>
                )}
                {(userProfile?.role === 'admin' || hasRecruiterContact) && (
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    {recruiter.user.email}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
              recruiter.user.is_approved 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                recruiter.user.is_approved ? 'bg-emerald-500' : 'bg-yellow-500'
              }`}></div>
              {recruiter.user.is_approved ? 'Approved' : 'Pending Approval'}
            </span>
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-blue-100 text-blue-800 border border-blue-200">
              <Calendar className="w-4 h-4 mr-2" />
              Joined {new Date(recruiter.user.created_at).toLocaleDateString()}
            </span>
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
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'profile' && (
        <div className="space-y-8">
          {/* Profile Stats */}
          {!showLimitedInfo && (
            <div className="grid md:grid-cols-5 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalJobs}</div>
                <div className="text-sm font-semibold text-gray-600">Total Jobs</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                <div className="text-2xl font-black text-gray-900 mb-1">{stats.activeJobs}</div>
                <div className="text-sm font-semibold text-gray-600">Active Jobs</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalAssignments}</div>
                <div className="text-sm font-semibold text-gray-600">Assignments</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100">
                <div className="text-2xl font-black text-gray-900 mb-1">{stats.totalHires}</div>
                <div className="text-sm font-semibold text-gray-600">Hires</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-100">
                <div className="text-2xl font-black text-gray-900 mb-1">${stats.totalRevenue.toLocaleString()}</div>
                <div className="text-sm font-semibold text-gray-600">Est. Revenue</div>
              </div>
            </div>
          )}

          {/* Company Info */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-6">Company Information</h3>
            {showLimitedInfo ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center">
                  <Lock className="w-5 h-5 text-blue-500 mr-3" />
                  <div>
                    <p className="text-blue-800 font-medium">Company details will be visible after the recruiter contacts you</p>
                    <p className="text-blue-600 text-sm mt-1">The recruiter will reach out if they're interested in your profile</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-gray-600">
                <div className="flex items-center">
                  <Building className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-medium">Company: </span>
                  <span className="ml-2">{recruiter.company_name}</span>
                </div>
                {recruiter.website && (
                  <div className="flex items-center">
                    <Globe className="w-5 h-5 mr-3 text-gray-400" />
                    <span className="font-medium">Website: </span>
                    <a 
                      href={recruiter.website.startsWith('http') ? recruiter.website : `https://${recruiter.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {recruiter.website}
                    </a>
                  </div>
                )}
                {recruiter.company_size && (
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-3 text-gray-400" />
                    <span className="font-medium">Company Size: </span>
                    <span className="ml-2">{recruiter.company_size}</span>
                  </div>
                )}
                {recruiter.industry && (
                  <div className="flex items-center">
                    <Briefcase className="w-5 h-5 mr-3 text-gray-400" />
                    <span className="font-medium">Industry: </span>
                    <span className="ml-2">{recruiter.industry}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Info */}
          {!showLimitedInfo && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-900 mb-6">Account Information</h3>
              <div className="space-y-4 text-gray-600">
                <div className="flex items-center">
                  <Mail className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-medium">Email: </span>
                  <span className="ml-2">{recruiter.user.email}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-medium">Account Created: </span>
                  <span className="ml-2">{new Date(recruiter.user.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-medium">Account Status: </span>
                  <span className={`ml-2 ${recruiter.user.is_approved ? 'text-emerald-600' : 'text-yellow-600'}`}>
                    {recruiter.user.is_approved ? 'Approved' : 'Pending Approval'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'jobs' && !showLimitedInfo && (
        <div className="space-y-6">
          <h3 className="text-lg font-black text-gray-900 mb-4">Posted Jobs</h3>
          
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-bold text-gray-900">{job.title}</h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {job.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
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
                      <div className="flex flex-wrap gap-2 mb-3">
                        {job.tech_stack.map((tech, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {tech}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      Posted {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No jobs posted</p>
              <p className="text-sm text-gray-500 mt-2">This recruiter hasn't posted any jobs yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'assignments' && !showLimitedInfo && (
        <div className="space-y-6">
          <h3 className="text-lg font-black text-gray-900 mb-4">Developer Assignments</h3>
          
          {assignments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Role</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                            {assignment.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {assignment.developer?.name || 'Unknown'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {assignment.job_role?.title || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                          assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                          assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {assignment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(assignment.assigned_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No assignments</p>
              <p className="text-sm text-gray-500 mt-2">This recruiter hasn't been assigned any developers yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'hires' && !showLimitedInfo && (
        <div className="space-y-6">
          <h3 className="text-lg font-black text-gray-900 mb-4">Successful Hires</h3>
          
          {hires.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Role</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hire Date</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Commission</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {hires.map((hire) => (
                    <tr key={hire.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white font-bold text-xs mr-3">
                            {hire.assignment?.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {hire.assignment?.developer?.name || 'Unknown'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {hire.assignment?.job_role?.title || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          ${hire.salary.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(hire.hire_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-emerald-600">
                          ${Math.round(hire.salary * 0.15).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No hires yet</p>
              <p className="text-sm text-gray-500 mt-2">This recruiter hasn't made any successful hires yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};