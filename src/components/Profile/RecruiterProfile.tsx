import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JobRole } from '../../types';

const RecruiterProfile: React.FC = () => {
    const { user } = useAuth();
    const [jobs, setJobs] = useState<JobRole[]>([]);
    const [stats, setStats] = useState({
        totalJobs: 0,
        openJobs: 0,
        totalApplicants: 0,
        totalHires: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchProfileData = async () => {
                try {
                    const { data: jobsData, error: jobsError } = await supabase
                        .from('job_roles')
                        .select('*')
                        .eq('recruiter_id', user.id);

                    if (jobsError) throw jobsError;

                    const { count: hiresCount, error: hiresError } = await supabase
                        .from('hires')
                        .select('*', { count: 'exact', head: true })
                        .eq('marked_by', user.id);

                    if (hiresError) throw hiresError;

                    // This is a simplification. A real implementation would need to count distinct applicants across all jobs.
                    const totalApplicants = jobsData.reduce((acc, job) => acc + (job.applicant_count || 0), 0);

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
    }, [user]);

    if (loading) {
        return <div>Loading profile...</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Recruiter Profile</h1>
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
