import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader,
  AlertCircle,
  Building,
  Mail,
  Calendar,
  User,
  Briefcase,
  MapPin,
  FileText,
} from 'lucide-react';

interface Props {
  recruiterId: string;
}

interface RecruiterUser {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  is_approved?: boolean | null;
}

interface RecruiterProfileRow {
  user_id: string;
  company_name: string | null;
  website?: string | null;
  created_at?: string;
}

interface AssignmentRow {
  id: string;
  recruiter_id: string;
  developer_id: string;
  job_role_id: string;
  status: string;
  assigned_at?: string | null;
  created_at?: string;
  notes?: string | null;
}

interface UserMinimal {
  id: string;
  name: string | null;
  email?: string | null;
}

interface JobRoleMinimal {
  id: string;
  title: string;
  location: string;
  job_type: string | null;
  created_at: string;
  is_active: boolean;
  is_featured?: boolean | null;
  // Support both possible DB schemas for salary
  salary?: string | null; // Newer schema (TEXT or similar)
  salary_min?: number | null; // Legacy schema
  salary_max?: number | null; // Legacy schema
  tech_stack?: string[];
}

type EnrichedAssignment = AssignmentRow & {
  developer_user?: UserMinimal | null;
  job_role?: JobRoleMinimal | null;
};

