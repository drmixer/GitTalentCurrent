import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JobRole, Developer, AppliedJob } from '../../types'; // Ensure JobRole, Developer, AppliedJob types are correctly defined
import { Briefcase, User, ChevronRight, Clock, Eye, MessageSquare, Check, X, Star, Loader, AlertCircle, ArrowLeft, MapPin, DollarSign } from 'lucide-react';
import { DeveloperProfileModal } from '../DeveloperProfileModal'; // Assuming this component exists and works

// Extending the Candidate interface for more specific typing
interface Candidate extends AppliedJob {
  developer: Developer & {
    user: { // Explicitly define user properties you expect
      id: string;
      name: string;
      email: string;
      profile_pic_url: string | null;
      // Add other user properties you might access here
    };
    // If you fetch developer_profile directly here, define it too
    developer_profile?: {
        skills?: string[];
        preferred_technologies?: string[];
        years_experience?: number;
        hourly_rate?: number;
        // ... any other developer_profile fields
    };
  };
}

// Update JobRole structure for JobDetailViewProps to match RecruiterDashboard's FetchedJobRole
// This ensures `recruiter` has `company_name` directly on it
interface JobDetailViewProps {
  job: JobRole & {
    recruiter: {
      id: string;
      name: string;
      email: string;
      profile_pic_url?: string | null; // Add profile_pic_url here
      company_name: string | null; // This is the crucial part that was flattened
    };
  };
  onBack: () => void;
  onMessageDeveloper: (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => void;
  showBackButton?: boolean;
}

export const JobDetailView: React.FC<JobDetailViewProps> = ({ job, onBack, onMessageDeveloper, showBackButton = true }) => {
  const { userProfile } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
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
            *,
            user:users(*),
            developer_profile:developers!inner (  // Assuming inner join for developer_profile
                skills,
                portfolio_url,
                github_url,
                linkedin_url,
                resume_url,
                preferred_technologies,
                years_experience,
                hourly_rate,
                availability,
                notice_period,
                communication_preferences
            )
          )
        `)
        .eq('job_id', job.id);

      if (fetchError) throw fetchError;

      // Ensure data is an array and transform it safely
      const transformedCandidates: Candidate[] = (data || []).map(appliedJob => {
        const developer = appliedJob.developer;
        // Defensive check: ensure developer and its user property exist
        if (!developer || !developer.user) {
          console.warn('Skipping candidate due to missing developer or user data:', appliedJob);
          return null;
        }

        // Safely access developer_profile, ensuring it's an array and taking the first element
        // If developer_profile is null or an empty array, default to an empty object
        const developerProfileData = Array.isArray(developer.developer_profile) && developer.developer_profile.length > 0
            ? developer.developer_profile[0]
            : {};

        return {
          ...appliedJob,
          developer: {
            ...developer,
            user: developer.user, // Directly assign user
            ...developerProfileData // Spread profile data directly onto developer
          }
        } as Candidate;
      }).filter(Boolean) as Candidate[]; // Filter out any nulls

      setCandidates(transformedCandidates);
    } catch (err: any) {
      console.error("Error fetching candidates:", err);
      setError('Failed to fetch candidates. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateCandidateStatus = async (applicationId: string, status: string) => {
    setLoading(true); // Indicate loading for status update
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('applied_jobs')
        .update({ status })
        .eq('id', applicationId)
        .select();

      if (updateError) throw updateError;

      setCandidates(prev => prev.map(c => c.id === applicationId ? { ...c, status } : c));
    } catch (err: any) {
      console.error("Error updating candidate status:", err);
      setError('Failed to update candidate status. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Defensive check for job.recruiter and job.recruiter.company_name
  const companyName = job.recruiter?.company_name || 'Company Confidential';
  const recruiterProfilePicUrl = job.recruiter?.profile_pic_url || '';

  return (
    <div>
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
          <h2 className="text-2xl font-bold mb-4">{job.title}</h2>
          <p className="text-gray-600 mb-4 whitespace-pre-line">{job.description}</p> {/* Added whitespace-pre-line */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
            <div className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-400" /> {job.location}</div>
            <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-gray-400" /> {job.employment_type}</div> {/* Changed job_type to employment_type */}
            <div className="flex items-center"><DollarSign className="w-4 h-4 mr-2 text-gray-400" /> ${job.salary_range_start?.toLocaleString()} - ${job.salary_range_end?.toLocaleString()} {job.salary_type}</div> {/* Updated salary display */}
            <div className="flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-400" /> Posted {new Date(job.created_at).toLocaleDateString()}</div>
          </div>

          {job.required_skills && job.required_skills.length > 0 && ( // Defensive check for tech_stack
            <div className="mb-4">
              <h3 className="font-bold mb-2">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">{skill}</span>
                ))}
              </div>
            </div>
          )}
           {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold mb-2">Responsibilities</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {job.responsibilities.map((resp, index) => (
                  <li key={index}>{resp}</li>
                ))}
              </ul>
            </div>
          )}
          {job.benefits && job.benefits.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold mb-2">Benefits</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {job.benefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}


          {job.recruiter && (
            <div className="flex items-center space-x-4 pt-4 border-t border-gray-200 mt-4">
              <img src={recruiterProfilePicUrl} alt={job.recruiter?.name || 'Recruiter'} className="w-12 h-12 rounded-full object-cover" />
              <div>
                <span className="font-bold">{job.recruiter.name}</span> {/* Changed to span as it might not be a clickable link to a recruiter profile page yet */}
                <p className="text-sm text-gray-600">
                  {companyName}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <h3 className="text-xl font-bold mb-4">Applicants ({candidates.length})</h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
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
                  src={candidate.developer.user.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.developer.user.name || 'U')}&background=random`}
                  alt={candidate.developer.user.name || 'User'}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h4 className="font-bold text-gray-900">{candidate.developer.user.name}</h4>
                  <p className="text-sm text-gray-600">{candidate.developer.github_handle || 'No GitHub'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => setSelectedDeveloper(candidate.developer)}
                  className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="View Profile"
                >
                  <Eye size={18} />
                </button>
                <button
                  onClick={() => onMessageDeveloper(candidate.developer.user.id, candidate.developer.user.name, job?.id, job?.title)}
                  className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Message Developer"
                >
                  <MessageSquare size={18} />
                </button>
                <div className="relative">
                  <select
                    value={candidate.status}
                    onChange={(e) => updateCandidateStatus(candidate.id, e.target.value)}
                    className="appearance-none pr-8 pl-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
