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
        const fetchProfileData = async () => {
            if (!recruiterId) {
                console.error("RecruiterProfile: recruiterId is missing.");
                setLoading(false);
                return;
            }

            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(recruiterId)) {
                console.error(`RecruiterProfile: Invalid recruiterId format: ${recruiterId}`);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                console.log(`Fetching data for recruiter ID: ${recruiterId}`);

                const { data: recruiterData, error: recruiterError } = await supabase
                    .from('users')
                    .select('*, recruiters(*)')
                    .eq('id', recruiterId)
                    .single();

                if (recruiterError) {
                    console.error(`Error fetching recruiter data for ID ${recruiterId}:`, recruiterError);
                    throw recruiterError;
                }
                console.log("Recruiter data fetched:", recruiterData);
                setRecruiter(recruiterData);

                const { data: jobsData, error: jobsError } = await supabase
                    .from('job_roles')
                    .select('*')
                    .eq('recruiter_id', recruiterId);

                if (jobsError) {
                    console.error(`Error fetching jobs for recruiter ID ${recruiterId}:`, jobsError);
                    throw jobsError;
                }
                console.log("Jobs data fetched:", jobsData);

                const { count: hiresCount, error: hiresError } = await supabase
                    .from('hires')
                    .select('*', { count: 'exact', head: true })
                    .eq('marked_by', recruiterId);

                if (hiresError) {
                    console.error(`Error fetching hires count for recruiter ID ${recruiterId}:`, hiresError);
                    throw hiresError;
                }
                console.log("Hires count:", hiresCount);

                const totalApplicants = (jobsData || []).reduce((acc, job) => acc + (job.applicant_count || 0), 0);

                setJobs(jobsData || []);
                setStats({
                    totalJobs: jobsData?.length || 0,
                    openJobs: jobsData?.filter(job => job.is_active).length || 0,
                    totalApplicants: totalApplicants,
                    totalHires: hiresCount || 0,
                });
            } catch (error: any) {
                console.error('Error in fetchProfileData:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
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
                    <p className="text-gray-600">{recruiter?.company_name}</p>
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