export const AdminRecruiterProfileDetails: React.FC<Props> = ({ recruiterId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recruiterUser, setRecruiterUser] = useState<RecruiterUser | null>(null);
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfileRow | null>(null);

  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
  const [jobs, setJobs] = useState<JobRoleMinimal[]>([]);

  const totalAssignments = assignments.length;
  const activeJobsCount = useMemo(() => jobs.filter(j => j.is_active).length, [jobs]);

  const formatSalary = (j: Partial<JobRoleMinimal>) => {
    if (j.salary) return j.salary as string;
    if (j.salary_min != null && j.salary_max != null) return `$${j.salary_min}k - $${j.salary_max}k`;
    return '—';
  };

  useEffect(() => {
    if (!recruiterId) return;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Recruiter user (no joins)
        const { data: userRow, error: userErr } = await supabase
          .from('users')
          .select('id, name, email, created_at, is_approved')
          .eq('id', recruiterId)
          .maybeSingle();
        if (userErr) throw userErr;
        setRecruiterUser(userRow as RecruiterUser);

        // 2) Recruiter profile row (company_name, website, etc.)
        const { data: recRow, error: recErr } = await supabase
          .from('recruiters')
          .select('user_id, company_name, website, created_at')
          .eq('user_id', recruiterId)
          .maybeSingle();
        if (recErr) throw recErr;
        setRecruiterProfile(recRow as RecruiterProfileRow);

        // 3) Fetch recruiter's jobs — use '*' to avoid selecting non-existent columns
        const { data: jobRows, error: jobsErr } = await supabase
          .from('job_roles')
          .select('*')
          .eq('recruiter_id', recruiterId)
          .order('created_at', { ascending: false });
        if (jobsErr) throw jobsErr;
        setJobs((jobRows || []) as JobRoleMinimal[]);

        // 4) Fetch assignments with safe columns only (no nested joins)
        // Try to order by assigned_at, fallback to created_at if assigned_at doesn't exist
        let assignmentsData: AssignmentRow[] = [];

        const { data: a1, error: e1 } = await supabase
          .from('assignments')
          .select('id, recruiter_id, developer_id, job_role_id, status, assigned_at, created_at, notes')
          .eq('recruiter_id', recruiterId)
          .order('assigned_at', { ascending: false });

        if (e1) {
          // Fallback: try ordering by created_at
          const { data: a2, error: e2 } = await supabase
            .from('assignments')
            .select('id, recruiter_id, developer_id, job_role_id, status, assigned_at, created_at, notes')
            .eq('recruiter_id', recruiterId)
            .order('created_at', { ascending: false });
          if (e2) throw e2;
          assignmentsData = (a2 || []) as AssignmentRow[];
        } else {
          assignmentsData = (a1 || []) as AssignmentRow[];
        }

        // 5) Enrich assignments with developer users and job roles via separate queries
        const developerIds = Array.from(new Set(assignmentsData.map(a => a.developer_id))).filter(Boolean);
        const jobRoleIds = Array.from(new Set(assignmentsData.map(a => a.job_role_id))).filter(Boolean);

        let devUserMap: Record<string, UserMinimal> = {};
        if (developerIds.length > 0) {
          const { data: devUsers, error: devErr } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', developerIds);
          if (devErr) throw devErr;
          for (const u of devUsers || []) devUserMap[u.id] = { id: u.id, name: u.name, email: u.email || null };
        }

        let jobRoleMap: Record<string, JobRoleMinimal> = {};
        if (jobRoleIds.length > 0) {
          // Use '*' here as well to avoid selecting dropped columns
          const { data: jrRows, error: jrErr } = await supabase
            .from('job_roles')
            .select('*')
            .in('id', jobRoleIds);
          if (jrErr) throw jrErr;
          for (const jr of jrRows || []) jobRoleMap[(jr as any).id] = jr as any;
        }

        const enriched: EnrichedAssignment[] = assignmentsData.map(a => ({
          ...a,
          developer_user: devUserMap[a.developer_id] || null,
          job_role: jobRoleMap[a.job_role_id] || null,
        }));

        setAssignments(enriched);
      } catch (e: any) {
        console.error('Error fetching recruiter data:', e);
        setError(e?.message || 'Failed to load recruiter');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [recruiterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <Building className="w-6 h-6 text-gray-500" />
              <h2 className="text-2xl font-black text-gray-900">{recruiterUser?.name || 'Recruiter'}</h2>
              {recruiterUser?.is_approved ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  Approved
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                  Pending
                </span>
              )}
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <span>{recruiterUser?.email || '—'}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <span>
                  Joined {recruiterUser?.created_at ? new Date(recruiterUser.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            {recruiterProfile?.company_name && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center">
                  <Building className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="font-bold text-gray-900">{recruiterProfile.company_name}</span>
                </div>
                {recruiterProfile.website && (
                  <div className="mt-1 text-sm text-blue-600">
                    <a href={recruiterProfile.website} target="_blank" rel="noopener noreferrer">
                      {recruiterProfile.website}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div className="text-xs text-gray-500">Jobs</div>
              <div className="text-xl font-black text-gray-900">{jobs.length}</div>
            </div>
            <div className="text-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div className="text-xs text-gray-500">Active</div>
              <div className="text-xl font-black text-gray-900">{activeJobsCount}</div>
            </div>
            <div className="text-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div className="text-xs text-gray-500">Assignments</div>
              <div className="text-xl font-black text-gray-900">{totalAssignments}</div>
            </div>
            <div className="text-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div className="text-xs text-gray-500">Featured</div>
              <div className="text-xl font-black text-gray-900">{jobs.filter(j => j.is_featured).length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Job postings */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center mb-6">
          <Briefcase className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-black text-gray-900">Job Postings</h3>
        </div>

        {jobs.length === 0 ? (
          <div className="text-sm text-gray-600">No jobs posted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Posted</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map(j => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{j.title}</div>
                      {(j.tech_stack || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(j.tech_stack || []).slice(0, 3).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {t}
                            </span>
                          ))}
                          {(j.tech_stack || []).length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                              +{(j.tech_stack || []).length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                        {j.location || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatSalary(j)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(j.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded-full ${
                          j.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {j.is_active ? 'Active' : 'Paused'}
                      </span>
                      {j.is_featured && (
                        <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
                          Featured
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignments */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center mb-6">
          <User className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-black text-gray-900">Developer Assignments</h3>
        </div>

        {assignments.length === 0 ? (
          <div className="text-sm text-gray-600">No developer assignments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Developer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Job Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Assigned
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{a.developer_user?.name || 'Unknown developer'}</div>
                      <div className="text-sm text-gray-500">{a.developer_user?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{a.job_role?.title || 'Unknown job'}</div>
                      <div className="text-sm text-gray-500">{a.job_role?.location || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {a.assigned_at
                        ? new Date(a.assigned_at).toLocaleDateString()
                        : a.created_at
                        ? new Date(a.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {assignments.some(a => a.notes) && (
          <div className="mt-6">
            <div className="flex items-center mb-2">
              <FileText className="w-4 h-4 text-gray-500 mr-2" />
              <div className="text-sm font-bold text-gray-900">Assignment Notes Present</div>
            </div>
            <p className="text-sm text-gray-500">
              Some assignments have notes. Extend the table to display them if required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
