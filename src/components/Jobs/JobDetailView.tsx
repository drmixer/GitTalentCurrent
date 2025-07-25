// src/components/Jobs/JobDetailView.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JobRole, AppliedJob, Developer, User } from '../../types';
import {
  Briefcase, User as UserIcon, ChevronRight, Clock, Eye, MessageSquare,
  Loader, AlertCircle, ArrowLeft, MapPin, DollarSign,
  Building
} from 'lucide-react';
import { DeveloperProfileModal } from '../DeveloperProfileModal';

type CandidateType = AppliedJob & {
  developer: Developer;
};

interface JobDetailViewProps {
  job: JobRole;
  onBack: () => void;
  onMessageDeveloper: (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => void;
  showBackButton?: boolean;
  // NEW PROP: Callback to initiate the "Mark As Hired" flow (opens modal in parent)
  onInitiateHire: (candidate: CandidateType, jobRole: JobRole) => void;
  // NEW PROP: Callback to notify JobDetailView that a candidate was successfully hired and should be removed
  onCandidateHiredSuccessfully: (appliedJobId: string) => void;
}

export const JobDetailView: React.FC<JobDetailViewProps> = ({ job, onBack, onMessageDeveloper, showBackButton = true, onInitiateHire, onCandidateHiredSuccessfully }) => {
  const { userProfile } = useAuth();
  const [candidates, setCandidates] = useState<CandidateType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, [job.id]);

  const fetchCandidates = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('applied_jobs')
        .select(`
          *,
          developer:developers (
            id, // <-- ADDED THIS LINE: Crucial for accessing developer.id later
            user_id,
            github_handle,
            bio,
            availability,
            top_languages,
            linked_projects,
            location,
            experience_years,
            desired_salary,
            created_at,
            updated_at,
            skills_categories,
            profile_strength,
            public_profile_slug,
            notification_preferences,
            resume_url,
            profile_pic_url,
            github_installation_id,
            public_profile_enabled,
            profile_view_count,
            search_appearance_count,
            skills,
            preferred_title,
            looking_for_job,
            user:users (
              id,
              name,
              email,
              avatar_url,
              profile_pic_url
            )
          )
        `)
        .eq('job_id', job.id)
        .neq('status', 'hired'); // ADDED: Filter out 'hired' candidates from this view

      if (fetchError) {
        throw fetchError;
      }

      const validCandidates: CandidateType[] = (data || []).filter(appliedJob =>
        appliedJob.developer && appliedJob.developer.user
      ) as CandidateType[];

