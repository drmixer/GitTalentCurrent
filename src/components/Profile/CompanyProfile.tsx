import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { JobRole } from '../../types';

interface CompanyProfileProps {
  companyName: string;
}

const CompanyProfile: React.FC<CompanyProfileProps> = ({ companyName }) => {
    const [jobs, setJobs] = useState<JobRole[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompanyJobs = async () => {
            if (!companyName) {
                console.error("CompanyProfile: companyName is missing.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                console.log(`Fetching jobs for company: ${companyName}`);

                const { data: jobsData, error: jobsError } = await supabase
                    .from('job_roles')
                    .select('*, recruiter:users!job_roles_recruiter_id_fkey(company_name)')
                    .eq('recruiter.company_name', companyName);

                if (jobsError) {
                    console.error(`Error fetching jobs for company ${companyName}:`, jobsError);
                    throw jobsError;
                }
                console.log("Company jobs data fetched:", jobsData);
                setJobs(jobsData || []);
            } catch (error: any) {
                console.error('Error in fetchCompanyJobs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCompanyJobs();
    }, [companyName]);

    if (loading) {
        return <div>Loading company profile...</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">{companyName}</h1>
            <div>
                <h2 className="text-xl font-bold mb-2">Job Listings</h2>
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

export default CompanyProfile;
