import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader, AlertCircle, MapPin, Clock, DollarSign, Calendar, Building } from 'lucide-react';

interface Props {
  jobRoleId: string;
}

interface JobRoleRow {
  id: string;
  title: string;
  description: string;
  location: string;
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  is_active: boolean;
  is_featured: boolean | null;
  created_at: string;
  recruiter_id: string;
  tech_stack: string[];
}

export const AdminJobRoleDetails: React.FC<Props> = ({ jobRoleId }) => {
  const [job, setJob] = useState<JobRoleRow | null>(null);
  const [recruiterUser, setRecruiterUser] = useState<{ id: string; name: string; email?: string | null } | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch job (no inline comments, no nested recruiter join)
        const { data: jobData, error: jobErr } = await supabase
          .from('job_roles')
          .select('*')
          .eq('id', jobRoleId)
          .maybeSingle();

        if (jobErr) throw jobErr;
        if (!jobData) {
          setError('Job role not found');
          setJob(null);
          return;
        }
        setJob(jobData as any);

        // Fetch recruiter user minimal info
        if (jobData.recruiter_id) {
          const { data: userRow, error: userErr } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', jobData.recruiter_id)
            .maybeSingle();
          if (!userErr && userRow) {
            setRecruiterUser(userRow as any);
          } else {
            setRecruiterUser(null);
          }

          // Fetch company name from recruiters table
          const { data: recRow, error: recErr } = await supabase
            .from('recruiters')
            .select('company_name')
            .eq('user_id', jobData.recruiter_id)
            .maybeSingle();
          if (!recErr && recRow) {
            setCompanyName((recRow as any).company_name ?? null);
          } else {
            setCompanyName(null);
          }
        } else {
          setRecruiterUser(null);
          setCompanyName(null);
        }
      } catch (e: any) {
        console.error('AdminJobRoleDetails error:', e);
        setError(e?.message || 'Failed to fetch job role');
        setJob(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [jobRoleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-800">{error || 'Job role not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-4">
              <h1 className="text-3xl font-black text-gray-900">{job.title}</h1>
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold ${
                  job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {job.is_active ? 'Active' : 'Paused'}
              </span>
              {job.is_featured && (
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">Featured</span>
              )}
            </div>

            <div className="grid md:grid-cols-4 gap-6 mb-6">
              <div className="flex items-center text-gray-600">
                <MapPin className="w-5 h-5 mr-2" />
                <span className="font-medium">{job.location}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-medium">{job.job_type || '—'}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <DollarSign className="w-5 h-5 mr-2" />
                <span className="font-medium">
                  {job.salary_min != null && job.salary_max != null ? `$${job.salary_min}k - $${job.salary_max}k` : '—'}
                </span>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-2" />
                <span className="font-medium">{new Date(job.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-6">
              {(job.tech_stack || []).map((tech, i) => (
                <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {(recruiterUser || companyName) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center">
              <Building className="w-5 h-5 text-gray-500 mr-3" />
              <div>
                <h3 className="font-bold text-gray-900">Recruiter</h3>
                <div className="text-gray-700">{companyName || recruiterUser?.name || '—'}</div>
                {recruiterUser?.email && <div className="text-gray-500 text-sm">{recruiterUser.email}</div>}
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-black text-gray-900 mb-3">Job Description</h3>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
        </div>
      </div>
    </div>
  );
};