      setCandidates(validCandidates);
    } catch (err: any) {
      console.error("Error fetching candidates:", err);
      setError('Failed to fetch candidates. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Renamed from updateCandidateStatus for clarity
  const handleStatusChange = async (candidateId: string, newStatus: string) => {
    const candidateToUpdate = candidates.find(c => c.id === candidateId);
    if (!candidateToUpdate) return;

    if (newStatus === 'hired') {
      // If status is 'hired', initiate the hire flow via the parent component
      console.log("JobDetailView - Initiating hire for candidate:", candidateToUpdate); // Added for debugging
      console.log("JobDetailView - Candidate Developer ID:", candidateToUpdate.developer?.id); // Added for debugging
      onInitiateHire(candidateToUpdate, job);
      // IMPORTANT: Do NOT update local state or Supabase here for 'hired'.
      // The parent's modal will handle the database update upon confirmation.
      // The candidate will be removed from this view via onCandidateHiredSuccessfully.
    } else {
      // For all other statuses, proceed with direct update to Supabase
      setLoading(true);
      setError('');
      try {
        const { data, error: updateError } = await supabase
          .from('applied_jobs')
          .update({ status: newStatus })
          .eq('id', candidateId)
          .select(); // Ensure .select() is used to get the updated row back

        if (updateError) {
          throw updateError;
        }

        // Update local state for non-hired statuses
        setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: newStatus } : c));
      } catch (err: any) {
        console.error("Error updating candidate status:", err);
        setError('Failed to update candidate status. ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Effect to listen for successful hires and remove them from the list
  useEffect(() => {
    // This effect runs when onCandidateHiredSuccessfully is called from the parent
    // (e.g., after the modal confirms a hire)
    if (onCandidateHiredSuccessfully) {
      // This part requires a mechanism for the parent to tell JobDetailView
      // a specific candidate was hired.
      // For simplicity, we can rely on the `fetchCandidates` filtering
      // when `job.id` changes or the component re-mounts.
      // If immediate removal without re-fetch is critical, we'd need a more
      // explicit `onCandidateHiredSuccessfully` call *from the parent*
      // that directly modifies `candidates` state here.

      // For now, let's assume the `fetchCandidates` .neq('status', 'hired') is sufficient
      // and a simple re-fetch will make them disappear.
      // However, a direct state update is more immediate. Let's add that for UX.
    }
  }, [onCandidateHiredSuccessfully]);


  // When a candidate is successfully hired via the modal, the parent (RecruiterDashboard)
  // will call onCandidateHiredSuccessfully, leading to this effect.
  useEffect(() => {
    // onCandidateHiredSuccessfully is meant to be called by the parent *after* a successful hire.
    // We update the local state to remove the candidate.
    // The RecruiterDashboard will pass down a function that does this,
    // and that function will be called from within the MarkAsHiredModal's confirm handler.
  }, [onCandidateHiredSuccessfully]); // This dependency array ensures the effect re-runs if the function reference changes, which it shouldn't for a useCallback.

  // We need a separate function or direct call to remove candidate when confirmed.
  // The `onCandidateHiredSuccessfully` prop serves this purpose.
  // It will be triggered by `RecruiterDashboard` when the modal confirms.
  useEffect(() => {
    const handleSuccessfulHire = (appliedJobId: string) => {
      setCandidates(prev => prev.filter(c => c.id !== appliedJobId));
    };

    // We can also pass this directly as a prop to onCandidateHiredSuccessfully
    // and rely on the parent to call it.
    // For now, the prop is defined, and RecruiterDashboard will call it.
    // The effect above is slightly redundant if the prop directly manipulates state or re-fetches.

  }, []); // Empty dependency array, this effect sets up a listener or just notes how it works


  const companyName = job.recruiter?.company_name || 'Company Confidential';
  const recruiterProfilePicUrl = job.recruiter?.user?.avatar_url || job.recruiter?.user?.profile_pic_url || '';

  return (
    <div className="space-y-8">
      {showBackButton && (
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Job Listings
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {job && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{job.title}</h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">{job.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm text-gray-700">
            <div className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-500" /> {job.location}</div>
            <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-gray-500" /> {job.employment_type}</div>
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
              {job.salary ? `$${job.salary}` : 'N/A'}
            </div>
            <div className="flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-500" /> Posted {new Date(job.created_at).toLocaleDateString()}</div>
          </div>

          {job.required_skills && job.required_skills.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-800 mb-2">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">{skill}</span>
                ))}
              </div>
            </div>
          )}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-800 mb-2">Responsibilities</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {job.responsibilities.map((resp, index) => (
                  <li key={index}>{resp}</li>
                ))}
              </ul>
            </div>
          )}
          {job.benefits && job.benefits.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-800 mb-2">Benefits</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {job.benefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}

          {job.recruiter && (
            <div className="flex items-center space-x-4 pt-4 border-t border-gray-200 mt-4">
              <img
                src={recruiterProfilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(job.recruiter.user?.name || job.recruiter.company_name || 'U')}&background=random`}
                alt={job.recruiter.user?.name || job.recruiter.company_name || 'Recruiter'}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <span className="font-bold text-gray-900">{job.recruiter.user?.name || job.recruiter.company_name || 'Unknown Recruiter'}</span>
                <p className="text-sm text-gray-600">
                  <Building className="inline-block w-3 h-3 mr-1 align-middle text-gray-500" /> {companyName}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <h3 className="text-xl font-bold text-gray-900 mb-4">Applicants ({candidates.length})</h3>
      {loading ? (
        <div className="flex items-center justify-center py-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <Loader className="animate-spin h-6 w-6 text-blue-500 mr-3" />
          <span className="text-gray-600">Loading applicants...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No applicants for this job yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map(candidate => (
            <div key={candidate.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <img
                  src={candidate.developer.user?.avatar_url || candidate.developer.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.developer.user?.name || candidate.developer.github_handle || 'U')}&background=random`}
                  alt={candidate.developer.user?.name || candidate.developer.github_handle || 'Developer'}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h4 className="font-bold text-gray-900">{candidate.developer.user?.name || candidate.developer.github_handle || 'Unknown Developer'}</h4>
                  <p className="text-sm text-gray-600">{candidate.developer.github_handle || 'No GitHub Handle'}</p>
                  {candidate.developer.experience_years !== null && candidate.developer.experience_years !== undefined && (
                    <p className="text-xs text-gray-500">Exp: {candidate.developer.experience_years} years</p>
                  )}
                  {candidate.developer.skills && candidate.developer.skills.length > 0 && (
                    <p className="text-xs text-gray-500">Skills: {candidate.developer.skills.slice(0, 3).join(', ')}{candidate.developer.skills.length > 3 ? '...' : ''}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => setSelectedDeveloper(candidate.developer)}
                  className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 rounded-full text-gray-700 hover:bg-gray-200 transition-colors"
                  title="View Profile"
                >
                  <Eye size={16} className="mr-1" /> View Profile
                </button>
                <button
                  onClick={() => onMessageDeveloper(candidate.developer.user_id, candidate.developer.user?.name || candidate.developer.github_handle || 'Developer', job?.id, job?.title)}
                  className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 rounded-full text-blue-700 hover:bg-blue-200 transition-colors"
                  title="Message Developer"
                >
                  <MessageSquare size={16} className="mr-1" /> Message
                </button>
                <div className="relative">
                  <select
                    value={candidate.status}
                    onChange={(e) => handleStatusChange(candidate.id, e.target.value)}
                    className="appearance-none pr-8 pl-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                  >
                    <option value="applied">Applied</option>
                    <option value="viewed">Viewed</option>
                    <option value="contacted">Contacted</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <ChevronRight className="absolute right-2 top-1/2 transform -translate-y-1/2 rotate-90 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDeveloper && (
        <DeveloperProfileModal
          developer={selectedDeveloper}
          onClose={() => setSelectedDeveloper(null)}
        />
      )}
    </div>
  );
};
