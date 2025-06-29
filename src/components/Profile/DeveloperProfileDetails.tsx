import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { RealGitHubChart } from '../GitHub/RealGitHubChart';
import { PortfolioManager } from '../Portfolio/PortfolioManager';
import { ProfileStrengthIndicator } from './ProfileStrengthIndicator';
import { 
  User, 
  Code, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  Github, 
  Mail, 
  Calendar,
  ExternalLink,
  Loader,
  AlertCircle,
  X
} from 'lucide-react';
import { Developer, User as UserType } from '../../types';

interface DeveloperProfileDetailsProps {
  developerId?: string;
  developer?: Developer & { user: UserType };
  onClose?: () => void;
}

export const DeveloperProfileDetails: React.FC<DeveloperProfileDetailsProps> = ({
  developerId,
  developer: initialDeveloper,
  onClose
}) => {
  const { userProfile } = useAuth();
  const [developer, setDeveloper] = useState<Developer & { user: UserType } | null>(initialDeveloper || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    console.log('DeveloperProfileDetails useEffect - initialDeveloper:', initialDeveloper);
    console.log('DeveloperProfileDetails useEffect - developerId:', developerId);
    
    if (initialDeveloper) {
      console.log('Using provided developer data:', initialDeveloper);
      setDeveloper(initialDeveloper);
      setLoading(false);
    } else if (developerId) {
      fetchDeveloperProfile();
    }
  }, [developerId, initialDeveloper]);

  const fetchDeveloperProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Fetching developer profile for ID:', developerId);

      const { data, error: fetchError } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('user_id', developerId)
        .single();

      if (fetchError) {
        console.error('Error fetching developer profile:', fetchError);
        throw fetchError;
      }
      
      if (!data) {
        console.log('No developer profile found or no permission to access');
        throw new Error('Developer profile not found or you do not have permission to view it');
      }
      
      console.log('Developer profile fetched successfully:', data);
      setDeveloper(data);
    } catch (error: any) {
      console.error('Error fetching developer profile:', error);
      setError(error.message || 'Failed to load developer profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading developer profile...</span>
      </div>
    );
  }

  if (error || !developer) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <p className="text-red-800 font-medium">{error || 'Developer profile not found'}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Get display name in format: FirstName (GitHubUsername)
  const displayName = developer.github_handle 
    ? `${developer.user.name.split(' ')[0]} (${developer.github_handle})`
    : developer.user.name;

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'github', label: 'GitHub Activity' },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-5xl mx-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-gray-900">Developer Profile</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Profile Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-100">
        <div className="flex items-start md:items-center flex-col md:flex-row md:justify-between">
          <div className="flex items-center space-x-6 mb-4 md:mb-0">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">
              {developer.user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">{displayName}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {developer.github_handle && (
                  <a
                    href={`https://github.com/${developer.github_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:text-blue-600 transition-colors"
                  >
                    <Github className="w-4 h-4 mr-1" />
                    @{developer.github_handle}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
                {(userProfile?.role === 'admin' || userProfile?.id === developer.user_id) && (
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    {developer.user.email}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
              developer.availability 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                : 'bg-gray-100 text-gray-800 border border-gray-200'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                developer.availability ? 'bg-emerald-500' : 'bg-gray-500'
              }`}></div>
              {developer.availability ? 'Available for hire' : 'Not available'}
            </span>
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-blue-100 text-blue-800 border border-blue-200">
              <Calendar className="w-4 h-4 mr-2" />
              Profile Strength: {developer.profile_strength || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'profile' && (
        <div className="space-y-8">
          {/* Profile Stats */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="text-2xl font-black text-gray-900 mb-1">{developer.experience_years}</div>
              <div className="text-sm font-semibold text-gray-600">Years Experience</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <div className="text-2xl font-black text-gray-900 mb-1">{developer.top_languages.length}</div>
              <div className="text-sm font-semibold text-gray-600">Languages</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="text-2xl font-black text-gray-900 mb-1">{developer.linked_projects.length}</div>
              <div className="text-sm font-semibold text-gray-600">Projects</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100">
              <div className="text-2xl font-black text-gray-900 mb-1">
                {developer.desired_salary > 0 ? `$${developer.desired_salary.toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-sm font-semibold text-gray-600">Desired Salary</div>
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-4">About</h3>
            <p className="text-gray-600 leading-relaxed">
              {developer.bio || 'No bio provided.'}
            </p>
          </div>

          {/* Skills & Technologies */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-6">Skills & Technologies</h3>
            <div>
              <h4 className="font-bold text-gray-900 mb-3">Programming Languages</h4>
              <div className="flex flex-wrap gap-2">
                {developer.top_languages.length > 0 ? (
                  developer.top_languages.map((skill, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500">No languages specified</p>
                )}
              </div>
            </div>
          </div>

          {/* Experience & Location */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-6">Experience & Location</h3>
            <div className="space-y-4 text-gray-600">
              <div className="flex items-center">
                <Briefcase className="w-5 h-5 mr-3 text-gray-400" />
                <span className="font-medium">{developer.experience_years} years of experience</span>
              </div>
              {developer.location && (
                <div className="flex items-center">
                  <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-medium">{developer.location}</span>
                </div>
              )}
              {developer.desired_salary > 0 && (
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-medium">${developer.desired_salary.toLocaleString()}/year</span>
                </div>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-6">Linked Projects</h3>
            <div className="space-y-4">
              {developer.linked_projects.length > 0 ? (
                developer.linked_projects.map((project, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-2">Project {index + 1}</h4>
                        <p className="text-gray-600 text-sm mb-3 break-all">{project}</p>
                      </div>
                      <a
                        href={project}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Github className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No projects linked</p>
                </div>
              )}
            </div>
          </div>

          {/* Profile Strength */}
          <ProfileStrengthIndicator
            strength={developer.profile_strength || 0}
            suggestions={[]}
          />
        </div>
      )}

      {activeTab === 'portfolio' && (
        <PortfolioManager 
          developerId={developer.user_id} 
          isEditable={false}
        />
      )}

      {activeTab === 'github' && (
        <RealGitHubChart 
          githubHandle={developer.github_handle || ''} 
          className="w-full"
        />
      )}
    </div>
  );
};