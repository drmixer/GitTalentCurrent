import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, Github, ExternalLink, Plus, X, Search, Upload, Loader, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface DeveloperProfile {
  user_id: string;
  github_handle: string;
  bio: string;
  availability: boolean;
  top_languages: string[];
  linked_projects: string[];
  location: string;
  experience_years: number;
  desired_salary: number;
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
}

interface DeveloperProfileFormProps {
  initialData?: Partial<DeveloperProfile>;
  onSuccess?: () => void;
  onCancel?: () => void;
  isOnboarding?: boolean;
}

const PROGRAMMING_LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust',
  'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'Scala', 'R', 'MATLAB',
  'HTML', 'CSS', 'SQL', 'Shell', 'PowerShell', 'Perl', 'Lua', 'Haskell',
  'Clojure', 'F#', 'Elixir', 'Erlang', 'Crystal', 'Nim', 'Zig', 'V'
];

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
  const [newLanguage, setNewLanguage] = useState('');
  const [newProject, setNewProject] = useState('');
  const [filteredLanguageSuggestions, setFilteredLanguageSuggestions] = useState<string[]>([]);
  const [activeSkillCategory, setActiveSkillCategory] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');

  const [formData, setFormData] = useState<DeveloperProfile>({
    user_id: user?.id || '',
    github_handle: '',
    bio: '',
    availability: true,
    top_languages: [],
    linked_projects: [],
    location: '',
    experience_years: 0,
    desired_salary: 0,
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
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (newLanguage) {
      const filtered = PROGRAMMING_LANGUAGES.filter(lang =>
        lang.toLowerCase().includes(newLanguage.toLowerCase()) &&
        !formData.top_languages.includes(lang)
      );
      setFilteredLanguageSuggestions(filtered.slice(0, 5));
    } else {
      setFilteredLanguageSuggestions([]);
    }
  }, [newLanguage, formData.top_languages]);

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

    if (formData.top_languages.length === 0) {
      newErrors.top_languages = 'At least one programming language is required';
    }

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
    if (data.top_languages.length > 0) strength += 15;
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
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const profileStrength = calculateProfileStrength(formData);
      const dataToSave = {
        ...formData,
        profile_strength: profileStrength
      };

      const { error } = await supabase
        .from('developers')
        .upsert(dataToSave, { onConflict: 'user_id' });

      if (error) throw error;

      onSuccess?.();
    } catch (error) {
      console.error('Error saving developer profile:', error);
      setErrors({ submit: 'Failed to save profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = () => {
    // Set a flag to indicate we're connecting GitHub
    setConnectingGitHub(true);
    // Navigate to GitHub setup page
    // Navigate to GitHub setup page
    navigate('/github-setup');
  };

  const addLanguage = (language?: string) => {
    const langToAdd = language || newLanguage.trim();
    if (langToAdd && !formData.top_languages.includes(langToAdd)) {
      setFormData(prev => ({
        ...prev,
        top_languages: [...prev.top_languages, langToAdd]
      }));
      setNewLanguage('');
      setFilteredLanguageSuggestions([]);
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
          {/* Profile Strength Indicator */}
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

          {/* Basic Information */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Basic Information
            </h3>

            {/* Profile Picture Upload */}
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
                </div>
              </div>
              {errors.profile_pic && (
                <p className="text-red-600 text-sm mt-1">{errors.profile_pic}</p>
              )}
            </div>

            {/* Bio */}
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

            {/* Location */}
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

            {/* Experience and Salary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="experience_years" className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Experience
                </label>
                <input
                  type="number"
                  id="experience_years"
                  min="0"
                  value={formData.experience_years}
                  onChange={(e) => setFormData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
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
                  type="number"
                  id="desired_salary"
                  min="0"
                  value={formData.desired_salary}
                  onChange={(e) => setFormData(prev => ({ ...prev, desired_salary: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 120000"
                />
                {errors.desired_salary && (
                  <p className="text-red-600 text-sm mt-1">{errors.desired_salary}</p>
                )}
              </div>
            </div>

            {/* Availability */}
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

          {/* Technical Skills */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Technical Skills
            </h3>

            {/* Programming Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Programming Languages *
              </label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {formData.top_languages.map((language) => (
                    <span
                      key={language}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
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
                
                <div className="relative">
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={newLanguage}
                        onChange={(e) => setNewLanguage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Search or type a programming language..."
                      />
                      
                      {filteredLanguageSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                          {filteredLanguageSuggestions.map((language) => (
                            <button
                              key={language}
                              type="button"
                              onClick={() => addLanguage(language)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {language}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => addLanguage()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              {errors.top_languages && (
                <p className="text-red-600 text-sm mt-1">{errors.top_languages}</p>
              )}
            </div>

            {/* Skills by Category */}
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

                    {/* Current skills in this category */}
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

                    {/* Add new skill */}
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

                        {/* Predefined skills */}
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

          {/* GitHub Integration */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              GitHub Integration
            </h3>

            <div>
              <label htmlFor="github_handle" className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Username
              </label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="github_handle"
                  value={formData.github_handle}
                  onChange={(e) => setFormData(prev => ({ ...prev, github_handle: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your-github-username"
                />
              </div>
            </div>

            {/* GitHub App Connection */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Github className="w-6 h-6 text-gray-600 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">Connect GitHub App</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Connect our GitHub App to automatically showcase your repositories, contributions, and coding activity.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectGitHub}
                    disabled={connectingGitHub}
                    className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {connectingGitHub ? (
                      <Loader className="animate-spin w-4 h-4 mr-2" />
                    ) : formData.github_installation_id ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Github className="w-4 h-4 mr-2" />
                    )}
                    {connectingGitHub 
                      ? 'Connecting...' 
                      : formData.github_installation_id 
                        ? 'Connected' 
                        : 'Connect GitHub App'
                    }
                  </button>
                  {formData.github_installation_id && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ GitHub App connected successfully
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Projects & Portfolio
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Links
              </label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {formData.linked_projects.map((project) => (
                    <span
                      key={project}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      {project}
                      <button
                        type="button"
                        onClick={() => removeProject(project)}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
                
                <div className="flex space-x-2">
                  <input
                    type="url"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProject())}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://github.com/username/project or https://yourproject.com"
                  />
                  <button
                    type="button"
                    onClick={addProject}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resume
              </label>
              <div className="flex items-center space-x-4">
                {formData.resume_url ? (
                  <div className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-600">Resume uploaded</span>
                    <a
                      href={formData.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View
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

          {/* Profile Settings */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Profile Settings
            </h3>

            {/* Public Profile Slug */}
            <div>
              <label htmlFor="public_profile_slug" className="block text-sm font-medium text-gray-700 mb-2">
                Public Profile URL
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">devhire.com/developer/</span>
                <input
                  type="text"
                  id="public_profile_slug"
                  value={formData.public_profile_slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, public_profile_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your-name"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                This will be your public profile URL that you can share with others
              </p>
              {errors.public_profile_slug && (
                <p className="text-red-600 text-sm mt-1">{errors.public_profile_slug}</p>
              )}
            </div>

            {/* Notification Preferences */}
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

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            {errors.submit && (
              <div className="flex items-center space-x-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.submit}</span>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 sm:ml-auto">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin w-5 h-5 mr-2" />
                    Saving...
                  </>
                ) : (
                  isOnboarding ? 'Complete Profile' : 'Save Changes'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};