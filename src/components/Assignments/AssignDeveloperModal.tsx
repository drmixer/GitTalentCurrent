import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  X, 
  Search, 
  User, 
  Code, 
  MapPin, 
  Briefcase,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { User as UserType, Developer, JobRole } from '../../types';

interface AssignDeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedJobId?: string;
  preSelectedDeveloperId?: string;
  onSuccess?: () => void;
  jobRoleId?: string;
  onAssign?: () => void;
  onCancel?: () => void;
}

export const AssignDeveloperModal: React.FC<AssignDeveloperModalProps> = ({
  isOpen,
  onClose,
  preSelectedJobId,
  preSelectedDeveloperId,
  onSuccess,
  jobRoleId,
  onAssign,
  onCancel
}) => {
  const { createAssignment } = useAuth();
  const [developers, setDevelopers] = useState<(Developer & { user: UserType })[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [selectedDeveloperId, setSelectedDeveloperId] = useState(preSelectedDeveloperId || '');
  const [selectedJobId, setSelectedJobId] = useState(preSelectedJobId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchData();
      
      // If jobRoleId is provided, preselect it
      if (jobRoleId) {
        setSelectedJobId(jobRoleId);
      }
    }
  }, [isOpen, jobRoleId]);

  useEffect(() => {
    if (preSelectedDeveloperId) {
      setSelectedDeveloperId(preSelectedDeveloperId);
    }
    if (preSelectedJobId) {
      setSelectedJobId(preSelectedJobId);
    }
  }, [preSelectedDeveloperId, preSelectedJobId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch developers
      const { data: developersData, error: devError } = await supabase
        .from('developers')
        .select(`
          *,
          user:users!developers_user_id_fkey(*)
        `)
        .eq('user.is_approved', true);

      if (devError) throw devError;
      setDevelopers(developersData || []);

      // Fetch job roles
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_roles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;
      setJobRoles(jobsData || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDeveloperId || !selectedJobId) {
      setError('Please select both a developer and a job role');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from('assignments')
        .select('id')
        .eq('developer_id', selectedDeveloperId)
        .eq('job_role_id', selectedJobId)
        .maybeSingle();

      if (existingAssignment) {
        setError('This developer is already assigned to this job role');
        return;
      }

      // Get recruiter ID from job role
      const selectedJob = jobRoles.find(job => job.id === selectedJobId);
      if (!selectedJob) {
        setError('Selected job role not found');
        return;
      }

      const assignmentData = {
        developer_id: selectedDeveloperId,
        job_role_id: selectedJobId,
        recruiter_id: selectedJob.recruiter_id,
        status: 'New',
        notes: ''
      };

      const result = await createAssignment(assignmentData);

      if (result) {
        setSuccess('Developer assigned successfully!');
        setTimeout(() => {
          onSuccess?.();
          onAssign?.();
          onClose();
          resetForm();
        }, 1500);
      } else {
        throw new Error('Failed to create assignment');
      }

    } catch (error: any) {
      console.error('Error creating assignment:', error);
      setError(error.message || 'Failed to assign developer');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDeveloperId(preSelectedDeveloperId || '');
    setSelectedJobId(preSelectedJobId || '');
    setSearchTerm('');
    setError('');
    setSuccess('');
  };

  const filteredDevelopers = developers.filter(dev =>
    dev.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.github_handle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.top_languages.some(lang => lang.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const filteredJobs = jobRoles.filter(job =>
    job.title.toLowerCase().includes(jobSearchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(jobSearchTerm.toLowerCase()) ||
    job.tech_stack.some(tech => tech.toLowerCase().includes(jobSearchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900">Assign Developer to Job</h2>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Job Selection */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Select Job Role</h3>
            
            {/* Job Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search job roles..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={jobSearchTerm}
                onChange={(e) => setJobSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedJobId === job.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{job.title}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {job.location}
                        </span>
                        <span>${job.salary_min}k - ${job.salary_max}k</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {job.tech_stack.slice(0, 3).map((tech, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                            {tech}
                          </span>
                        ))}
                        {job.tech_stack.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                            +{job.tech_stack.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedJobId === job.id && (
                      <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Developer Selection */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Select Developer</h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search developers..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {filteredDevelopers.map((developer) => (
                <div
                  key={developer.user_id}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedDeveloperId === developer.user_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedDeveloperId(developer.user_id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                        {developer.user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-bold text-gray-900">{developer.user.name}</h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                            developer.availability 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            <div className={`w-2 h-2 rounded-full mr-1 ${
                              developer.availability ? 'bg-emerald-500' : 'bg-gray-500'
                            }`}></div>
                            {developer.availability ? 'Available' : 'Busy'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-3 text-sm text-gray-600 mb-2">
                          <span className="flex items-center">
                            <Briefcase className="w-4 h-4 mr-1" />
                            {developer.experience_years} years
                          </span>
                          {developer.location && (
                            <span className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {developer.location}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {developer.top_languages.slice(0, 3).map((lang, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                              {lang}
                            </span>
                          ))}
                          {developer.top_languages.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                              +{developer.top_languages.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedDeveloperId === developer.user_id && (
                      <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => {
              onClose();
              onCancel?.();
              resetForm();
            }}
            className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedDeveloperId || !selectedJobId || loading}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {loading ? (
              <div className="flex items-center">
                <Loader className="animate-spin rounded-full h-5 w-5 mr-3" />
                Assigning...
              </div>
            ) : (
              'Assign Developer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};