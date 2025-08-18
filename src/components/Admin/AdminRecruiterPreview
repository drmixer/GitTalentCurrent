import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader, AlertCircle, Calendar, Mail, Building } from 'lucide-react';

interface Props {
  recruiterId: string;
}

interface RecruiterUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_approved: boolean;
}

interface RecruiterRow {
  user_id: string;
  company_name: string | null;
}

interface AssignmentRow {
  id: string;
  recruiter_id: string;
  developer_id: string;
  job_role_id: string;
  assigned_at: string;
}

interface JobRoleRow {
  id: string;
  title: string;
  location: string;
}

export const AdminRecruiterPreview: React.FC<Props> = ({ recruiterId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<RecruiterUser | null>(null);
  const [recruiter, setRecruiter] = useState<RecruiterRow | null>(null);

  const [assignments, setAssignments] = useState<
    (AssignmentRow & {
      developer_user?: { id: string; name: string } | null;
      job_role?: JobRoleRow | null;
    })[]
  >([]);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch recruiter user info
        const { data: u, error: uErr } = await supabase
          .from('users')
          .select('id, name, email, created_at, is_approved')
          .eq('id', recruiterId)
          .maybeSingle();
        if (uErr) throw uErr;
        if (!u) {
          setError('Recruiter not found');
          setUser(null);
          setRecruiter(null);
          setAssignments([]);
          return;
        }
        setUser(u as any);

        // Fetch recruiter row (company name)
        const { data: r, error: rErr } = await supabase
          .from('recruiters')
          .select('user_id, company_name')
          .eq('user_id', recruiterId)
          .maybeSingle();
        if (!rErr) {
          setRecruiter((r as any) || null);
        }

        // Fetch assignments for this recruiter (no fragile joins)
        const { data: asg, error: asgErr } = await supabase
          .from('assignments')
          .select('id, recruiter_id, developer_id, job_role_id, assigned_at')
          .eq('recruiter_id', recruiterId)
          .order('assigned_at', { ascending: false });
        if (asgErr) throw asgErr;

        const asgs = (asg as any) as AssignmentRow[];

        // Enrich with users and job_roles
        const devIds = Array.from(new Set(asgs.map(a => a.developer_id)));
        let devUserMap: Record<string, { id: string; name: string }> = {};
        if (devIds.length > 0) {
          const { data: devUsers, error: duErr } = await supabase.from('users').select('id, name').in('id', devIds);
          if (!duErr && devUsers) {
            for (const du of devUsers) devUserMap[du.id] = { id: du.id, name: du.name };
          }
        }

        const jobRoleIds = Array.from(new Set(asgs.map(a => a.job_role_id)));
        let jobMap: Record<string, JobRoleRow> = {};
        if (jobRoleIds.length > 0) {
          const { data: jr, error: jrErr } = await supabase
            .from('job_roles')
            .select('id, title, location')
            .in('id', jobRoleIds);
          if (!jrErr && jr) {
            for (const j of jr) jobMap[j.id] = j as any;
          }
        }

        setAssignments(
          asgs.map(a => ({
            ...a,
            developer_user: devUserMap[a.developer_id] || null,
            job_role: jobMap[a.job_role_id] || null,
          })),
        );
      } catch (e: any) {
        console.error('AdminRecruiterPreview error:', e);
        setError(e?.message || 'Failed to fetch recruiter data');
        setUser(null);
        setRecruiter(null);
        setAssignments([]);
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

  if (error || !user) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-800">{error || 'Recruiter not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900">{user.name}</h2>
            <div className="flex items-center text-gray-600 mt-1">
              <Mail className="w-4 h-4 mr-1" />
              {user.email}
            </div>
            <div className="flex items-center text-gray-600 mt-1">
              <Building className="w-4 h-4 mr-1" />
              {recruiter?.company_name || '—'}
            </div>
          </div>
          <div className="text-sm">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full font-bold ${
                user.is_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {user.is_approved ? 'Approved' : 'Pending Approval'}
            </span>
            <div className="mt-2 text-gray-500 flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              Joined {new Date(user.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Assignments */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-gray-900">Assignments</h3>
          <div className="text-sm text-gray-600">{assignments.length} total</div>
        </div>

        {assignments.length === 0 ? (
          <div className="text-gray-600">No assignments yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Developer</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {a.developer_user?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {a.job_role?.title || 'Unknown'} {a.job_role?.location ? `• ${a.job_role.location}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(a.assigned_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
