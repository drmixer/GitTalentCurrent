import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock, 
  Plus, 
  X, 
  Save,
  Loader,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { JobRole } from '../../types';

interface JobRoleFormProps {
  jobRole?: JobRole;
  onSuccess?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const JobRoleForm: React.FC<JobRoleFormProps> = ({
  jobRole,
  onSuccess,
  onCancel,
  onClose
}) => {
  const { createJobRole, updateJobRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    job_type: 'Full-time' as 'Full-time' | 'Part-time' | 'Contract' | 'Freelance',
    tech_stack: [] as string[],
    salary: '',
    experience_required: '',
    is_active: true,
    is_featured: false
  });

  const [newTech, setNewTech] = useState('');

  useEffect(() => {
    if (jobRole) {
      setFormData({
        title: jobRole.title,
        description: jobRole.description,
        location: jobRole.location,
        job_type: jobRole.job_type,
        tech_stack: jobRole.tech_stack || [],
        salary: jobRole.salary,
        experience_required: jobRole.experience_required,
        is_active: jobRole.is_active,
        is_featured: jobRole.is_featured || false
      });
    }
  }, [jobRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const addTech = () => {
    if (newTech.trim() && !formData.tech_stack.includes(newTech.trim())) {
      setFormData(prev => ({
        ...prev,
        tech_stack: [...prev.tech_stack, newTech.trim()]
      }));
      setNewTech('');
    }
  };

  const removeTech = (tech: string) => {
    setFormData(prev => ({
      ...prev,
      tech_stack: prev.tech_stack.filter(t => t !== tech)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate form data
      if (!formData.title.trim()) {
        throw new Error('Job title is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Job description is required');
      }
      if (!formData.location.trim()) {
        throw new Error('Location is required');
      }

      const jobData = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        experience_required: formData.experience_required.trim()
      };

      let result;
      if (jobRole) {
        result = await updateJobRole(jobRole.id, jobData);
      } else {
        result = await createJobRole(jobData);
      }

      if (result) {
        setSuccess(jobRole ? 'Job updated successfully!' : 'Job created successfully!');
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        throw new Error(jobRole ? 'Failed to update job' : 'Failed to create job');
      }
    } catch (error: any) {
      console.error('Job form error:', error);
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const popularTechs = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
    'Go', 'Rust', 'Docker', 'Kubernetes', 'AWS', 'PostgreSQL'
  ];

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gray-900 mb-2">
          {jobRole ? 'Edit Job Role' : 'Post New Job'}
        </h2>
        <p className="text-gray-600">
          {jobRole ? 'Update your job posting details' : 'Create a new job posting to attract top developers'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
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

        {/* Basic Information */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-2">
              Job Title *
            </label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="title"
                name="title"
                type="text"
                required
                className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                placeholder="Senior Full-Stack Developer"
                value={formData.title}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-bold text-gray-700 mb-2">
              Location *
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="location"
                name="location"
                type="text"
                required
                className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                placeholder="San Francisco, CA / Remote"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Job Type and Salary */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="job_type" className="block text-sm font-bold text-gray-700 mb-2">
              Job Type *
            </label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                id="job_type"
                name="job_type"
                required
                className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                value={formData.job_type}
                onChange={handleChange}
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="salary" className="block text-sm font-bold text-gray-700 mb-2">
              Salary (USD)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="salary"
                name="salary"
                type="text"
                pattern="[0-9]*"
                className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                placeholder="e.g. 100000"
                value={formData.salary}
                onChange={(e) => {
                  const { value } = e.target;
                  if (/^[0-9]*$/.test(value)) {
                    handleChange(e);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-bold text-gray-700 mb-2">
            Job Description *
          </label>
          <textarea
            id="description"
            name="description"
            rows={6}
            required
            className="appearance-none relative block w-full px-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium resize-none"
            placeholder="Describe the role, responsibilities, and what you're looking for in a candidate..."
            value={formData.description}
            onChange={handleChange}
          />
        </div>

        {/* Experience Required */}
        <div>
          <label htmlFor="experience_required" className="block text-sm font-bold text-gray-700 mb-2">
            Experience Required
          </label>
          <input
            id="experience_required"
            name="experience_required"
            type="text"
            className="appearance-none relative block w-full px-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
            placeholder="3+ years of experience with React and Node.js"
            value={formData.experience_required}
            onChange={handleChange}
          />
        </div>

        {/* Tech Stack */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-4">
            Tech Stack
          </label>
          
          {/* Popular Tech Quick Add */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Quick add popular technologies:</p>
            <div className="flex flex-wrap gap-2">
              {popularTechs.map((tech) => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => {
                    if (!formData.tech_stack.includes(tech)) {
                      setFormData(prev => ({
                        ...prev,
                        tech_stack: [...prev.tech_stack, tech]
                      }));
                    }
                  }}
                  disabled={formData.tech_stack.includes(tech)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    formData.tech_stack.includes(tech)
                      ? 'bg-blue-100 text-blue-800 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Tech Input */}
          <div className="flex space-x-2 mb-4">
            <input
              type="text"
              value={newTech}
              onChange={(e) => setNewTech(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Add a technology..."
            />
            <button
              type="button"
              onClick={addTech}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Selected Technologies */}
          <div className="flex flex-wrap gap-2">
            {formData.tech_stack.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg"
              >
                {tech}
                <button
                  type="button"
                  onClick={() => removeTech(tech)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Active Status */}
        <div className="bg-gray-50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900 mb-2">Job Status</h3>
              <p className="text-gray-600">Control whether this job is visible to developers</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-semibold ${formData.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                {formData.is_active ? 'Active' : 'Paused'}
              </span>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_active ? 'bg-emerald-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
        
        {/* Featured toggle */}
        <div className="bg-gray-50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900 mb-2">Featured Job</h3>
              <p className="text-gray-600">Feature this job for higher visibility to developers</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-semibold ${formData.is_featured ? 'text-yellow-600' : 'text-gray-500'}`}>
                {formData.is_featured ? 'Featured' : 'Not Featured'}
              </span>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, is_featured: !prev.is_featured }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_featured ? 'bg-yellow-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_featured ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end space-x-4 pt-6">
          {(onCancel || onClose) && (
            <button
              type="button"
              onClick={() => {
                onCancel?.();
                onClose?.();
              }}
              className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {loading ? (
              <div className="flex items-center">
                <Loader className="animate-spin rounded-full h-5 w-5 mr-3" />
                {jobRole ? 'Updating...' : 'Creating...'}
              </div>
            ) : (
              <div className="flex items-center">
                <Save className="h-5 w-5 mr-2" />
                {jobRole ? 'Update Job' : 'Create Job'}
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};