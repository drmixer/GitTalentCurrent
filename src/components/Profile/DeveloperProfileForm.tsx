import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  User, 
  Github, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  Plus, 
  X, 
  CheckCircle,
  AlertCircle,
  Code,
  GitBranch,
  Loader,
  Save
} from 'lucide-react';
import { Developer } from '../../types';

interface DeveloperProfileFormProps {
  initialData?: Partial<Developer>;
  onSuccess?: () => void;
  onCancel?: () => void;
  isOnboarding?: boolean;
}

export const DeveloperProfileForm: React.FC<DeveloperProfileFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  isOnboarding = false
}) => {
  const { user, userProfile, createDeveloperProfile, updateDeveloperProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    github_handle: '',
    bio: '',
    availability: true,
    location: '',
    experience_years: 0,
    desired_salary: 0,
    top_languages: [] as string[],
    linked_projects: [] as string[],
  });

  const [newLanguage, setNewLanguage] = useState('');
  const [newProject, setNewProject] = useState('');

  useEffect(() => {
    // Initialize form with user data from GitHub metadata if available
    if (user?.user_metadata) {
      setFormData(prev => ({
        ...prev,
        github_handle: user.user_metadata?.user_name || user.user_metadata?.preferred_username || prev.github_handle,
        bio: user.user_metadata?.bio || prev.bio,
        location: user.user_metadata?.location || prev.location,
      }));
    }
    
    // If initialData is provided, use it to populate the form
    if (initialData) {
      setFormData(prev => ({
        github_handle: initialData.github_handle || prev.github_handle || '',
        bio: initialData.bio || prev.bio || '',
        availability: initialData.availability !== undefined ? initialData.availability : prev.availability,
        location: initialData.location || prev.location || '',
        experience_years: initialData.experience_years || prev.experience_years || 0,
        desired_salary: initialData.desired_salary || prev.desired_salary || 0,
        top_languages: initialData.top_languages || prev.top_languages || [],
        linked_projects: initialData.linked_projects || prev.linked_projects || [],
      }));
    }
  }, [user, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleAvailabilityToggle = () => {
    setFormData(prev => ({
      ...prev,
      availability: !prev.availability
    }));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !formData.top_languages.includes(newLanguage.trim())) {
      setFormData(prev => ({
        ...prev,
        top_languages: [...prev.top_languages, newLanguage.trim()]
      }));
      setNewLanguage('');
    }
  };

  const removeLanguage = (language: string) => {
    setFormData(prev => ({
      ...prev,
      top_languages: prev.top_languages.filter(lang => lang !== language)
    }));
  };

  const addProject = () => {
    if (newProject.trim() && !formData.linked_projects.includes(newProject.trim())) {
      setFormData(prev => ({
        ...prev,
        linked_projects: [...prev.linked_projects, newProject.trim()]
      }));
      setNewProject('');
    }
  };

  const removeProject = (project: string) => {
    setFormData(prev => ({
      ...prev,
      linked_projects: prev.linked_projects.filter(proj => proj !== project)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.github_handle.trim()) {
        throw new Error('GitHub handle is required');
      }

      const profileData = {
        ...formData,
        github_handle: formData.github_handle.trim(),
        bio: formData.bio.trim(),
        location: formData.location.trim(),
      };

      let success;
      if (initialData && !isOnboarding) {
        // Update existing profile
        success = await updateDeveloperProfile?.(profileData);
      } else {
        // Create new profile
        success = await createDeveloperProfile?.(profileData);
      }
      
      if (success) {
        setSuccess(initialData && !isOnboarding ? 'Profile updated successfully!' : 'Profile created successfully!');
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        throw new Error(initialData && !isOnboarding ? 'Failed to update profile' : 'Failed to create profile');
      }
    } catch (error: any) {
      console.error('Profile form error:', error);
      setError(error.message || 'An error occurred while saving your profile');
    } finally {
      setLoading(false);
    }
  };

  const popularLanguages = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 
    'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin'
  ];

  return (
    <div className={`${isOnboarding ? '' : 'bg-white rounded-2xl p-8 shadow-sm border border-gray-100'}`}>
      {!isOnboarding && (
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            {initialData ? 'Edit Your Profile' : 'Complete Your Profile'}
          </h2>
          <p className="text-gray-600">
            Update your developer profile to showcase your skills and experience
          </p>
        </div>
      )}

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

        {/* GitHub Handle */}
        <div>
          <label htmlFor="github_handle" className="block text-sm font-bold text-gray-700 mb-2">
            GitHub Handle *
          </label>
          <div className="relative">
            <Github className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="github_handle"
              name="github_handle"
              type="text"
              required
              className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
              placeholder="your-github-username"
              value={formData.github_handle}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-bold text-gray-700 mb-2">
            Bio
          </label>
          <div className="relative">
            <User className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
            <textarea
              id="bio"
              name="bio"
              rows={4}
              className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium resize-none"
              placeholder="Tell us about yourself, your experience, and what you're passionate about..."
              value={formData.bio}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Location and Experience */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="location" className="block text-sm font-bold text-gray-700 mb-2">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="location"
                name="location"
                type="text"
                className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                placeholder="San Francisco, CA"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="experience_years" className="block text-sm font-bold text-gray-700 mb-2">
              Years of Experience
            </label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="experience_years"
                name="experience_years"
                type="number"
                min="0"
                max="50"
                className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                placeholder="5"
                value={formData.experience_years}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Desired Salary */}
        <div>
          <label htmlFor="desired_salary" className="block text-sm font-bold text-gray-700 mb-2">
            Desired Annual Salary (USD) - Optional
          </label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="desired_salary"
              name="desired_salary"
              type="number"
              min="0"
              className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
              placeholder="120000"
              value={formData.desired_salary}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="bg-gray-50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900 mb-2">Availability Status</h3>
              <p className="text-gray-600">Let recruiters know if you're open to new opportunities</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-semibold ${formData.availability ? 'text-emerald-600' : 'text-gray-500'}`}>
                {formData.availability ? 'Available for hire' : 'Not available'}
              </span>
              <button
                type="button"
                onClick={handleAvailabilityToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.availability ? 'bg-emerald-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.availability ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Top Languages */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-4">
            Top Programming Languages
          </label>
          
          {/* Popular Languages Quick Add */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Quick add popular languages:</p>
            <div className="flex flex-wrap gap-2">
              {popularLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    if (!formData.top_languages.includes(lang)) {
                      setFormData(prev => ({
                        ...prev,
                        top_languages: [...prev.top_languages, lang]
                      }));
                    }
                  }}
                  disabled={formData.top_languages.includes(lang)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    formData.top_languages.includes(lang)
                      ? 'bg-blue-100 text-blue-800 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Language Input */}
          <div className="flex space-x-2 mb-4">
            <input
              type="text"
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Add a programming language..."
            />
            <button
              type="button"
              onClick={addLanguage}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Selected Languages */}
          <div className="flex flex-wrap gap-2">
            {formData.top_languages.map((language) => (
              <span
                key={language}
                className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg"
              >
                {language}
                <button
                  type="button"
                  onClick={() => removeLanguage(language)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Linked Projects */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-4">
            Linked Projects (Optional)
          </label>
          <p className="text-sm text-gray-600 mb-4">
            Add GitHub repository URLs or project links to showcase your work
          </p>
          
          <div className="flex space-x-2 mb-4">
            <input
              type="url"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProject())}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="https://github.com/username/project-name"
            />
            <button
              type="button"
              onClick={addProject}
              className="px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {formData.linked_projects.map((project) => (
              <div
                key={project}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center overflow-hidden">
                  <GitBranch className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900 truncate">{project}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeProject(project)}
                  className="text-gray-400 hover:text-red-600 transition-colors ml-2 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-6 flex items-center justify-end space-x-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {loading ? (
              <>
                <Loader className="animate-spin rounded-full h-5 w-5 mr-3" />
                {initialData && !isOnboarding ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-3" />
                {initialData && !isOnboarding ? 'Update Profile' : 'Save Profile'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};