import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { JobRole } from '../../types';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Star,
  MapPin,
  DollarSign,
  Clock,
  Calendar,
  Loader,
  Briefcase,
  CheckCircle, // Added for success messages
  AlertCircle // Added for error messages
} from 'lucide-react';
import { JobRoleForm } from '../JobRoles/JobRoleForm';
import { JobImportModal } from '../JobRoles/JobImportModal';

interface JobsDashboardProps {
  jobRoles: JobRole[];
  onViewApplicants: (jobId: string) => void;
  onJobUpdate: () => void; // This function is called to refresh the job list in the parent
}

const JobsDashboard: React.FC<JobsDashboardProps> = ({ jobRoles, onViewApplicants, onJobUpdate }) => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false); // Used for dashboard-level operations like delete, toggle status
  const [error, setError] = useState(''); // Used for dashboard-level errors
  const [success, setSuccess] = useState(''); // Used for dashboard-level success messages
  const [searchTerm, setSearchTerm] = useState('');
  const [editingJob, setEditingJob] = useState<JobRole | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  /**
   * REFACTOR: This function now handles the completion of the JobRoleForm
   * It no longer performs its own database insert/update operations.
   * JobRoleForm (via useAuth) is responsible for that.
   */
  const handleJobFormCompletion = () => {
    setSuccess('Job operation completed successfully!');
    onJobUpdate(); // Refresh the list of job roles in the parent component
    setShowJobForm(false); // Close the form modal
    setEditingJob(null); // Clear the editing state

    setTimeout(() => setSuccess(''), 3000); // Clear success message after 3 seconds
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;

    try {
      setLoading(true);
      setError('');
      const { error } = await supabase.from('job_roles').delete().eq('id', jobId);
      if (error) throw error;
      setSuccess('Job deleted successfully!');
      onJobUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error deleting job:', error);
      setError(error.message || 'Failed to delete job');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleJobStatus = async (jobId: string, isActive: boolean) => {
    try {
      setLoading(true);
      setError('');
      const { error } = await supabase.from('job_roles').update({ is_active: !isActive }).eq('id', jobId);
      if (error) throw error;
      setSuccess(`Job ${isActive ? 'paused' : 'activated'} successfully!`);
      onJobUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error updating job status:', error);
      setError(error.message || 'Failed to update job status');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeatureJob = async (jobId: string, isFeatured: boolean) => {
    try {
      setLoading(true);
      setError('');
      const { error } = await supabase.from('job_roles').update({ is_featured: !isFeatured }).eq('id', jobId);
      if (error) throw error;
      setSuccess(`Job ${isFeatured ? 'unfeatured' : 'featured'} successfully!`);
      onJobUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error featuring job:', error);
      setError(error.message || 'Failed to feature job');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobRoles.filter(job =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.tech_stack.some(tech => tech.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">My Job Listings</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 text-purple-600 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Import Jobs
          </button>
          <button
            onClick={() => { setEditingJob(null); setShowJobForm(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Post New Job
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
            <p className="text-sm font-medium text-green-800">{success}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search job listings..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
          <span className="text-gray-600 font-medium">Loading...</span>
        </div>
      ) : filteredJobs.length > 0 ? (
        <div className="space-y-6">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${job.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {job.is_active ? 'Active' : 'Paused'}
                    </span>
                    {job.is_featured && <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">Featured</span>}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center"><MapPin className="w-4 h-4 mr-1" />{job.location}</div>
                    <div className="flex items-center"><Clock className="w-4 h-4 mr-1" />{job.job_type}</div>
                    <div className="flex items-center"><DollarSign className="w-4 h-4 mr-1" />${job.salary}</div>
                    <div className="flex items-center"><Calendar className="w-4 h-4 mr-1" />Posted {new Date(job.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {job.tech_stack.map((tech, index) => <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">{tech}</span>)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => handleToggleFeatureJob(job.id, !!job.is_featured)} className={`p-2 rounded-lg ${job.is_featured ? 'text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`} title={job.is_featured ? "Unfeature Job" : "Feature Job"}>
                    <Star className="w-5 h-5" fill={job.is_featured ? "currentColor" : "none"} />
                  </button>
                  <button onClick={() => { setEditingJob(job); setShowJobForm(true); }} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg" title="Edit Job"><Edit className="w-5 h-5" /></button>
                  <button onClick={() => handleDeleteJob(job.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg" title="Delete Job"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button onClick={() => onViewApplicants(job.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"><Eye className="w-4 h-4 mr-2 inline" />View Applicants</button>
                <button onClick={() => handleToggleJobStatus(job.id, job.is_active)} className={`px-4 py-2 ${job.is_active ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'} rounded-lg transition-colors font-semibold`}>
                  {job.is_active ? 'Pause Listing' : 'Activate Listing'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Job Listings Found</h3>
          <p className="text-gray-600 mb-6">{searchTerm ? "No jobs match your search criteria" : "You haven't created any job listings yet"}</p>
          <button onClick={() => { setEditingJob(null); setShowJobForm(true); }} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold">
            <Plus className="w-4 h-4 mr-2 inline" />Post Your First Job
          </button>
        </div>
      )}

      {showJobForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* IMPORTANT CHANGE: onSuccess now points to handleJobFormCompletion */}
            <JobRoleForm jobRole={editingJob} onSuccess={handleJobFormCompletion} onCancel={() => { setShowJobForm(false); setEditingJob(null); }} />
          </div>
        </div>
      )}

      {showImportModal && <JobImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onSuccess={onJobUpdate} />}
    </div>
  );
};

export default JobsDashboard;
