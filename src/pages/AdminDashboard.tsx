import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { 
  Users, 
  Briefcase, 
  Building, 
  CheckCircle, 
  XCircle, 
  Loader, 
  AlertCircle,
  Search,
  Filter,
  Clock,
  User,
  Calendar,
  Mail,
  Shield
} from 'lucide-react';

interface PendingRecruiter {
  user_id: string;
  email: string;
  name: string;
  company_name: string;
  created_at: string;
}

export const AdminDashboard = () => {
  const { user, userProfile, loading: authLoading, updateUserApprovalStatus } = useAuth();
  const [activeTab, setActiveTab] = useState('recruiters');
  const [pendingRecruiters, setPendingRecruiters] = useState<PendingRecruiter[]>([]);
  const [approvedRecruiters, setApprovedRecruiters] = useState<PendingRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingIds, setProcessingIds] = useState<string[]>([]);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchRecruiters();
    }
  }, [userProfile]);

  const fetchRecruiters = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch pending recruiters
      const { data: pendingData, error: pendingError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          created_at,
          recruiters!inner(company_name)
        `)
        .eq('role', 'recruiter')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Fetch approved recruiters
      const { data: approvedData, error: approvedError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          created_at,
          recruiters!inner(company_name)
        `)
        .eq('role', 'recruiter')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (approvedError) throw approvedError;

      // Format the data
      const formattedPending = pendingData?.map(item => ({
        user_id: item.id,
        email: item.email,
        name: item.name,
        company_name: item.recruiters.company_name,
        created_at: item.created_at
      })) || [];

      const formattedApproved = approvedData?.map(item => ({
        user_id: item.id,
        email: item.email,
        name: item.name,
        company_name: item.recruiters.company_name,
        created_at: item.created_at
      })) || [];

      setPendingRecruiters(formattedPending);
      setApprovedRecruiters(formattedApproved);
    } catch (error: any) {
      console.error('Error fetching recruiters:', error);
      setError(error.message || 'Failed to load recruiters');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      setProcessingIds(prev => [...prev, userId]);
      setError('');
      
      const success = await updateUserApprovalStatus?.(userId, true);
      
      if (success) {
        setSuccessMessage('Recruiter approved successfully');
        // Update local state
        const approvedRecruiter = pendingRecruiters.find(r => r.user_id === userId);
        if (approvedRecruiter) {
          setPendingRecruiters(prev => prev.filter(r => r.user_id !== userId));
          setApprovedRecruiters(prev => [approvedRecruiter, ...prev]);
        }
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error('Failed to approve recruiter');
      }
    } catch (error: any) {
      console.error('Error approving recruiter:', error);
      setError(error.message || 'Failed to approve recruiter');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== userId));
    }
  };

  const handleReject = async (userId: string) => {
    // In a real application, you might want to handle rejection differently
    // For now, we'll just keep them as pending but you could delete them or mark them as rejected
    try {
      setProcessingIds(prev => [...prev, userId]);
      setError('');
      
      const success = await updateUserApprovalStatus?.(userId, false);
      
      if (success) {
        setSuccessMessage('Recruiter rejected successfully');
        // Update local state
        setPendingRecruiters(prev => prev.filter(r => r.user_id !== userId));
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error('Failed to reject recruiter');
      }
    } catch (error: any) {
      console.error('Error rejecting recruiter:', error);
      setError(error.message || 'Failed to reject recruiter');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== userId));
    }
  };

  const filteredPendingRecruiters = pendingRecruiters.filter(recruiter => 
    recruiter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredApprovedRecruiters = approvedRecruiters.filter(recruiter => 
    recruiter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruiter.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated or not an admin
  if (!userProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  if (userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage recruiters, developers, and platform settings</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('recruiters')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'recruiters'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Building className="w-5 h-5 mr-2" />
                Recruiters
                {pendingRecruiters.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {pendingRecruiters.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('developers')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'developers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Code className="w-5 h-5 mr-2" />
                Developers
              </button>
              <button
                onClick={() => setActiveTab('jobs')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'jobs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Briefcase className="w-5 h-5 mr-2" />
                Jobs
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === 'assignments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5 mr-2" />
                Assignments
              </button>
            </nav>
          </div>
        </div>

        {/* Recruiters Tab */}
        {activeTab === 'recruiters' && (
          <div className="space-y-8">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search recruiters by name, email, or company..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Pending Recruiters Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Clock className="w-6 h-6 text-amber-500 mr-3" />
                  <h2 className="text-xl font-black text-gray-900">Pending Approval</h2>
                  {pendingRecruiters.length > 0 && (
                    <span className="ml-3 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                      {pendingRecruiters.length} pending
                    </span>
                  )}
                </div>
                <button
                  onClick={fetchRecruiters}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                  <span className="text-gray-600 font-medium">Loading recruiters...</span>
                </div>
              ) : filteredPendingRecruiters.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Signup Date</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPendingRecruiters.map((recruiter) => (
                        <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                                {recruiter.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {recruiter.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Building className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.company_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {new Date(recruiter.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleApprove(recruiter.user_id)}
                                disabled={processingIds.includes(recruiter.user_id)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              >
                                {processingIds.includes(recruiter.user_id) ? (
                                  <Loader className="animate-spin w-4 h-4 mr-1" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(recruiter.user_id)}
                                disabled={processingIds.includes(recruiter.user_id)}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              >
                                {processingIds.includes(recruiter.user_id) ? (
                                  <Loader className="animate-spin w-4 h-4 mr-1" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-1" />
                                )}
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Recruiters</h3>
                  <p className="text-gray-600">
                    {searchTerm ? "No recruiters match your search criteria" : "All recruiters have been reviewed"}
                  </p>
                </div>
              )}
            </div>

            {/* Approved Recruiters Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center mb-6">
                <CheckCircle className="w-6 h-6 text-emerald-500 mr-3" />
                <h2 className="text-xl font-black text-gray-900">Approved Recruiters</h2>
                {approvedRecruiters.length > 0 && (
                  <span className="ml-3 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                    {approvedRecruiters.length} approved
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                  <span className="text-gray-600 font-medium">Loading recruiters...</span>
                </div>
              ) : filteredApprovedRecruiters.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Signup Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredApprovedRecruiters.map((recruiter) => (
                        <tr key={recruiter.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3">
                                {recruiter.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {recruiter.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-600">
                              <Building className="w-4 h-4 mr-2 text-gray-400" />
                              {recruiter.company_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {new Date(recruiter.created_at).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Approved Recruiters</h3>
                  <p className="text-gray-600">
                    {searchTerm ? "No recruiters match your search criteria" : "No recruiters have been approved yet"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Developers Tab Placeholder */}
        {activeTab === 'developers' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-6">
              <Code className="w-6 h-6 text-blue-500 mr-3" />
              <h2 className="text-xl font-black text-gray-900">Developers Management</h2>
            </div>
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Developer Management Coming Soon</h3>
              <p className="text-gray-600">
                This section will allow you to manage developer accounts and profiles.
              </p>
            </div>
          </div>
        )}

        {/* Jobs Tab Placeholder */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-6">
              <Briefcase className="w-6 h-6 text-purple-500 mr-3" />
              <h2 className="text-xl font-black text-gray-900">Jobs Management</h2>
            </div>
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Management Coming Soon</h3>
              <p className="text-gray-600">
                This section will allow you to manage job postings across the platform.
              </p>
            </div>
          </div>
        )}

        {/* Assignments Tab Placeholder */}
        {activeTab === 'assignments' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-6">
              <Users className="w-6 h-6 text-emerald-500 mr-3" />
              <h2 className="text-xl font-black text-gray-900">Assignments Management</h2>
            </div>
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Assignment Management Coming Soon</h3>
              <p className="text-gray-600">
                This section will allow you to create and manage developer-job assignments.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Import the Code icon
import { Code } from 'lucide-react';