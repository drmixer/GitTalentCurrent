import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { JobRole, User, Recruiter as RecruiterType, EnrichedJobRole } from '../../types'; // Ensure EnrichedJobRole is imported
import { JobDetailsModal } from '../Jobs/JobsTab'; // Import the common JobDetailsModal
import { Star, Loader, CheckCircle, Send, XCircle } from 'lucide-react';

interface RecruiterProfileProps {
  recruiterId: string;
}

const RecruiterProfile: React.FC<RecruiterProfileProps> = ({ recruiterId }) => {
  // Corrected type: recruiters should be RecruiterType (an object) or null/undefined, not an array.
  const [recruiter, setRecruiter] = useState<(User & { recruiters?: RecruiterType | null }) | null>(null);
  const [jobs, setJobs] = useState<EnrichedJobRole[]>([]); // Use EnrichedJobRole[]
  const [stats, setStats] = useState({
    totalJobs: 0,
    openJobs: 0,
    totalApplicants: 0,
    totalHires: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<EnrichedJobRole | null>(null); // Use EnrichedJobRole
  const navigate = useNavigate();

  useEffect(() => {
    console.log("------------------------------------------");
    console.log("RecruiterProfile component (Re)Rendered/Updated.");
    // This log confirms the recruiterId being used from props
    console.log("Recruiter ID received by RecruiterProfile (from props):", recruiterId);
    console.log("Current Supabase auth session:", supabase.auth.getSession()); // Check current session status

    const fetchProfileData = async () => {
      setLoading(true); // Always set loading to true at the start of fetch
      // No explicit error state managed for the component, but we will log errors

      if (!recruiterId) {
        console.error("RecruiterProfile: recruiterId is missing.");
        setLoading(false);
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(recruiterId)) {
        console.error(`RecruiterProfile: Invalid recruiterId format: ${recruiterId}`);
        setLoading(false);
        return;
      }

      try {
        console.log(`[RecruiterProfile] Attempting to fetch profile for ID: ${recruiterId}`);

        const { data: recruiterData, error: recruiterError } = await supabase
          .from('users')
          .select(`
            id,
            role,
            name,
            email,
            is_approved,
            created_at,
            avatar_url,
            profile_pic_url,
            company_logo_url,
            recruiters:recruiters!recruiters_user_id_fkey(
              company_name,
              website,
              company_size,
              industry
            )
          `)
          .eq('id', recruiterId)
          .single();

        // --- CRITICAL NEW LOGS FOR DEBUGGING ---
        console.log("[RecruiterProfile Debug] Supabase query executed for profile data.");
        console.log("[RecruiterProfile Debug] Supabase data received:", recruiterData);
        console.log("[RecruiterProfile Debug] Supabase error received:", recruiterError);
        if (recruiterError) {
          console.error("Supabase Error Details for Profile Fetch:",
            "Message:", recruiterError.message,
            "Code:", recruiterError.code, // This is often "PGRST116" if no rows found
            "Details:", recruiterError.details,
            "Hint:", recruiterError.hint
          );
        }
        // --- END CRITICAL NEW LOGS ---

        if (recruiterError) {
          // You had 'throw recruiterError;' here, which skips the setRecruiter(null)
          // and directly goes to the outer catch.
          // Let's explicitly set recruiter to null here for clarity in logic.
          setRecruiter(null);
          // If you want to show a specific error message on the UI, set an error state here.
          // For now, the `if (!recruiter)` block will handle the "not found" message.
          return; // Exit if there's an error
        }
        
        // If no error, set the recruiter data.
        setRecruiter(recruiterData);

        // --- Fetch Jobs Data (only if recruiterData was successfully fetched) ---
        // This part seems to be working for JobsTab, but let's add logs here too.
        console.log(`[RecruiterProfile] Attempting to fetch jobs for recruiter ID: ${recruiterId}`);
        const { data: jobsData, error: jobsError } = await supabase
          .from('job_roles')
          .select(`
            *,
            recruiter:users!job_roles_recruiter_id_fkey (
              id,
              name,
              email,
              profile_pic_url,
              company_logo_url,
              recruiters:recruiters!recruiters_user_id_fkey (
                company_name
              )
            )
          `)
          .eq('recruiter_id', recruiterId)
          .order('created_at', { ascending: false });

        console.log("[RecruiterProfile Debug] Supabase query executed for jobs data.");
        console.log("[RecruiterProfile Debug] Supabase jobs data received:", jobsData);
        console.log("[RecruiterProfile Debug] Supabase jobs error received:", jobsError);
        if (jobsError) {
            console.error("Supabase Error Details for Jobs Fetch:",
                "Message:", jobsError.message,
                "Code:", jobsError.code,
                "Details:", jobsError.details,
                "Hint:", jobsError.hint
            );
        }

        if (jobsError) {
          console.error(`Error fetching jobs for recruiter ID ${recruiterId}:`, jobsError);
          setJobs([]); // Set to empty array on error
        } else {
          const transformedJobs: EnrichedJobRole[] = (jobsData || []).map(job => {
            const companyName = (job.recruiter?.recruiters as RecruiterType)?.company_name || 'Company Confidential';
            return {
              ...job,
              company_name: companyName,
              recruiter: job.recruiter ? {
                  ...job.recruiter,
                  recruiters: (job.recruiter.recruiters as RecruiterType) || undefined,
              } : undefined,
            };
          });
          setJobs(transformedJobs);
        }
        // --- End Fetch Jobs Data ---

        // Fetch Hires Count
        console.log(`[RecruiterProfile] Attempting to fetch hires count for recruiter ID: ${recruiterId}`);
        const { count: hiresCount, error: hiresError } = await supabase
          .from('hires')
          .select('*', { count: 'exact', head: true })
          .eq('marked_by', recruiterId);

        console.log("[RecruiterProfile Debug] Supabase hires count data received:", hiresCount);
        console.log("[RecruiterProfile Debug] Supabase hires error received:", hiresError);
        if (hiresError) {
            console.error("Supabase Error Details for Hires Fetch:",
                "Message:", hiresError.message,
                "Code:", hiresError.code,
                "Details:", hiresError.details,
                "Hint:", hiresError.hint
            );
        }

        if (hiresError) {
          console.error(`Error fetching hires count for recruiter ID ${recruiterId}:`, hiresError);
          // Stats will default to 0 for hires if error
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
        console.error('Error in fetchProfileData (outer catch):', error);
        setRecruiter(null); // Ensure recruiter is null on any unexpected error
      } finally {
        setLoading(false); // Always set loading to false in finally
      }
    };

    fetchProfileData();
  }, [recruiterId]); // Dependency array is correct

  if (loading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  // This is the check that triggers the "not found" message
  if (!recruiter) {
    return (
      <div className="text-center py-10">
        <h3 className="text-xl font-semibold text-gray-700">Recruiter profile not found.</h3>
        <p className="text-gray-500">The recruiter ID may be invalid or the profile does not exist.</p>
      </div>
    );
  }

  const handleApplyJob = (jobId: string) => {
    navigate(`/apply/job/${jobId}`);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200/80">
        <div className="relative">
          <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-6xl font-bold">
            {/* Main banner image - uses company_logo_url from the recruiter object directly */}
            {recruiter.company_logo_url && (
              <img
                src={recruiter.company_logo_url}
                alt={`${(recruiter.recruiters as RecruiterType)?.company_name || 'Company'} Cover`}
                className="w-full h-full object-cover"
              />
            )}
            {/* Fallback if no company logo or profile pic for banner */}
            {!recruiter.company_logo_url && !recruiter.profile_pic_url && (
              <span className="text-gray-300">Company Banner</span>
            )}
          </div>
          <div className="absolute top-24 left-8">
            {/* Profile picture, fallback to pravatar if not set */}
            <img
              className="h-32 w-32 bg-gray-200 rounded-full border-4 border-white object-cover shadow-md"
              src={recruiter.profile_pic_url || 'https://i.pravatar.cc/150?u=' + recruiter.id}
              alt={`${recruiter.name}'s profile`}
            />
          </div>
          <div className="absolute top-36 right-8">
            {/* Smaller company logo in corner, fallback to initial if no logo */}
            {recruiter.company_logo_url ? (
              <img
                className="h-16 w-auto object-contain rounded-lg shadow-sm bg-white p-1"
                src={recruiter.company_logo_url}
                alt={`${(recruiter.recruiters as RecruiterType)?.company_name || 'Company'} logo`}
              />
            ) : (recruiter.recruiters as RecruiterType)?.company_name ? (
              <div className="h-16 w-16 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xl shadow-sm">
                {(recruiter.recruiters as RecruiterType).company_name[0].toUpperCase()}
              </div>
            ) : null}
          </div>
        </div>

        <div className="pt-20 pb-8 px-8">
          <h1 className="text-3xl font-bold text-gray-800">{recruiter.name}</h1>
          {/* Display company name from recruiter's recruiters table, fallback */}
          <p className="text-gray-600 text-lg">{(recruiter.recruiters as RecruiterType)?.company_name || 'Company Name Not Available'}</p>
        </div>

        <div className="px-8 pb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Company Activity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{stats.totalJobs}</p>
              <p className="text-gray-600">Total Jobs</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-green-600">{stats.openJobs}</p>
              <p className="text-gray-600">Open Jobs</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-purple-600">{stats.totalApplicants}</p>
              <p className="text-gray-600">Total Applicants</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-red-600">{stats.totalHires}</p>
              <p className="text-gray-600">Total Hires</p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Open Positions</h2>
          <div className="space-y-4">
            {jobs.filter(j => j.is_active).length > 0 ? (
              jobs.filter(j => j.is_active).map(job => (
                <div key={job.id} onClick={() => setSelectedJob(job)} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow block cursor-pointer bg-white">
                  <h3 className="text-lg font-semibold text-blue-700">{job.title}</h3>
                  <p className="text-gray-700">{job.description?.substring(0, 150)}...</p>
                  {/* Salary Display */}
                  <p className="text-sm text-gray-500 mt-2 flex items-center">
                    <Star size={14} className="mr-1 text-gray-400" />
                    {job.salary || 'N/A'}
                  </p>
                  {job.tech_stack && job.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {job.tech_stack.slice(0, 3).map(tech => (
                        <span key={tech} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full font-medium">{tech}</span>
                      ))}
                      {job.tech_stack.length > 3 && <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full font-medium">+{job.tech_stack.length - 3}</span>}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>No active job listings from this recruiter at the moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSave={() => alert('Save functionality not available on recruiter profile for developers.')}
          onApply={() => handleApplyJob(selectedJob.id)}
          isSaved={false}
          hasApplied={false}
          isProcessingSave={false}
          isProcessingApply={false}
        />
      )}
    </div>
  );
};

export default RecruiterProfile;
