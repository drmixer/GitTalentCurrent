import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { User, Mail, MapPin, Github, ExternalLink, Plus, X, Search, Upload, Loader, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

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
  public_profile_enabled?: boolean; // Added for public/private toggle
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

export const DeveloperProfileForm: React.FC<DeveloperProfileFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  isOnboarding = false
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [activeSkillCategory, setActiveSkillCategory] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [saveStatus, setSaveStatus] = useState<null | 'success' | 'error'>(null);

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
    public_profile_enabled: initialData?.public_profile_enabled === undefined ? true : initialData.public_profile_enabled, // Default to true if not set
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Set initial profile picture from GitHub if not already set and available
    if (!formData.profile_pic_url && user?.user_metadata?.avatar_url) {
      setFormData(prev => ({
        ...prev,
        profile_pic_url: user.user_metadata.avatar_url
      }));
    }
    // This effect should run when initialData or user context changes,
    // primarily to populate the form on mount or data refresh.
    // The dependency array should reflect what `formData` depends on for its initial state.
  }, [initialData, user]); // Rerun if initialData or user changes

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

    // Removed top_languages validation
    // if (formData.top_languages.length === 0) {
    //   newErrors.top_languages = 'At least one programming language is required';
    // }

    if (formData.public_profile_slug && !/^[a-z0-9-]+$/.test(formData.public_profile_slug)) {
      newErrors.public_profile_slug = 'Profile slug can only contain lowercase letters, numbers, and hyphens';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateProfileStrength = (data: DeveloperProfile) => {
    let strength = 0;

    if (data.bio.trim()) strength += 15;
    if (data.location.trim()) strength += 10;
    if (data.github_handle.trim()) strength += 15;
    // if (data.top_languages.length > 0) strength += 15; // Removed top_languages from strength calculation
    if (data.linked_projects.length > 0) strength += 10;
    if (data.experience_years > 0) strength += 10;
    if (data.desired_salary > 0) strength += 5;
    if (data.resume_url) strength += 10;
    if (data.profile_pic_url) strength += 5;
    if (Object.keys(data.skills_categories).length > 0) strength += 5;

    return Math.min(strength, 100);
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
      const profileStrength = calculateProfileStrength(formData);
      // Destructure to remove the 'user' object if it exists, and any other non-column data
      const { user, skills_categories, ...developerDataOnly } = formData;
      const skills = Object.values(skills_categories).flat();
      const dataToSave = {
        ...developerDataOnly,
        skills: skills,
        skills_categories,
        profile_strength: profileStrength
        // user_id is already part of formData and thus in developerDataOnly
      };

      const { error } = await supabase
        .from('developers')
        .upsert(dataToSave, { onConflict: 'user_id' });

      if (error) throw error;

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000); // Reset after 3 seconds
      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving developer profile:', error);
      console.error('Supabase error details:', error?.message, error?.details, error?.hint, error?.code);
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
      // Optionally, add a toast message here: "GitHub avatar applied. Save changes to make it permanent."
    } else {
      // Optionally, add a toast message: "GitHub avatar URL not found."
      console.warn("Attempted to use GitHub avatar, but URL not found in user metadata.");
    }
  };

  const handleConnectGitHub = () => {
    // Set a flag to indicate we're connecting GitHub
    setConnectingGitHub(true);
    // Navigate to GitHub setup page
    // Navigate to GitHub setup page
    // navigate('/github-setup');
  };

  // Removed addLanguage and removeLanguage functions

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
      linked_projects: prev.linked_projects.filter(p => p !== project)
    }));
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

  const handleFileUpload = async (file: File, type: 'resume' | 'profile_pic') => {
    if (type === 'resume') {
      setUploadingResume(true);
    } else {
      setUploadingProfilePic(true);
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('developer-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('developer-files')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        [type === 'resume' ? 'resume_url' : 'profile_pic_url']: publicUrl + '?t=' + new Date().getTime()
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
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      handleFileUpload(file, 'profile_pic');
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.gif', '.jpg'] },
    multiple: false
  });

  const currentProfileStrength = calculateProfileStrength(formData);

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
              {currentProfileStrength < 50 && "Complete more sections to improve your visibility"}
              {currentProfileStrength >= 50 && currentProfileStrength < 80 && "Good progress! Add more details to stand out"}
              {currentProfileStrength >= 80 && "Excellent! Your profile looks great to recruiters"}
            </p>
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
                <div {...getRootProps()} className={`flex-grow p-4 border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center text-center transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <input {...getInputProps()} />
                  {uploadingProfilePic ? (
                    <>
                      <Loader className="animate-spin w-6 h-6 text-gray-500 mb-2" />
                      <p className="text-sm text-gray-600">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        {isDragActive ? 'Drop the image here...' : "Drag 'n' drop or click to upload"}
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleUseGitHubAvatar}
                  className="p-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                  title="Use your GitHub profile picture"
                >
                  <Github className="w-5 h-5 text-gray-600" />
                </button>
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
                placeholder="Tell us about yourself, your experience, and what you're passionate about..."
              />
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
                placeholder="e.g., Full Stack Engineer"
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
                Skills by Category
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
