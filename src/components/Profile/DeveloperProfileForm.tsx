import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, Github, ExternalLink, Plus, X, Search, Upload, Loader, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { calculateProfileStrength, getProfileStrengthStatus } from '../../utils/profileStrengthUtils';

interface DeveloperProfile {
  user_id: string;
  github_handle: string;
  bio: string;
  availability: boolean;
  linked_projects: string[];
  location: string;
  experience_years: number;
  desired_salary: number;
  skills: string[];
  skills_categories: Record<string, string[]>;
  profile_strength: number;
  public_profile_slug: string;
  notification_preferences: {
    email: boolean;
    in_app: boolean;
    messages: boolean;
    assignments: boolean;
  };
  resume_url?: string;
  profile_pic_url?: string;
  github_installation_id?: string;
  public_profile_enabled?: boolean;
  preferred_title?: string;
}

interface DeveloperProfileFormProps {
  initialData?: Partial<DeveloperProfile>;
  onSuccess?: () => void;
  onCancel?: () => void;
  isOnboarding?: boolean;
}

const SKILL_CATEGORIES = {
  'Frontend': ['React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js', 'Gatsby', 'HTML5', 'CSS3', 'Sass', 'Less', 'Tailwind CSS', 'Bootstrap', 'Material-UI', 'Ant Design'],
  'Backend': ['Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET', 'Ruby on Rails', 'Laravel', 'Symfony', 'Phoenix', 'Gin', 'Echo'],
  'Database': ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'SQL Server', 'Cassandra', 'DynamoDB', 'Firebase', 'Supabase', 'PlanetScale'],
  'Cloud & DevOps': ['AWS', 'Google Cloud', 'Azure', 'Docker', 'Kubernetes', 'Jenkins', 'GitLab CI', 'GitHub Actions', 'Terraform', 'Ansible', 'Nginx', 'Apache'],
  'Mobile': ['React Native', 'Flutter', 'iOS (Swift)', 'Android (Kotlin)', 'Xamarin', 'Ionic', 'Cordova', 'Unity'],
  'Tools & Others': ['Git', 'Webpack', 'Vite', 'Babel', 'ESLint', 'Prettier', 'Jest', 'Cypress', 'Selenium', 'Figma', 'Adobe XD', 'Sketch']
};

// FIXED: Use centralized profile strength calculation
export { calculateProfileStrength } from '../../utils/profileStrengthUtils';

