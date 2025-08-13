// src/components/Jobs/JobDetailView.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JobRole, AppliedJob, Developer } from '../../types';
import {
  Briefcase, User as UserIcon, Clock, Eye, MessageSquare,
  Loader, AlertCircle, ArrowLeft, MapPin, DollarSign,
  Building, PlusCircle, CheckCircle as CheckCircleIcon,
  FileText
} from 'lucide-react';
import { DeveloperProfileModal } from '../DeveloperProfileModal';

type CandidateType = AppliedJob & {
  developer: Developer & {
    user_id: string;
  };
  cover_letter?: string; // Added to display cover letter/comments
};

interface JobDetailViewProps {
  job: JobRole;
  onBack: () => void;
  onMessageDeveloper: (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => void;
  showBackButton?: boolean;
}

export const JobDetailView: React.FC<JobDetailViewProps> = ({ job, onBack, onMessageDeveloper, showBackButton = true }) => {
  const { userProfile } = useAuth();
  const [candidates, setCandidates] = useState<CandidateType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null);
  const [selectedCoverLetter, setSelectedCoverLetter] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<{ [appliedJobId: string]: 'idle' | 'loading' | 'added' }>({});

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
            user:users (*)
          )
        `)
        .eq('job_id', job.id)
        .neq('status', 'hired'); // This line removes already-hired candidates

      if (fetchError) throw fetchError;
      
      const validCandidates: CandidateType[] = (data || []).filter(appliedJob =>
        appliedJob.developer && appliedJob.developer.user
      ) as CandidateType[];
      
      setCandidates(validCandidates);

      const developerIds = validCandidates.map(c => c.developer.user_id);
      if (developerIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('developer_id, job_role_id')
          .in('developer_id', developerIds)
          .eq('job_role_id', job.id);
        
        const statusMap: { [appliedJobId: string]: 'idle' | 'loading' | 'added' } = {};
        validCandidates.forEach(candidate => {
            const isInPipeline = assignmentsData?.some(a => a.developer_id === candidate.developer.user_id);
            statusMap[candidate.id] = isInPipeline ? 'added' : 'idle';
        });
        setPipelineStatus(statusMap);
      }

    } catch (err: any) {
      console.error("Error fetching candidates:", err);
      setError('Failed to fetch candidates. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCandidateToPipeline = async (candidate: CandidateType) => {
    if (!userProfile?.id) {
        setError("You must be logged in to perform this action.");
        return;
    }

    setPipelineStatus(prev => ({ ...prev, [candidate.id]: 'loading' }));
    setError('');
    setSuccess('');

    try {
        const { error: createError } = await supabase
            .from('assignments')
            .insert({
                developer_id: candidate.developer.user_id,
                job_role_id: candidate.job_id,
                recruiter_id: userProfile.id,
                assigned_by: userProfile.id,
                status: 'New'
            });

        if (createError) {
            if (createError.code === '23505') { 
                setSuccess(`${candidate.developer.user.name} is already in the pipeline.`);
            } else {
                throw createError;
            }
        } else {
            setSuccess(`${candidate.developer.user.name} was successfully added to your pipeline!`);
        }
        
        setPipelineStatus(prev => ({ ...prev, [candidate.id]: 'added' }));

    } catch (error: any) {
        console.error("Error adding candidate to pipeline:", error);
        setError(`Failed to add candidate: ${error.message}`);
        setPipelineStatus(prev => ({ ...prev, [candidate.id]: 'idle' }));
    }
  };

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

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
                <p className="text-green-700 font-medium">{success}</p>
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
              {job.salary ? `$${job.salary.toLocaleString()}` : 'N/A'}
            </div>
            <div className="flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-500" /> Posted {new Date(job.created_at).toLocaleDateString()}</div>
          </div>
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
            <div key={candidate.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                    <img
                        src={candidate.developer.user?.avatar_url || candidate.developer.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.developer.user?.name || 'U')}&background=random`}
                        alt={candidate.developer.user?.name || 'Developer'}
                        className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                        <h4 className="font-bold text-gray-900">{candidate.developer.user?.name || 'Unknown Developer'}</h4>
                        <p className="text-sm text-gray-600">{candidate.developer.github_handle || 'No GitHub Handle'}</p>
                        <p className="text-xs text-gray-500">Applied {new Date(candidate.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
                  <button
                      onClick={() => addCandidateToPipeline(candidate)}
                      disabled={pipelineStatus[candidate.id] === 'loading' || pipelineStatus[candidate.id] === 'added'}
                      className={`inline-flex items-center px-3 py-1 text-sm rounded-full font-semibold transition-colors
                          ${pipelineStatus[candidate.id] === 'added' ? 'bg-green-100 text-green-800 cursor-not-allowed' : ''}
                          ${pipelineStatus[candidate.id] === 'loading' ? 'bg-gray-100 text-gray-500 cursor-wait' : ''}
                          ${!pipelineStatus[candidate.id] || pipelineStatus[candidate.id] === 'idle' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : ''}
                      `}
                  >
                      {pipelineStatus[candidate.id] === 'loading' ? <Loader size={16} className="mr-1 animate-spin" /> : null}
                      {pipelineStatus[candidate.id] === 'added' ? <CheckCircleIcon size={16} className="mr-1" /> : null}
                      {!pipelineStatus[candidate.id] || pipelineStatus[candidate.id] === 'idle' ? <PlusCircle size={16} className="mr-1" /> : null}
                      
                      {pipelineStatus[candidate.id] === 'loading' ? 'Adding...' :
                       pipelineStatus[candidate.id] === 'added' ? 'In Pipeline' : 'Add to Pipeline'}
                  </button>

                  {candidate.cover_letter && (
                    <button
                        onClick={() => setSelectedCoverLetter(candidate.cover_letter || '')}
                        className="inline-flex items-center px-3 py-1 text-sm bg-purple-100 rounded-full text-purple-700 hover:bg-purple-200 transition-colors"
                        title="View Cover Letter"
                    >
                        <FileText size={16} className="mr-1" /> Cover Letter
                    </button>
                  )}

                  <button
                      onClick={() => setSelectedDeveloper(candidate.developer)}
                      className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 rounded-full text-gray-700 hover:bg-gray-200 transition-colors"
                      title="View Profile"
                  >
                      <Eye size={16} className="mr-1" /> View Profile
                  </button>
                  <button
                      onClick={() => onMessageDeveloper(candidate.developer.user_id, candidate.developer.user?.name || 'Developer', job?.id, job?.title)}
                      className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 rounded-full text-blue-700 hover:bg-blue-200 transition-colors"
                      title="Message Developer"
                  >
                      <MessageSquare size={16} className="mr-1" /> Message
                  </button>
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

      {/* Cover Letter Modal */}
      {selectedCoverLetter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Cover Letter</h3>
              <button
                onClick={() => setSelectedCoverLetter(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selectedCoverLetter}
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedCoverLetter(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
