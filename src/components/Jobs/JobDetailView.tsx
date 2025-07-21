import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth'; // Assuming useAuth provides userProfile
import { JobRole, AppliedJob } from '../../types'; // Removed 'Developer' as its full structure is defined below
import {
  Briefcase, User, ChevronRight, Clock, Eye, MessageSquare,
  Loader, AlertCircle, ArrowLeft, MapPin, DollarSign,
  Building // Added icons for Job Details section
} from 'lucide-react';
import { DeveloperProfileModal } from '../DeveloperProfileModal'; // Assuming this component exists and works

// Define the full Developer type as it's fetched, incorporating profile fields directly
interface DeveloperWithProfile {
  id: string; // This would typically be the user_id from the 'users' table or a separate ID for the developer entry
  user_id: string; // Foreign key to the 'users' table
  github_handle: string | null;
  bio: string | null;
  availability: boolean | null;
  top_languages: string[] | null;
  linked_projects: string[] | null;
  location: string | null;
  experience_years: number | null;
  desired_salary: number | null;
  created_at: string;
  updated_at: string;
  skills_categories: { [key: string]: any } | null; // jsonb
  profile_strength: number | null;
  public_profile_slug: string | null;
  notification_preferences: { [key: string]: boolean } | null; // jsonb
  resume_url: string | null;
  profile_pic_url: string | null;
  github_installation_id: string | null;
  public_profile_enabled: boolean | null;
  profile_view_count: number | null;
  search_appearance_count: number | null;
  skills: string[] | null;
  preferred_title: string | null;
  looking_for_job: boolean | null;
  // Nested user object from the join
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null; // Ensure this is the correct field for the user's profile pic in 'users'
    // Add other user fields as needed from 'users' table
  };
}

// Extending the Candidate interface for more specific typing
interface Candidate extends AppliedJob {
  developer: DeveloperWithProfile; // Use the newly defined DeveloperWithProfile
}

// Update JobRole structure for JobDetailViewProps to match RecruiterDashboard's FetchedJobRole
interface JobDetailViewProps {
  job: JobRole & {
    recruiter: { // Ensure this matches the type passed from RecruiterDashboard
      id: string;
      name: string;
      email: string;
      profile_pic_url?: string | null; // Added based on typical user profiles
      company_name: string | null; // Crucial: flattened from recruiter_profile
    };
  };
  onBack: () => void;
  onMessageDeveloper: (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => void;
  showBackButton?: boolean;
}

export const JobDetailView: React.FC<JobDetailViewProps> = ({ job, onBack, onMessageDeveloper, showBackButton = true }) => {
  const { userProfile } = useAuth(); // Not directly used in rendering, but kept for context if other logic needs it
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDeveloper, setSelectedDeveloper] = useState<DeveloperWithProfile | null>(null); // Use DeveloperWithProfile type

  useEffect(() => {
    fetchCandidates();
  }, [job.id]); // Re-fetch when job.id changes

  const fetchCandidates = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('applied_jobs')
        .select(`
          *,
          developer:developers (
            *,
            user:users(*)
          )
        `) // ALL COMMENTS REMOVED FROM HERE
        .eq('job_id', job.id);

      if (fetchError) {
        throw fetchError;
      }

      const transformedCandidates: Candidate[] = (data || []).map(appliedJob => {
        const developer = appliedJob.developer;
        if (!developer || !developer.user) {
          console.warn('Skipping candidate due to missing developer or user data:', appliedJob);
          return null;
        }
        return {
          ...appliedJob,
          developer: {
            ...developer,
            user: developer.user
          }
        } as Candidate;
      }).filter(Boolean) as Candidate[];

      setCandidates(transformedCandidates);
    } catch (err: any) {
      console.error("Error fetching candidates:", err);
      setError('Failed to fetch candidates. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateCandidateStatus = async (applicationId: string, status: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('applied_jobs')
        .update({ status })
        .eq('id', applicationId)
        .select();

      if (updateError) {
        throw updateError;
      }

      setCandidates(prev => prev.map(c => c.id === applicationId ? { ...c, status } : c));
    } catch (err: any) {
      console.error("Error updating candidate status:", err);
      setError('Failed to update candidate status. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const companyName = job.recruiter?.company_name || 'Company Confidential';
  const recruiterProfilePicUrl = job.recruiter?.profile_pic_url || '';

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
            <div className="flex items-center"><DollarSign className="w-4 h-4 mr-2 text-gray-500" /> ${job.salary_range_start?.toLocaleString() || 'N/A'} - ${job.salary_range_end?.toLocaleString() || 'N/A'} {job.salary_type || ''}</div>
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
              <img src={recruiterProfilePicUrl} alt={job.recruiter.name || 'Recruiter'} className="w-12 h-12 rounded-full object-cover" />
              <div>
                <span className="font-bold text-gray-900">{job.recruiter.name}</span>
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
          <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No applicants for this job yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map(candidate => (
            <div key={candidate.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <img
                  src={candidate.developer.user.avatar_url || candidate.developer.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.developer.user.name || candidate.developer.github_handle || 'U')}&background=random`}
                  alt={candidate.developer.user.name || candidate.developer.github_handle || 'Developer'}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h4 className="font-bold text-gray-900">{candidate.developer.user.name || candidate.developer.github_handle || 'Unknown Developer'}</h4>
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
                  onClick={() => onMessageDeveloper(candidate.developer.user_id, candidate.developer.user.name || candidate.developer.github_handle || 'Developer', job?.id, job?.title)}
                  className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 rounded-full text-blue-700 hover:bg-blue-200 transition-colors"
                  title="Message Developer"
                >
                  <MessageSquare size={16} className="mr-1" /> Message
                </button>
                <div className="relative">
                  <select
                    value={candidate.status}
                    onChange={(e) => updateCandidateStatus(candidate.id, e.target.value)}
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