export const DeveloperProfileForm: React.FC<DeveloperProfileFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  isOnboarding = false
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [activeSkillCategory, setActiveSkillCategory] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [saveStatus, setSaveStatus] = useState<null | 'success' | 'error'>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form data with proper defaults
  const [formData, setFormData] = useState<DeveloperProfile>({
    user_id: user?.id || '',
    github_handle: '',
    bio: '',
    availability: true,
    linked_projects: [],
    location: '',
    experience_years: 0,
    desired_salary: 0,
    skills: [],
    skills_categories: {},
    profile_strength: 0,
    public_profile_slug: '',
    notification_preferences: {
      email: true,
      in_app: true,
      messages: true,
      assignments: true
    },
    resume_url: '',
    profile_pic_url: '',
    github_installation_id: '',
    public_profile_enabled: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Effect to properly initialize form data from initialData
  useEffect(() => {
    if (initialData && user?.id && !isInitialized) {
      console.log('Initializing form data with:', initialData);
      
      setFormData(prev => ({
        ...prev,
        user_id: user.id,
        github_handle: initialData.github_handle || prev.github_handle,
        bio: initialData.bio || '', // Ensure we use the actual value, not fallback to prev
        availability: initialData.availability !== undefined ? initialData.availability : prev.availability,
        linked_projects: initialData.linked_projects || prev.linked_projects,
        location: initialData.location || '', // Ensure we use the actual value, not fallback to prev
        experience_years: initialData.experience_years || prev.experience_years,
        desired_salary: initialData.desired_salary || prev.desired_salary,
        skills: initialData.skills || prev.skills,
        skills_categories: initialData.skills_categories || prev.skills_categories,
        profile_strength: initialData.profile_strength || prev.profile_strength,
        public_profile_slug: initialData.public_profile_slug || prev.public_profile_slug,
        notification_preferences: initialData.notification_preferences || prev.notification_preferences,
        resume_url: initialData.resume_url || prev.resume_url,
        profile_pic_url: initialData.profile_pic_url || prev.profile_pic_url,
        github_installation_id: initialData.github_installation_id || prev.github_installation_id,
        public_profile_enabled: initialData.public_profile_enabled !== undefined ? initialData.public_profile_enabled : prev.public_profile_enabled,
        preferred_title: initialData.preferred_title || prev.preferred_title
      }));
      
      setIsInitialized(true);
    }
  }, [initialData, user?.id, isInitialized]);

  // Set initial profile picture from GitHub if not already set and available
  useEffect(() => {
    if (!formData.profile_pic_url && user?.user_metadata?.avatar_url) {
      setFormData(prev => ({
        ...prev,
        profile_pic_url: user.user_metadata.avatar_url
      }));
    }
  }, [formData.profile_pic_url, user?.user_metadata?.avatar_url]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.bio.trim()) {
      newErrors.bio = 'Bio is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (formData.experience_years < 0) {
      newErrors.experience_years = 'Experience years cannot be negative';
    }

    if (formData.desired_salary < 0) {
      newErrors.desired_salary = 'Desired salary cannot be negative';
    }

    if (formData.public_profile_slug && !/^[a-z0-9-]+$/.test(formData.public_profile_slug)) {
      newErrors.public_profile_slug = 'Profile slug can only contain lowercase letters, numbers, and hyphens';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(prev => ({ ...prev, submit: undefined }));
    setSaveStatus(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { strength } = calculateProfileStrength(formData);
      
      // Create the data object for database insertion/update
      const skills = Object.values(formData.skills_categories).flat();
      const dataToSave = {
        user_id: formData.user_id,
        github_handle: formData.github_handle,
        bio: formData.bio,
        availability: formData.availability,
        linked_projects: formData.linked_projects,
        location: formData.location,
        experience_years: formData.experience_years,
        desired_salary: formData.desired_salary,
        skills: skills,
        skills_categories: formData.skills_categories,
        profile_strength: strength,
        public_profile_slug: formData.public_profile_slug,
        notification_preferences: formData.notification_preferences,
        resume_url: formData.resume_url,
        profile_pic_url: formData.profile_pic_url,
        github_installation_id: formData.github_installation_id,
        public_profile_enabled: formData.public_profile_enabled,
        preferred_title: formData.preferred_title
      };

      console.log('Saving developer profile data:', dataToSave);

      const { error } = await supabase
        .from('developers')
        .upsert(dataToSave, { onConflict: 'user_id' });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving developer profile:', error);
      setErrors({ submit: `Failed to save profile. ${error?.message || 'Please try again.'}` });
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleUseGitHubAvatar = () => {
    if (user?.user_metadata?.avatar_url) {
      setFormData(prev => ({
        ...prev,
        profile_pic_url: user.user_metadata.avatar_url
      }));
    } else {
      console.warn("Attempted to use GitHub avatar, but URL not found in user metadata.");
    }
  };

  const handleConnectGitHub = () => {
    setConnectingGitHub(true);
    // Note: navigate is not imported in this version
    // navigate('/github-setup');
  };

  const addSkillToCategory = (category: string) => {
    if (newSkill.trim()) {
      setFormData(prev => ({
        ...prev,
        skills_categories: {
          ...prev.skills_categories,
          [category]: [...(prev.skills_categories[category] || []), newSkill.trim()]
        }
      }));
      setNewSkill('');
      setActiveSkillCategory(null);
    }
  };

  const removeSkillFromCategory = (category: string, skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills_categories: {
        ...prev.skills_categories,
        [category]: prev.skills_categories[category]?.filter(s => s !== skill) || []
      }
    }));
  };

  const addPredefinedSkill = (category: string, skill: string) => {
    const currentSkills = formData.skills_categories[category] || [];
    if (!currentSkills.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        skills_categories: {
          ...prev.skills_categories,
          [category]: [...currentSkills, skill]
        }
      }));
    }
  };

  const handleFileUpload = async (file: File, type: 'profile_pic' | 'resume') => {
    if (type === 'resume') {
      setUploadingResume(true);
    } else {
      setUploadingProfilePic(true);
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('developer-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('developer-files')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        [type === 'resume' ? 'resume_url' : 'profile_pic_url']: publicUrl
      }));

    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      setErrors({ [type]: `Failed to upload ${type}. Please try again.` });
    } finally {
      if (type === 'resume') {
        setUploadingResume(false);
      } else {
        setUploadingProfilePic(false);
      }
    }
  };

  const { strength: currentProfileStrength, suggestions } = calculateProfileStrength(formData);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
          <h2 className="text-2xl font-bold text-white">
            {isOnboarding ? 'Complete Your Developer Profile' : 'Edit Developer Profile'}
          </h2>
          <p className="text-blue-100 mt-2">
            {isOnboarding 
              ? 'Help recruiters discover you by completing your profile'
              : 'Keep your profile updated to attract the best opportunities'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {initialData?.user?.name && initialData?.github_handle && (
            <div className="mb-6 pb-4 border-b border-gray-200">
              <h1 className="text-3xl font-bold text-gray-900">{initialData.user.name}</h1>
              <p className="text-lg text-gray-500">@{initialData.github_handle}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Profile Strength</h3>
              <span className="text-2xl font-bold text-blue-600">{currentProfileStrength}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${currentProfileStrength}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {getProfileStrengthStatus(currentProfileStrength)}
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Resume & Documents
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resume
              </label>
              <div className="flex items-center space-x-4">
                {formData.resume_url ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-green-700">Resume uploaded</span>
                    <a
                      href={formData.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No resume uploaded</span>
                )}
                <div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'resume');
                    }}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label
                    htmlFor="resume-upload"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    {uploadingResume ? (
                      <Loader className="animate-spin w-4 h-4 mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {uploadingResume ? 'Uploading...' : 'Upload Resume'}
                  </label>
                </div>
              </div>
              {errors.resume && (
                <p className="text-red-600 text-sm mt-1">{errors.resume}</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Basic Information
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                {formData.profile_pic_url ? (
                  <img 
                    src={formData.profile_pic_url} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'profile_pic');
                    }}
                    className="hidden"
                    id="profile-pic-upload"
                  />
                  <label
                    htmlFor="profile-pic-upload"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    {uploadingProfilePic ? (
                      <Loader className="animate-spin w-4 h-4 mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {uploadingProfilePic ? 'Uploading...' : 'Upload Photo'}
                  </label>
                  <button
                    type="button"
                    onClick={handleUseGitHubAvatar}
                    className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    title="Use your GitHub profile picture"
                  >
                    <Github className="w-4 h-4 mr-2 text-gray-500" />
                    Use GitHub Avatar
                  </button>
                </div>
              </div>
              {errors.profile_pic && (
                <p className="text-red-600 text-sm mt-1">{errors.profile_pic}</p>
              )}
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                Bio *
              </label>
              <textarea
                id="bio"
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tell us about yourself, your experience, and what you're passionate about... (At least 50 characters recommended for better profile strength)"
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.bio.length}/50+ characters (Current: {formData.bio.length >= 50 ? 'Good length' : 'Could be more detailed'})
              </div>
              {errors.bio && (
                <p className="text-red-600 text-sm mt-1">{errors.bio}</p>
              )}
            </div>

            <div>
              <label htmlFor="preferred_title" className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Title
              </label>
              <input
                type="text"
                id="preferred_title"
                value={formData.preferred_title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, preferred_title: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Full Stack Engineer, Frontend Developer, Backend Developer"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., San Francisco, CA or Remote"
                />
              </div>
              {errors.location && (
                <p className="text-red-600 text-sm mt-1">{errors.location}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="experience_years" className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Experience
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="experience_years"
                  value={formData.experience_years}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setFormData(prev => ({ ...prev, experience_years: value ? parseInt(value, 10) : 0 }));
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.experience_years && (
                  <p className="text-red-600 text-sm mt-1">{errors.experience_years}</p>
                )}
              </div>

              <div>
                <label htmlFor="desired_salary" className="block text-sm font-medium text-gray-700 mb-2">
                  Desired Salary (USD)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="desired_salary"
                  value={formData.desired_salary}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setFormData(prev => ({ ...prev, desired_salary: value ? parseInt(value, 10) : 0 }));
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 120000"
                />
                {errors.desired_salary && (
                  <p className="text-red-600 text-sm mt-1">{errors.desired_salary}</p>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.availability}
                  onChange={(e) => setFormData(prev => ({ ...prev, availability: e.target.checked }))}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  I'm currently available for new opportunities
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Technical Skills
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Skills by Category (Add at least 8 skills across 3+ categories for best profile strength)
              </label>
              <div className="space-y-4">
                {Object.entries(SKILL_CATEGORIES).map(([category, predefinedSkills]) => (
                  <div key={category} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{category}</h4>
                      <button
                        type="button"
                        onClick={() => setActiveSkillCategory(activeSkillCategory === category ? null : category)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {activeSkillCategory === category ? 'Cancel' : 'Add Skill'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {(formData.skills_categories[category] || []).map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkillFromCategory(category, skill)}
                            className="ml-2 text-green-600 hover:text-green-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {activeSkillCategory === category && (
                      <div className="space-y-3">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={newSkill}
                            onChange={(e) => setNewSkill(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkillToCategory(category))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter a skill..."
                          />
                          <button
                            type="button"
                            onClick={() => addSkillToCategory(category)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Add
                          </button>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600 mb-2">Or choose from popular {category.toLowerCase()} skills:</p>
                          <div className="flex flex-wrap gap-2">
                            {predefinedSkills
                              .filter(skill => !(formData.skills_categories[category] || []).includes(skill))
                              .map((skill) => (
                                <button
                                  key={skill}
                                  type="button"
                                  onClick={() => addPredefinedSkill(category, skill)}
                                  className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                                >
                                  {skill}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Profile Settings
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Public Profile Visibility
              </label>
              <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, public_profile_enabled: !prev.public_profile_enabled }))}
                  className={`${
                    formData.public_profile_enabled ? 'bg-blue-600' : 'bg-gray-300'
                  } relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      formData.public_profile_enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out`}
                  />
                </button>
                <span className={`text-sm ${formData.public_profile_enabled ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                  {formData.public_profile_enabled ? 'Your profile is PUBLIC' : 'Your profile is PRIVATE'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                When public, your profile will be visible at the URL below. When private, only you can see it.
              </p>
            </div>

            <div>
              <label htmlFor="public_profile_slug" className="block text-sm font-medium text-gray-700 mb-2">
                Public Profile URL Slug
              </label>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-2 bg-gray-100 text-gray-500 border border-r-0 border-gray-300 rounded-l-lg text-sm">
                  https://gittalent.dev/u/
                </span>
                <input
                  type="text"
                  id="public_profile_slug"
                  value={formData.public_profile_slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, public_profile_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="your-unique-slug"
                  disabled={!formData.public_profile_enabled}
                />
              </div>
              {formData.public_profile_enabled && formData.public_profile_slug && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center justify-between">
                  <span>
                    Your public URL:
                    <a
                      href={`https://gittalent.dev/u/${formData.public_profile_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline ml-1"
                    >
                      gittalent.dev/u/{formData.public_profile_slug}
                    </a>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(`https://gittalent.dev/u/${formData.public_profile_slug}`)}
                    className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    title="Copy URL"
                  >
                    Copy
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Customize your unique URL. Only lowercase letters, numbers, and hyphens.
              </p>
              {errors.public_profile_slug && (
                <p className="text-red-600 text-sm mt-1">{errors.public_profile_slug}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Notification Preferences
              </label>
              <div className="space-y-3">
                {Object.entries(formData.notification_preferences).map(([key, value]) => (
                  <label key={key} className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        notification_preferences: {
                          ...prev.notification_preferences,
                          [key]: e.target.checked
                        }
                      }))}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {key.replace('_', ' ')} notifications
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-grow">
                {errors.submit && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm p-2 bg-red-50 rounded-md">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errors.submit}</span>
                  </div>
                )}
                {saveStatus === 'success' && !loading && (
                  <div className="flex items-center space-x-2 text-green-600 text-sm p-2 bg-green-50 rounded-md">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>Profile saved successfully!</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:ml-auto">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-70"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || saveStatus === 'success'}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin w-5 h-5 mr-2" />
                      Saving...
                    </>
                  ) : saveStatus === 'success' ? (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Saved!
                    </>
                  ) : (
                    isOnboarding ? 'Complete Profile' : 'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
