import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Building,
  Code,
  Briefcase,
  DollarSign,
  CheckCircle,
  Search,
  Loader,
  AlertCircle,
  Star,
  Eye,
  Trash2,
  Calendar,
  BarChart,
  PieChart,
  X,
  Clock,
  Check,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

// Use the shared developer details; admin-only recruiter and job details to avoid schema-join issues
import { DeveloperProfileDetails } from '../components/Profile/DeveloperProfileDetails';
import { AdminJobRoleDetails } from '../components/Admin/AdminJobRoleDetails';
import { AdminRecruiterProfileDetails } from '../components/Admin/AdminRecruiterProfileDetails';

type AdminTab = 'overview' | 'recruiters' | 'developers' | 'jobs' | 'hires';

interface AdminDeveloper {
  user_id: string;
  github_handle: string | null;
  top_languages: string[];
  location: string | null;
  experience_years: number | null;
  availability: boolean | null;
  profile_pic_url?: string | null;
  user: { id: string; name: string; email: string };
}

interface AdminJobRole {
  id: string;
  title: string;
  description: string;
  location: string;
  job_type: string | null;
  salary?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  is_active: boolean;
  is_featured: boolean | null;
  created_at: string;
  recruiter_id: string;
  tech_stack: string[];
  recruiter?: { id: string; name: string } | null;
}

interface AdminHire {
  id: string;
  salary: number;
  hire_date: string;
  start_date: string | null;
  created_at: string;
  assignment_id: string;
  assignment?: {
    id: string;
    job_role_id: string;
    recruiter_id: string;
    developer_id: string;
    job_role?: AdminJobRole | null;
    recruiter_user?: { id: string; name: string } | null;
    developer_user?: { id: string; name: string } | null;
  } | null;
}

interface SimpleRecruiterRow {
  user_id: string;
  email: string;
  name: string;
  company_name: string | null;
  created_at: string;
  is_approved: boolean;
}

