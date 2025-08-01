import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JobRole, EnrichedJobRole, Recruiter as RecruiterType } from '../../types'; // Ensure EnrichedJobRole is imported
import { Search, Briefcase, MapPin, DollarSign, Send, Eye, Loader, AlertCircle, Star, XCircle, CheckCircle } from 'lucide-react';

// Minimal JobCard component
const JobCard: React.FC<{
  job: EnrichedJobRole;
  onSelect: () => void;
  onSave: () => void;
  onApply: () => void;
  isSaved: boolean;
  hasApplied: boolean;
  isProcessingSave: boolean;
  isProcessingApply: boolean;
}> =
  ({ job, onSelect, onSave, onApply, isSaved, hasApplied, isProcessingSave, isProcessingApply }) => (
    <div onClick={onSelect} className="bg-white shadow-md rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{job.title}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${isProcessingSave ? 'text-gray-300 cursor-not-allowed' : (isSaved ? 'text-yellow-500' : 'text-gray-400')}`}
          title={isSaved ? "Unsave Job" : "Save Job"}
          disabled={isProcessingSave}
        >
          {isProcessingSave ? <Loader size={20} className="animate-spin" /> : <Star className={isSaved ? "fill-current" : ""} size={20} />}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-1 flex items-center">
        <Briefcase size={14} className="mr-2 text-gray-400" />
        {/* Display company_name from EnrichedJobRole */}
        {job.recruiter?.id ? (
          <a href={`/recruiters/${job.recruiter.id}`} className="hover:underline">
            {job.company_name || 'Company Confidential'}
          </a>
        ) : (
          <span>{job.company_name || 'Company Confidential'}</span>
        )}
      </p>
      <p className="text-sm text-gray-500 mb-1 flex items-center">
          {/* Display recruiter name from joined recruiter object */}
          {job.recruiter?.id ? (
            <a href={`/recruiters/${job.recruiter.id}`} className="hover:underline">
              {job.recruiter?.name || 'Recruiter'}
            </a>
          ) : (
            <span>{job.recruiter?.name || 'Recruiter'}</span>
          )}
      </p>
      <p className="text-sm text-gray-500 mb-1 flex items-center"><MapPin size={14} className="mr-2 text-gray-400" /> {job.location}</p>

      {/* Salary Display */}
      <p className="text-sm text-gray-500 mb-3 flex items-center">
        <DollarSign size={14} className="mr-2 text-gray-400" />
        {job.salary || 'N/A'}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {job.tech_stack?.slice(0, 4).map(tech => (
          <span key={tech} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">{tech}</span>
        ))}
        {job.tech_stack && job.tech_stack.length > 4 && (
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">+{job.tech_stack.length - 4} more</span>
        )}
      </div>
      <div className="flex items-center space-x-3 mt-4">
        <button
          onClick={(e) => { e.stopPropagation(); onApply(); }}
          className={`w-full px-4 py-2 rounded-lg transition-colors font-semibold text-sm flex items-center justify-center ${hasApplied ? 'bg-green-100 text-green-700 cursor-not-allowed' : (isProcessingApply ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600')}`}
          disabled={hasApplied || isProcessingApply}
        >
          {isProcessingApply ? <Loader size={16} className="animate-spin mr-2" /> : (hasApplied ? <CheckCircle size={16} className="mr-2"/> : <Send size={16} className="mr-2"/>)}
          {isProcessingApply ? 'Applying...' : (hasApplied ? 'Applied' : 'Apply')}
        </button>
      </div>
    </div>
  );

