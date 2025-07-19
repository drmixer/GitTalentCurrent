import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { JobRole, User } from '../../types';

interface RecruiterProfileProps {
  recruiterId: string;
}

const RecruiterProfile: React.FC<RecruiterProfileProps> = ({ recruiterId }) => {
    const [recruiter, setRecruiter] = useState<User | null>(null);
    const [jobs, setJobs] = useState<JobRole[]>([]);
    const [stats, setStats] = useState({
        totalJobs: 0,
        openJobs: 0,
        totalApplicants: 0,
        totalHires: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (recruiterId) {
            const fetchProfileData = async () => {
                try {
                    const { data: recruiterData, error: recruiterError } = await supabase
                        .from('users')
                        .select('*, recruiters(*)')
                        .eq('id', recruiterId)
                        .single();

                    if (recruiterError) throw recruiterError;
                    setRecruiter(recruiterData);

                    const { data: jobsData, error: jobsError } = await supabase
                        .from('job_roles')
                        .select('*')
                        .eq('recruiter_id', recruiterId);

                    if (jobsError) throw jobsError;

                    const { count: hiresCount, error: hiresError } = await supabase
                        .from('hires')
                        .select('*', { count: 'exact', head: true })
                        .eq('marked_by', recruiterId);

                    if (hiresError) throw hiresError;

                    const totalApplicants = (jobsData as any[]).reduce((acc, job) => acc + (job.applicant_count || 0), 0);

                    setJobs(jobsData || []);
                    setStats({
                        totalJobs: jobsData.length,
                        openJobs: jobsData.filter(job => job.is_active).length,
                        totalApplicants: totalApplicants,
                        totalHires: hiresCount || 0,
                    });
                } catch (error: any) {
                    console.error('Error fetching recruiter profile data:', error);
                } finally {
                    setLoading(false);
                }
            };

            fetchProfileData();
        }
    }, [recruiterId]);

    if (loading) {
        return <div>Loading profile...</div>;
    }

    return (
        <div className="p-4">
            <div className="flex items-center space-x-4 mb-4">
                <img src={recruiter?.profile_pic_url || ''} alt={recruiter?.name} className="w-24 h-24 rounded-full" />
                <div>
                    <h1 className="text-2xl font-bold">{recruiter?.name}</h1>
                    <p className="text-gray-600">{recruiter?.recruiters[0]?.company_name}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="p-4 border rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold">Total Jobs</h2>
                    <p>{stats.totalJobs}</p>
                </div>
                <div className="p-4 border rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold">Open Jobs</h2>
                    <p>{stats.openJobs}</p>
                </div>
                <div className="p-4 border rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold">Total Applicants</h2>
                    <p>{stats.totalApplicants}</p>
                </div>
                <div className="p-4 border rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold">Total Hires</h2>
                    <p>{stats.totalHires}</p>
                </div>
            </div>
            <div>
                <h2 className="text-xl font-bold mb-2">Posted Jobs</h2>
                <div className="space-y-4">
                    {jobs.map(job => (
                        <div key={job.id} className="p-4 border rounded-lg shadow-sm">
                            <h3 className="text-lg font-semibold">{job.title}</h3>
                            <p>{job.is_active ? 'Active' : 'Closed'}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecruiterProfile;
