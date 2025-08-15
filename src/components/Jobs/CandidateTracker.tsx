import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JobRole, Developer, AppliedJob, User } from '../../types'; // Ensure User is imported
import { Briefcase, User as UserIcon, ChevronRight, Clock, Eye, MessageSquare, Check, X, Star, Loader, AlertCircle, FileText, ExternalLink } from 'lucide-react';

interface Candidate extends AppliedJob {
  developer: Developer & { user: User }; // Ensure this matches your Developer type if 'user' is always present
}

export const CandidateTracker: React.FC = () => {
  const { userProfile } = useAuth();
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobRole | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userProfile?.id) {
      fetchJobRoles();
    }
  }, [userProfile]);

  const fetchJobRoles = async () => {
    try {
      setLoadingJobs(true);
      setError('');
      const { data, error } = await supabase
        .from('job_roles')
        .select('*')
        .eq('recruiter_id', userProfile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobRoles(data || []);
    } catch (err: any) {
      setError('Failed to fetch job roles. ' + err.message);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchCandidates = async (jobId: string) => {
    try {
      setLoadingCandidates(true);
      setError('');
      const { data, error } = await supabase
        .from('applied_jobs')
        .select(`
          *,
          developer:developers (
            id,
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
        .eq('job_id', jobId);

      if (error) throw error;
      setCandidates(data as Candidate[] || []);
    } catch (err: any) {
      setError('Failed to fetch candidates. ' + err.message);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleJobSelect = (job: JobRole) => {
    setSelectedJob(job);
    fetchCandidates(job.id);
  };

  const updateCandidateStatus = async (applicationId: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('applied_jobs')
        .update({ status })
        .eq('id', applicationId)
        .select();

      if (error) throw error;

      setCandidates(prev => prev.map(c => c.id === applicationId ? { ...c, status } : c));
    } catch (err: any) {
      setError('Failed to update candidate status. ' + err.message);
    }
  };

  const handleViewResume = (resumeUrl: string) => {
    if (resumeUrl) {
      window.open(resumeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loadingJobs) {
    return <div className="flex items-center justify-center py-12"><Loader className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex space-x-6">
      {/* Jobs List */}
      <div className="w-1/3">
        <h2 className="text-xl font-bold mb-4">Your Job Listings</h2>
        <div className="space-y-2">
          {jobRoles.map(job => (
            <div
              key={job.id}
              onClick={() => handleJobSelect(job)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${selectedJob?.id === job.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            >
              <h3 className="font-semibold">{job.title}</h3>
              <p className="text-sm text-gray-500">{job.location}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Candidates View */}
      <div className="w-2/3">
        {selectedJob ? (
          <div>
            <h2 className="text-xl font-bold mb-4">Candidates for {selectedJob.title}</h2>
            {loadingCandidates ? (
              <div className="flex items-center justify-center py-12"><Loader className="animate-spin h-8 w-8 text-blue-600" /></div>
            ) : candidates.length > 0 ? (
              <div className="space-y-4">
                {candidates.map(candidate => (
                  <div key={candidate.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img 
                          src={candidate.developer.profile_pic_url || candidate.developer.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.developer.user?.name || candidate.developer.github_handle || 'U')}&background=random`} 
                          alt={candidate.developer.user?.name || 'Developer'} 
                          className="w-12 h-12 rounded-full object-cover" 
                        />
                        <div>
                          <h4 className="font-bold">{candidate.developer.user?.name || 'Unknown'}</h4>
                          <p className="text-sm text-gray-600">{candidate.developer.github_handle}</p>
                          {candidate.developer.preferred_title && (
                            <p className="text-sm text-blue-600 font-medium">{candidate.developer.preferred_title}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          className="p-2 hover:bg-gray-100 rounded-full"
                          title="View Profile"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          className="p-2 hover:bg-gray-100 rounded-full"
                          title="Send Message"
                        >
                          <MessageSquare size={18} />
                        </button>
                        {candidate.developer.resume_url ? (
                          <button 
                            onClick={() => handleViewResume(candidate.developer.resume_url!)}
                            className="p-2 hover:bg-gray-100 rounded-full text-green-600"
                            title="View Resume"
                          >
                            <FileText size={18} />
                          </button>
                        ) : (
                          <button 
                            className="p-2 rounded-full text-gray-300 cursor-not-allowed"
                            title="No Resume Available"
                            disabled
                          >
                            <FileText size={18} />
                          </button>
                        )}
                        <button 
                          className="p-2 hover:bg-gray-100 rounded-full"
                          title="Save Candidate"
                        >
                          <Star size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Candidate Details */}
                    <div className="mt-3 space-y-2">
                      {candidate.developer.bio && (
                        <p className="text-sm text-gray-700 line-clamp-2">{candidate.developer.bio}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        {candidate.developer.location && (
                          <span>📍 {candidate.developer.location}</span>
                        )}
                        {candidate.developer.experience_years > 0 && (
                          <span>💼 {candidate.developer.experience_years}+ years</span>
                        )}
                        {candidate.developer.desired_salary > 0 && (
                          <span>💰 ${candidate.developer.desired_salary.toLocaleString()}</span>
                        )}
                      </div>

                      {/* Skills */}
                      {candidate.developer.skills && candidate.developer.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {candidate.developer.skills.slice(0, 5).map((skill, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {skill}
                            </span>
                          ))}
                          {candidate.developer.skills.length > 5 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              +{candidate.developer.skills.length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Resume indicator */}
                      <div className="flex items-center space-x-2 mt-2">
                        {candidate.developer.resume_url ? (
                          <div className="flex items-center space-x-1 text-green-600 text-xs">
                            <FileText size={14} />
                            <span>Resume available</span>
                            <button 
                              onClick={() => handleViewResume(candidate.developer.resume_url!)}
                              className="text-green-600 hover:text-green-800 underline"
                            >
                              View
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 text-gray-400 text-xs">
                            <FileText size={14} />
                            <span>No resume uploaded</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="text-sm text-gray-500">
                        Applied: {new Date(candidate.applied_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center space-x-3">
                        <select
                          value={candidate.status}
                          onChange={(e) => updateCandidateStatus(candidate.id, e.target.value)}
                          className="text-sm border-gray-300 rounded-md"
                        >
                          <option value="applied">Applied</option>
                          <option value="viewed">Viewed</option>
                          <option value="contacted">Contacted</option>
                          <option value="hired">Hired</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        
                        {/* Quick action buttons */}
                        <button 
                          onClick={() => updateCandidateStatus(candidate.id, 'contacted')}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                          disabled={candidate.status === 'contacted'}
                        >
                          {candidate.status === 'contacted' ? 'Contacted' : 'Mark Contacted'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications Yet</h3>
                <p className="text-gray-600">No candidates have applied for this job yet.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <Briefcase size={48} className="mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600">Select a job to view candidates.</p>
          </div>
        )}
      </div>
    </div>
  );
};
