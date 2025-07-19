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
        console.log("RecruiterProfile component rendered/updated");
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
                    .select('*, company:companies(*)')
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
                setJobs(jobsData || []);

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

    if (!recruiter) {
        return <div>Recruiter profile not found.</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <div className="relative">
                    <div className="h-48 bg-gray-200"></div>
                    <div className="absolute top-24 left-8">
                        <img className="h-32 w-32 bg-gray-300 rounded-full border-4 border-white" src={recruiter.profile_pic_url || 'https://i.pravatar.cc/150?u=' + recruiter.id} alt={`${recruiter.name}'s profile`} />
                    </div>
                    <div className="absolute top-36 right-8">
                        <img className="h-16" src={recruiter.company?.logo_url || 'https://logo.clearbit.com/' + recruiter.company_name + '.com'} alt={`${recruiter.company_name} logo`} />
                    </div>
                </div>

                <div className="pt-20 pb-8 px-8">
                    <h1 className="text-3xl font-bold">{recruiter.name}</h1>
                    <p className="text-gray-600">{recruiter.company_name}</p>
                </div>

                <div className="px-8 pb-8">
                    <h2 className="text-xl font-semibold mb-4">Company Activity</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold">{stats.totalJobs}</p>
                            <p className="text-gray-600">Total Jobs</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.openJobs}</p>
                            <p className="text-gray-600">Open Jobs</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.totalApplicants}</p>
                            <p className="text-gray-600">Total Applicants</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.totalHires}</p>
                            <p className="text-gray-600">Total Hires</p>
                        </div>
                    </div>
                </div>

                <div className="px-8 pb-8">
                    <h2 className="text-xl font-semibold mb-4">Open Positions</h2>
                    <div className="space-y-4">
                        {jobs.filter(j => j.is_active).map(job => (
                            <div key={job.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                                <h3 className="text-lg font-semibold text-blue-600">{job.title}</h3>
                                <p className="text-gray-700">{job.description?.substring(0, 100)}...</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecruiterProfile;