// Minimal JobDetailsModal component
export const JobDetailsModal: React.FC<{
  job: EnrichedJobRole;
  onClose: () => void;
  onSave: () => void;
  onApply: () => void;
  isSaved: boolean;
  hasApplied: boolean;
  isProcessingSave: boolean;
  isProcessingApply: boolean;
}> =
  ({ job, onClose, onSave, onApply, isSaved, hasApplied, isProcessingSave, isProcessingApply }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">{job.title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors"><XCircle size={24} className="text-gray-500"/></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Company and Recruiter Info */}
          <div className="flex items-center mb-4">
            {job.recruiter?.company_logo_url ? (
              <img src={job.recruiter.company_logo_url} alt={`${job.company_name} logo`} className="w-10 h-10 rounded-full mr-3 object-cover" />
            ) : job.recruiter?.profile_pic_url ? (
              <img src={job.recruiter.profile_pic_url} alt={`${job.recruiter.name} profile`} className="w-10 h-10 rounded-full mr-3 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-lg mr-3">
                {/* Fallback to first letter of company name or 'U' if not available */}
                {job.company_name ? job.company_name[0].toUpperCase() : (job.recruiter?.name ? job.recruiter.name[0].toUpperCase() : 'U')}
              </div>
            )}
            <div>
              <p className="text-md text-gray-600 font-semibold">
                <Briefcase size={16} className="inline mr-2 text-gray-500" />
                {/* Display company_name from EnrichedJobRole */}
                {job.recruiter?.id ? (
                  <a href={`/recruiters/${job.recruiter.id}`} className="hover:underline">
                    {job.company_name || 'Company Confidential'}
                  </a>
                ) : (
                  <span>{job.company_name || 'Company Confidential'}</span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                {/* Display recruiter name from joined recruiter object */}
                {job.recruiter?.id ? (
                  <a href={`/recruiters/${job.recruiter.id}`} className="hover:underline">
                      {job.recruiter?.name || 'Recruiter'}
                  </a>
                ) : (
                  <span>{job.recruiter?.name || 'Recruiter'}</span>
                )}
              </p>
            </div>
          </div>

          <p className="text-md text-gray-600"><MapPin size={16} className="inline mr-2 text-gray-500" /> {job.location}</p>

          {/* Salary Display */}
          <p className="text-md text-gray-600">
            <DollarSign size={16} className="inline mr-2 text-gray-500" />
            {job.salary || 'N/A'}
          </p>

          <div className="pt-2">
            <h4 className="font-semibold text-gray-700 mb-1">Job Description:</h4>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.description || "No description provided."}</p>
          </div>
          {job.tech_stack && job.tech_stack.length > 0 && (
            <div className="pt-2">
              <h4 className="font-semibold text-gray-700 mb-2">Tech Stack:</h4>
              <div className="flex flex-wrap gap-2">
                {job.tech_stack.map(tech => (
                  <span key={tech} className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-full font-medium">{tech}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-gray-200 flex items-center space-x-3">
          <button
            onClick={onSave}
            className={`p-3 rounded-lg hover:bg-gray-100 transition-colors ${isProcessingSave ? 'text-gray-300 cursor-not-allowed' : (isSaved ? 'text-yellow-500' : 'text-gray-500')}`}
            title={isSaved ? "Unsave Job" : "Save Job"}
            disabled={isProcessingSave}
          >
            {isProcessingSave ? <Loader size={22} className="animate-spin" /> : <Star className={isSaved ? "fill-current" : ""} size={22} />}
          </button>
          <button
            onClick={onApply}
            className={`flex-1 px-6 py-3 rounded-lg transition-colors font-semibold text-base flex items-center justify-center ${hasApplied ? 'bg-green-100 text-green-700 cursor-not-allowed' : (isProcessingApply ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700')}`}
            disabled={hasApplied || isProcessingApply}
          >
            {isProcessingApply ? <Loader size={20} className="animate-spin mr-2" /> : (hasApplied ? <CheckCircle size={20} className="mr-2"/> : <Send size={20} className="mr-2"/>)}
            {isProcessingApply ? 'Applying...' : (hasApplied ? 'Applied' : 'Apply Now')}
          </button>
        </div>
      </div>
    </div>
  );


export const JobsTab: React.FC = () => {
  const navigate = useNavigate();
  const { developerProfile } = useAuth();
  const [jobs, setJobs] = useState<EnrichedJobRole[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [appliedJobIds, setAppliedJobIds] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<EnrichedJobRole | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [currentJobView, setCurrentJobView] = useState<'all' | 'saved' | 'applied'>('all');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: jobsError } = await supabase
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
              company_name,
              website,
              company_size,
              industry
            )
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error("Supabase error fetching jobs from view:", JSON.stringify(jobsError));
        throw jobsError;
      }

      // Keep this log for debugging the raw data structure from Supabase
      console.log("[JobsTab] Raw data from Supabase query:", JSON.stringify(data, null, 2));

      const transformedJobs: EnrichedJobRole[] = (data || []).map(job => {
        // --- START DEBUG LOGS FOR JOBS TAB ---
        console.log(`[JobsTab] Processing Job ID: ${job.id}`);
        console.log(`[JobsTab] Raw Recruiter Object for Job ${job.id}:`, job.recruiter);
        console.log(`[JobsTab] Nested 'recruiters' object from join for Job ${job.id}:`, job.recruiter?.recruiters); // Changed 'array' to 'object' for clarity
        // --- END DEBUG LOGS ---

        // --- THE FIX IS HERE (Access directly, not via [0]) ---
        // Assert job.recruiter.recruiters as RecruiterType, as it's an object if present
        const companyNameFromRecruitersTable = (job.recruiter?.recruiters as RecruiterType)?.company_name;
        // --- END FIX ---
        
        const companyName = companyNameFromRecruitersTable || 'Company Confidential';
        return {
          ...job,
          company_name: companyName,
          // Ensure the recruiter object on EnrichedJobRole is complete with nested data
          // Cast recruiters to RecruiterType or undefined to correctly type it as an object
          recruiter: job.recruiter ? {
            ...job.recruiter,
            recruiters: (job.recruiter.recruiters as RecruiterType) || undefined,
          } : undefined,
        };
      });

      setJobs(transformedJobs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch jobs.');
      console.error("Error fetching jobs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserJobInteractions = useCallback(async () => {
    if (!developerProfile?.user_id) return;
    try {
      const { data: saved, error: savedError } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .eq('developer_id', developerProfile.user_id);
      if (savedError) throw savedError;
      setSavedJobIds(new Set(saved?.map(s => s.job_id) || []));

      const { data: applied, error: appliedError } = await supabase
        .from('applied_jobs')
        .select('job_id')
        .eq('developer_id', developerProfile.user_id);
      if (appliedError) throw appliedError;
      setAppliedJobIds(new Set(applied?.map(a => a.job_id) || []));
    } catch (e: unknown) {
      console.error("Error fetching user job interactions:", e);
    }
  }, [developerProfile?.user_id]);

  useEffect(() => {
    fetchJobs();
    fetchUserJobInteractions();
  }, [fetchJobs, fetchUserJobInteractions]);

  const handleSaveJob = async (jobId: string) => {
    if (!developerProfile?.user_id || processingJobId === jobId) return;

    setProcessingJobId(jobId);
    const alreadySaved = savedJobIds.has(jobId);
    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from('saved_jobs')
          .delete()
          .match({ developer_id: developerProfile.user_id, job_id: jobId });
        if (error) throw error;
        setSavedJobIds(prev => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from('saved_jobs')
          .insert({ developer_id: developerProfile.user_id, job_id: jobId });
        if (error) throw error;
        setSavedJobIds(prev => new Set(prev).add(jobId));
      }
    } catch (e: unknown) {
      console.error("Error saving/unsaving job:", e);
      alert(`Failed to ${alreadySaved ? 'unsave' : 'save'} job. ${e instanceof Error ? e.message : ''}`);
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleApplyJob = (jobId: string) => {
    if (!developerProfile?.user_id || appliedJobIds.has(jobId)) return;

    navigate(`/apply/job/${jobId}`);
  };

  const displayedJobs = useMemo(() => {
    let jobsToShow = jobs;
    if (currentJobView === 'saved') {
      jobsToShow = jobs.filter(job => savedJobIds.has(job.id));
    } else if (currentJobView === 'applied') {
      jobsToShow = jobs.filter(job => appliedJobIds.has(job.id));
    }

    if (!searchTerm.trim()) {
      return jobsToShow;
    }

    return jobsToShow.filter(job => {
      const searchTermLower = searchTerm.toLowerCase();
      const titleMatch = job.title.toLowerCase().includes(searchTermLower);
      const companyMatch = job.company_name?.toLowerCase().includes(searchTermLower);
      const techMatch = job.tech_stack?.some(tech => tech.toLowerCase().includes(searchTermLower));
      return titleMatch || companyMatch || techMatch;
    });
  }, [jobs, savedJobIds, appliedJobIds, currentJobView, searchTerm]);

  if (loading && jobs.length === 0) {
    return <div className="flex justify-center items-center p-10"><Loader size={32} className="animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 p-1">
      <div className="bg-white shadow sm:rounded-lg p-6 border border-gray-200/80">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Find Your Next Opportunity</h1>
        <p className="text-gray-600">Search and apply for jobs that match your skills.</p>
      </div>

      <div className="sticky top-[65px] z-10 bg-gray-50 py-4 px-1 -mx-1">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by title, company, or keyword (e.g., React, Python)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
        </div>
        <div className="mt-4 flex space-x-2 pb-2 border-b border-gray-200">
          {(['all', 'saved', 'applied'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setCurrentJobView(view)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${currentJobView === view
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'}`}
            >
              {view === 'all' ? 'All Jobs' : view === 'saved' ? 'Saved Jobs' : 'Applied Jobs'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center">
          <AlertCircle size={20} className="mr-2"/> {error}
        </div>
      )}

      {!loading && displayedJobs.length === 0 && (
        <div className="text-center py-10">
          <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">
            {currentJobView === 'all' && !searchTerm && "No jobs available right now."}
            {currentJobView === 'saved' && "You haven't saved any jobs yet."}
            {currentJobView === 'applied' && "You haven't applied to any jobs yet."}
            {searchTerm && "No jobs match your current search and filter."}
          </h3>
          <p className="text-gray-500">
            {currentJobView === 'all' && !searchTerm && "Check back later for new opportunities."}
            {(currentJobView === 'saved' || currentJobView === 'applied') && "Explore all jobs to find opportunities!"}
            {searchTerm && "Try broadening your search criteria."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedJobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onSelect={() => setSelectedJob(job)}
            onSave={() => handleSaveJob(job.id)}
            onApply={() => handleApplyJob(job.id)}
            isSaved={savedJobIds.has(job.id)}
            hasApplied={appliedJobIds.has(job.id)}
            isProcessingSave={processingJobId === job.id}
            isProcessingApply={processingJobId === job.id}
          />
        ))}
      </div>

      {loading && jobs.length > 0 && <div className="text-center py-6"><Loader size={24} className="animate-spin text-blue-600"/></div>}

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSave={() => handleSaveJob(selectedJob.id)}
          onApply={() => handleApplyJob(selectedJob.id)}
          isSaved={savedJobIds.has(selectedJob.id)}
          hasApplied={appliedJobIds.has(selectedJob.id)}
          isProcessingSave={processingJobId === selectedJob.id}
          isProcessingApply={processingJobId === selectedJob.id}
        />
      )}
    </div>
  );
};
