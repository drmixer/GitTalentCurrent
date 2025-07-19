import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { JobRole, Company } from '../../types';

interface CompanyProfileProps {
  companyId: string;
}

const CompanyProfile: React.FC<CompanyProfileProps> = ({ companyId }) => {
    const [company, setCompany] = useState<Company | null>(null);
    const [jobs, setJobs] = useState<JobRole[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompanyProfile = async () => {
            if (!companyId) {
                console.error("CompanyProfile: companyId is missing.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                console.log(`Fetching profile for company ID: ${companyId}`);

                const { data: companyData, error: companyError } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('id', companyId)
                    .single();

                if (companyError) {
                    console.error(`Error fetching company data for ID ${companyId}:`, companyError);
                    throw companyError;
                }
                console.log("Company data fetched:", companyData);
                setCompany(companyData);

                const { data: jobsData, error: jobsError } = await supabase
                    .from('job_roles')
                    .select('*, recruiter:users!inner(company_id)')
                    .eq('recruiter.company_id', companyId);

                if (jobsError) {
                    console.error(`Error fetching jobs for company ID ${companyId}:`, jobsError);
                    throw jobsError;
                }
                console.log("Company jobs data fetched:", jobsData);
                setJobs(jobsData || []);
            } catch (error: any) {
                console.error('Error in fetchCompanyProfile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCompanyProfile();
    }, [companyId]);

    if (loading) {
        return <div>Loading company profile...</div>;
    }

    if (!company) {
        return <div>Company profile not found.</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">{company.name}</h1>
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