export const AdminDashboard: React.FC = () => {
  const { userProfile, loading: authLoading, updateUserApprovalStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const tabParam = (params.get('tab') || 'overview') as AdminTab;
  const activeTab: AdminTab = ['overview', 'recruiters', 'developers', 'jobs', 'hires'].includes(tabParam)
    ? tabParam
    : 'overview';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [pendingRecruiters, setPendingRecruiters] = useState<SimpleRecruiterRow[]>([]);
  const [approvedRecruiters, setApprovedRecruiters] = useState<SimpleRecruiterRow[]>([]);
  const [developers, setDevelopers] = useState<AdminDeveloper[]>([]);
  const [jobs, setJobs] = useState<AdminJobRole[]>([]);
  const [hires, setHires] = useState<AdminHire[]>([]);

  const [showDeveloperModal, setShowDeveloperModal] = useState(false);
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string | null>(null);

  const [showRecruiterModal, setShowRecruiterModal] = useState(false);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);

  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [processingRecruiter, setProcessingRecruiter] = useState<string | null>(null);

  const recruiterCount = useMemo(
    () => approvedRecruiters.length + pendingRecruiters.length,
    [approvedRecruiters, pendingRecruiters],
  );
  const developerCount = useMemo(() => developers.length, [developers]);
  const hireCount = useMemo(() => hires.length, [hires]);
  const totalRevenue = useMemo(() => hires.reduce((sum, h) => sum + Math.round((h.salary || 0) * 0.15), 0), [hires]);

  useEffect(() => {
    if (!userProfile || userProfile.role !== 'admin') return;

    const run = async () => {
      try {
        setError('');
        setLoading(true);

        if (activeTab === 'overview') {
          await Promise.all([fetchRecruiters(), fetchDevelopers(), fetchJobs(), fetchHires()]);
        } else if (activeTab === 'recruiters') {
          await fetchRecruiters();
        } else if (activeTab === 'developers') {
          await fetchDevelopers();
        } else if (activeTab === 'jobs') {
          await fetchJobs();
        } else if (activeTab === 'hires') {
          await fetchHires();
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load admin data.');
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, activeTab]);

  const formatSalary = (job: Partial<AdminJobRole>): string => {
    if (job.salary) return job.salary;
    if (job.salary_min != null && job.salary_max != null) return `$${job.salary_min}k - $${job.salary_max}k`;
    return '—';
  };

  const fetchRecruiters = async () => {
    const { data: pendingUsers, error: pendingErr } = await supabase
      .from('users')
      .select('id, email, name, created_at, is_approved, role')
      .eq('role', 'recruiter')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    if (pendingErr) throw pendingErr;

    const { data: approvedUsers, error: approvedErr } = await supabase
      .from('users')
      .select('id, email, name, created_at, is_approved, role')
      .eq('role', 'recruiter')
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    if (approvedErr) throw approvedErr;

    const allIds = [...(pendingUsers?.map(u => u.id) || []), ...(approvedUsers?.map(u => u.id) || [])];
    let companyByUser: Record<string, string | null> = {};
    if (allIds.length > 0) {
      const { data: recs } = await supabase.from('recruiters').select('user_id, company_name').in('user_id', allIds);
      for (const r of recs || []) companyByUser[r.user_id] = r.company_name ?? null;
    }

    setPendingRecruiters(
      (pendingUsers || []).map(u => ({
        user_id: u.id,
        email: u.email,
        name: u.name,
        created_at: u.created_at,
        is_approved: false,
        company_name: companyByUser[u.id] ?? null,
      })),
    );

    setApprovedRecruiters(
      (approvedUsers || []).map(u => ({
        user_id: u.id,
        email: u.email,
        name: u.name,
        created_at: u.created_at,
        is_approved: true,
        company_name: companyByUser[u.id] ?? null,
      })),
    );
  };

  const fetchDevelopers = async () => {
    const { data, error } = await supabase
      .from('developers')
      .select('*, user:users(id, name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setDevelopers((data as any) || []);
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('job_roles')
      .select('*, recruiter:users!job_roles_recruiter_id_fkey(id, name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setJobs((data as any) || []);
  };

  const fetchHires = async () => {
    const { data: hiresData, error: hiresErr } = await supabase
      .from('hires')
      .select('id, salary, hire_date, start_date, created_at, assignment_id');
    if (hiresErr) throw hiresErr;

    if (!hiresData || hiresData.length === 0) {
      setHires([]);
      return;
    }

    const assignmentIds = Array.from(new Set(hiresData.map(h => h.assignment_id).filter(Boolean)));
    let assignments: Array<{ id: string; job_role_id: string; recruiter_id: string; developer_id: string }> = [];

    if (assignmentIds.length > 0) {
      const { data: asgData, error: asgErr } = await supabase
        .from('assignments')
        .select('id, job_role_id, recruiter_id, developer_id')
        .in('id', assignmentIds);
      if (asgErr) throw asgErr;
      assignments = asgData || [];
    }

    const jobRoleIds = Array.from(new Set(assignments.map(a => a.job_role_id)));
    let jobRoleMap: Record<string, AdminJobRole> = {};
    if (jobRoleIds.length > 0) {
      const { data: jrData, error: jrErr } = await supabase.from('job_roles').select('*').in('id', jobRoleIds);
      if (jrErr) throw jrErr;
      for (const jr of jrData || []) jobRoleMap[(jr as any).id] = jr as any;
    }

    const userIds = Array.from(new Set(assignments.flatMap(a => [a.developer_id, a.recruiter_id])));
    let userMap: Record<string, { id: string; name: string }> = {};
    if (userIds.length > 0) {
      const { data: uData, error: uErr } = await supabase.from('users').select('id, name').in('id', userIds);
      if (uErr) throw uErr;
      for (const u of uData || []) userMap[u.id] = { id: u.id, name: u.name };
    }

    const assignmentMap: Record<string, AdminHire['assignment']> = {};
    for (const a of assignments) {
      assignmentMap[a.id] = {
        id: a.id,
        job_role_id: a.job_role_id,
        recruiter_id: a.recruiter_id,
        developer_id: a.developer_id,
        job_role: jobRoleMap[a.job_role_id] || null,
        recruiter_user: userMap[a.recruiter_id] || null,
        developer_user: userMap[a.developer_id] || null,
      };
    }

    const final: AdminHire[] = (hiresData as any).map((h: any) => ({
      ...h,
      assignment: h.assignment_id ? assignmentMap[h.assignment_id] || null : null,
    }));

    setHires(final);
  };

  const handleApproveRecruiter = async (recruiterId: string) => {
    setProcessingRecruiter(recruiterId);
    setError('');
    
    try {
      const success = await updateUserApprovalStatus(recruiterId, true);

      if (!success) {
        throw new Error('The approval process failed in the Edge Function.');
      }

      setSuccessMessage('Recruiter approved successfully. They will be notified by email.');
      setTimeout(() => setSuccessMessage(''), 4000);
      await fetchRecruiters();
    } catch (e: any) {
      console.error('Approve recruiter error:', e);
      setError(e?.message || 'Failed to approve recruiter');
    } finally {
      setProcessingRecruiter(null);
    }
  };

  const handleDenyRecruiter = async (recruiterId: string) => {
    if (!confirm('Are you sure you want to deny this recruiter? This action cannot be undone.')) return;
    
    setProcessingRecruiter(recruiterId);
    setError('');
    
    try {
      console.log('Attempting to deny recruiter:', recruiterId);
      
      const { data, error } = await supabase.rpc('deny_recruiter', {
        recruiter_id: recruiterId
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      console.log('Recruiter denied successfully:', data);
      setSuccessMessage('Recruiter denied and removed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchRecruiters();
    } catch (e: any) {
      console.error('Deny recruiter error:', e);
      setError(e?.message || 'Failed to deny recruiter');
    } finally {
      setProcessingRecruiter(null);
    }
  };

  const handleFeatureJob = async (jobId: string, isFeatured: boolean) => {
    setError('');
    const { error } = await supabase.from('job_roles').update({ is_featured: !isFeatured }).eq('id', jobId);
    if (error) {
      setError(error.message || 'Failed to update job');
    } else {
      setSuccessMessage(`Job ${isFeatured ? 'unfeatured' : 'featured'} successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchJobs();
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    setError('');
    const { error } = await supabase.from('job_roles').delete().eq('id', jobId);
    if (error) {
      setError(error.message || 'Failed to delete job');
    } else {
      setSuccessMessage('Job deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchJobs();
    }
  };

  const filteredPendingRecruiters = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return pendingRecruiters.filter(
      r =>
        r.name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        (r.company_name || '').toLowerCase().includes(s),
    );
  }, [pendingRecruiters, searchTerm]);

  const filteredApprovedRecruiters = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return approvedRecruiters.filter(
      r =>
        r.name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        (r.company_name || '').toLowerCase().includes(s),
    );
  }, [approvedRecruiters, searchTerm]);

  const filteredDevelopers = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return developers.filter(
      d =>
        d.user.name.toLowerCase().includes(s) ||
        d.user.email.toLowerCase().includes(s) ||
        (d.github_handle || '').toLowerCase().includes(s) ||
        (d.top_languages || []).some(lang => (lang || '').toLowerCase().includes(s)),
    );
  }, [developers, searchTerm]);

  const filteredJobs = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return jobs.filter(
      j =>
        j.title.toLowerCase().includes(s) ||
        (j.location || '').toLowerCase().includes(s) ||
        (j.recruiter?.name || '').toLowerCase().includes(s) ||
        (j.tech_stack || []).some(t => (t || '').toLowerCase().includes(s)),
    );
  }, [jobs, searchTerm]);

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

  if (!userProfile || userProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage recruiters, developers, jobs, hires, and tests</p>
        </div>

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex flex-wrap space-x-6">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'recruiters', label: 'Recruiters' },
                { id: 'developers', label: 'Developers' },
                { id: 'jobs', label: 'Job Listings' },
                { id: 'hires', label: 'Hires Report' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => navigate(`/admin?tab=${tab.id}`)}
                  className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                    activeTab === (tab.id as AdminTab)
                      ? 'border-blue-500 text-blue-600 bg-gray-100'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg mb-4">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{recruiterCount}</div>
                <div className="text-sm text-gray-600">Total Recruiters</div>
                <div className="text-xs text-emerald-600 font-medium mt-1">{pendingRecruiters.length} pending</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg mb-4">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{developerCount}</div>
                <div className="text-sm text-gray-600">Total Developers</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg mb-4">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{jobs.length}</div>
                <div className="text-sm text-gray-600">Active Job Listings</div>
                <div className="text-xs text-emerald-600 font-medium mt-1">
                  {jobs.filter(j => j.is_featured).length} featured
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg mb-4">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{hireCount}</div>
                <div className="text-sm text-gray-600">Successful Hires</div>
                <div className="text-xs text-emerald-600 font-medium mt-1">${totalRevenue.toLocaleString()} revenue</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-black text-gray-900 mb-6">Quick Actions</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <button
                  onClick={() => navigate('/admin?tab=recruiters')}
                  className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                  <Building className="w-8 h-8 text-blue-600 mb-3" />
                  <span className="font-semibold text-gray-900">Manage Recruiters</span>
                  <span className="text-sm text-gray-600 mt-1">Approve and monitor recruiters</span>
                </button>
                <button
                  onClick={() => navigate('/admin?tab=developers')}
                  className="flex flex-col items-center justify-center p-6 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors"
                >
                  <Code className="w-8 h-8 text-purple-600 mb-3" />
                  <span className="font-semibold text-gray-900">View Developers</span>
                  <span className="text-sm text-gray-600 mt-1">Browse developer profiles</span>
                </button>
                <button
                  onClick={() => navigate('/admin?tab=jobs')}
                  className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
                >
                  <Briefcase className="w-8 h-8 text-emerald-600 mb-3" />
                  <span className="font-semibold text-gray-900">Manage Jobs</span>
                  <span className="text-sm text-gray-600 mt-1">Feature and monitor jobs</span>
                </button>
                <button
                  onClick={() => navigate('/admin?tab=hires')}
                  className="flex flex-col items-center justify-center p-6 bg-orange-50 rounded-xl border border-orange-100 hover:bg-orange-100 transition-colors"
                >
                  <DollarSign className="w-8 h-8 text-orange-600 mb-3" />
                  <span className="font-semibold text-gray-900">View Hires</span>
                  <span className="text-sm text-gray-600 mt-1">Track placements</span>
                </button>
                <button
                  onClick={() => navigate('/admin/tests')}
                  className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <Code className="w-8 h-8 text-gray-600 mb-3" />
                  <span className="font-semibold text-gray-900">Manage Tests</span>
                  <span className="text-sm text-gray-600 mt-1">Create and edit coding tests</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <BarChart className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Detailed analytics coming soon</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <PieChart className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Detailed analytics coming soon</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recruiters' && (
          <div className="space-y-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search recruiters by name, email, or company..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Clock className="w-6 h-6 text-amber-500 mr-3" />
                  <h2 className="text-xl font-black text-gray-900">Pending Approval</h2>
                  {pendingRecruiters.length > 0 && (
                    <span className="ml-3 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                      {pendingRecruiters.length}
                    </span>
                  )}
                </div>
                <button onClick={fetchRecruiters} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
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
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Signup Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPendingRecruiters.map(r => (
                        <tr key={r.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedRecruiterId(r.user_id);
                                setShowRecruiterModal(true);
                              }}
                              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {r.name}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <div className="flex items-center">{r.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.company_name || '—'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {new Date(r.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleApproveRecruiter(r.user_id)}
                                disabled={processingRecruiter === r.user_id}
                                className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {processingRecruiter === r.user_id ? (
                                  <Loader className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Check className="w-3 h-3 mr-1" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleDenyRecruiter(r.user_id)}
                                disabled={processingRecruiter === r.user_id}
                                className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {processingRecruiter === r.user_id ? (
                                  <Loader className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <XCircle className="w-3 h-3 mr-1" />
                                )}
                                Deny
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRecruiterId(r.user_id);
                                  setShowRecruiterModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50"
                                title="View recruiter"
                              >
                                <Eye className="w-4 h-4" />
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
                  <p className="text-gray-600">All recruiters have been reviewed</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center mb-6">
                <CheckCircle className="w-6 h-6 text-emerald-500 mr-3" />
                <h2 className="text-xl font-black text-gray-900">Approved Recruiters</h2>
                {approvedRecruiters.length > 0 && (
                  <span className="ml-3 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                    {approvedRecruiters.length}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                  <span className="text-gray-600 font-medium">Loading recruiters...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Signup Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredApprovedRecruiters.map(r => (
                        <tr key={r.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedRecruiterId(r.user_id);
                                setShowRecruiterModal(true);
                              }}
                              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {r.name}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.company_name || '—'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              {new Date(r.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedRecruiterId(r.user_id);
                                setShowRecruiterModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50"
                              title="View recruiter"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'developers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">Developers</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search developers..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                <span className="text-gray-600 font-medium">Loading developers...</span>
              </div>
            ) : filteredDevelopers.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">GitHub</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Skills</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Experience
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDevelopers.map(dev => (
                        <tr key={dev.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{dev.user.name}</div>
                            <div className="text-sm text-gray-500">{dev.user.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {dev.github_handle ? (
                              <a
                                href={`https://github.com/${dev.github_handle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                @{dev.github_handle}
                              </a>
                            ) : (
                              <span className="text-gray-500">Not provided</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {(dev.top_languages || []).slice(0, 3).map((lang, i) => (
                                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                  {lang}
                                </span>
                              ))}
                              {(dev.top_languages || []).length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                                  +{(dev.top_languages || []).length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dev.location || '—'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dev.experience_years ?? '—'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                dev.availability ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {dev.availability ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedDeveloperId(dev.user_id);
                                  setShowDeveloperModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Profile"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
                <Code className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Developers Found</h3>
                <p className="text-gray-600">There are no developers registered yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">Job Listings</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                <span className="text-gray-600 font-medium">Loading jobs...</span>
              </div>
            ) : filteredJobs.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Recruiter
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Posted</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredJobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{job.title}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(job.tech_stack || []).slice(0, 3).map((t, i) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {job.recruiter?.name || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.location}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatSalary(job)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {job.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {job.is_featured && (
                              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                Featured
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(job.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleFeatureJob(job.id, !!job.is_featured)}
                                className={`p-1 rounded-lg ${
                                  job.is_featured
                                    ? 'text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50'
                                    : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                                }`}
                                title={job.is_featured ? 'Unfeature' : 'Feature'}
                              >
                                <Star className="w-5 h-5" fill={job.is_featured ? 'currentColor' : 'none'} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  setShowJobModal(true);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg"
                                title="View Job Details"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                                title="Delete Job"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
                <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jobs Found</h3>
                <p className="text-gray-600">There are no job postings yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'hires' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">Hires Report</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search hires..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                <span className="text-gray-600 font-medium">Loading hires...</span>
              </div>
            ) : hires.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Developer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Job Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Recruiter
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Salary
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Platform Fee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Hire Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Start Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {hires.map(h => (
                        <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {h.assignment?.developer_user?.name || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {h.assignment?.job_role?.title || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {h.assignment?.recruiter_user?.name || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              ${Number(h.salary || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-emerald-600">
                              ${Math.round((h.salary || 0) * 0.15).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(h.hire_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {h.start_date ? new Date(h.start_date).toLocaleDateString() : 'Not set'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Hires Found</h3>
                <p className="text-gray-600">There are no successful hires recorded yet</p>
              </div>
            )}
          </div>
        )}

        {showDeveloperModal && selectedDeveloperId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-2xl font-black text-gray-900">Developer Profile</h2>
                <button
                  onClick={() => setShowDeveloperModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <DeveloperProfileDetails developerId={selectedDeveloperId} />
              </div>
            </div>
          </div>
        )}

        {showRecruiterModal && selectedRecruiterId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-2xl font-black text-gray-900">Recruiter Profile</h2>
                <button
                  onClick={() => setShowRecruiterModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <AdminRecruiterProfileDetails recruiterId={selectedRecruiterId} />
              </div>
            </div>
          </div>
        )}

        {showJobModal && selectedJobId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
              <div className="p-6 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-2xl font-black text-gray-900">Job Details</h2>
                <button
                  onClick={() => setShowJobModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <AdminJobRoleDetails jobRoleId={selectedJobId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
