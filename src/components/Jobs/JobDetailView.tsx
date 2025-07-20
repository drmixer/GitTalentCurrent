import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { JobRole, Developer, AppliedJob } from '../../types';
import { Briefcase, User, ChevronRight, Clock, Eye, MessageSquare, Check, X, Star, Loader, AlertCircle, ArrowLeft, MapPin, DollarSign } from 'lucide-react';
import { DeveloperProfileModal } from '../DeveloperProfileModal';

interface Candidate extends AppliedJob {
  developer: Developer & { user: any };
}

interface JobDetailViewProps {
  job: JobRole;
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
    try {
      const { data, error } = await supabase
        .from('applied_jobs')
        .select(`
          *,
          developer:developers (
            *,
            user:users(*)
          )
        `)
        .eq('job_id', job.id);

      if (error) throw error;
      setCandidates(data as Candidate[] || []);
    } catch (err: any) {
      setError('Failed to fetch candidates. ' + err.message);
    }
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
    <div>
      {showBackButton && (
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Job Listings
        </button>
      )}

      {job && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-2xl font-bold mb-4">{job.title}</h2>
          <p className="text-gray-600 mb-4">{job.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-400" /> {job.location}</div>
              <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-gray-400" /> {job.job_type}</div>
              <div className="flex items-center"><DollarSign className="w-4 h-4 mr-2 text-gray-400" /> ${job.salary_min}k - ${job.salary_max}k</div>
              <div className="flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-400" /> Posted {new Date(job.created_at).toLocaleDateString()}</div>
          </div>

          <div className="mb-4">
              <h3 className="font-bold mb-2">Tech Stack</h3>
              <div className="flex flex-wrap gap-2">
                  {job.tech_stack.map((tech, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">{tech}</span>
                  ))}
              </div>
          </div>

          {job.recruiter && (
            <div className="flex items-center space-x-4 pt-4 border-t border-gray-200">
              <img src={job.recruiter?.profile_pic_url || ''} alt={job.recruiter?.name} className="w-12 h-12 rounded-full" />
              <div>
                <a href={`/recruiters/${job.recruiter.id}`} className="font-bold hover:underline">{job.recruiter.name}</a>
                <p className="text-sm text-gray-600">
                  <a href={`/recruiters/${job.recruiter.id}`} className="hover:underline">
                    {job.recruiter.recruiters[0].company_name || 'Company Confidential'}
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <h3 className="text-xl font-bold mb-4">Applicants</h3>
      <div className="space-y-4">
        {candidates.map(candidate => (
          <div key={candidate.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img src={candidate.developer.user.profile_pic_url || ''} alt={candidate.developer.user.name} className="w-12 h-12 rounded-full" />
                <div>
                  <h4 className="font-bold">{candidate.developer.user.name}</h4>
                  <p className="text-sm text-gray-600">{candidate.developer.github_handle}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setSelectedDeveloper(candidate.developer)} className="p-2 hover:bg-gray-100 rounded-full"><Eye size={18} /></button>
                <button onClick={() => onMessageDeveloper(candidate.developer.user_id, candidate.developer.user.name, job?.id, job?.title)} className="p-2 hover:bg-gray-100 rounded-full"><MessageSquare size={18} /></button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Applied: {new Date(candidate.applied_at).toLocaleDateString()}
              </div>
              <div>
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
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDeveloper && (
        <DeveloperProfileModal
          developer={selectedDeveloper}
          onClose={() => setSelectedDeveloper(null)}
        />
      )}
    </div>
  );
};
