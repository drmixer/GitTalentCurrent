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
  X,
  FileText,
  Bell,
  Link,
  MessageSquare
} from 'lucide-react';
import { Developer, User as UserType } from '../../types';

interface DeveloperProfileDetailsProps {
  developerId?: string;
  developer?: Developer & { user: UserType };
  onClose?: () => void;
  onSendMessage?: (developerId: string, developerName: string) => void;
}

export const DeveloperProfileDetails: React.FC<DeveloperProfileDetailsProps> = ({
  developerId,
  developer: initialDeveloper,
  onClose,
  onSendMessage
}) => {
  const { userProfile } = useAuth();
  const [developer, setDeveloper] = useState<Developer & { user: UserType } | null>(initialDeveloper || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (initialDeveloper) {
      setDeveloper(initialDeveloper);
      console.log('DeveloperProfileDetails: Using provided developer data:', initialDeveloper);
      setLoading(false);
    } else if (developerId) {
      console.log('DeveloperProfileDetails: Fetching developer profile for ID:', developerId);
      fetchDeveloperProfile();
    }
  }, [developerId, initialDeveloper]);

  const fetchDeveloperProfile = async () => {
    try {
      setLoading(true);
      console.log('DeveloperProfileDetails: Starting fetch for developer ID:', developerId);
      setError(''); 

      // Fetch developer with user data
      const { data, error: fetchError } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('user_id', developerId)
        .single();

      if (fetchError) {
        console.error('DeveloperProfileDetails: Error fetching developer profile:', fetchError);
        console.error('Error fetching developer profile:', fetchError.message);
        setError(fetchError.message || 'Failed to load developer profile');
        setDeveloper(null);
      } else {
        console.log('Developer profile fetched successfully:', data);
        setDeveloper(data);
      }
      
    } catch (err) {
      console.error('Error in fetchDeveloperProfile:', err); 
      setError('Unexpected error loading developer profile');
      setDeveloper(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (developer && onSendMessage) {
      onSendMessage(developer.user_id, developer.user.name);
    }
  };

  // Generate profile strength suggestions based on missing data
  const generateProfileSuggestions = (): string[] => {
    const suggestions: string[] = [];
    
    if (!developer) return suggestions;
    
    if (!developer.github_handle) {
      suggestions.push('Add your GitHub handle to showcase your coding activity');
    }
    
    if (!developer.bio || developer.bio.length < 50) {
      suggestions.push('Complete your bio with at least 50 characters');
    }
    
    if (!developer.location) {
      suggestions.push('Add your location to receive location-specific opportunities');
    }
    
    if (developer.experience_years === 0) {
      suggestions.push('Specify your years of experience');
    }
    
    if (developer.desired_salary === 0) {
      suggestions.push('Set your desired salary to help match with appropriate roles');
    }
    
    if (!developer.top_languages || developer.top_languages.length < 3) {
      suggestions.push('Add at least 3 programming languages to your profile');
    }
    
    if (!developer.linked_projects || developer.linked_projects.length < 2) {
      suggestions.push('Link at least 2 projects to demonstrate your work');
    }
    
    if (!developer.resume_url) {
      suggestions.push('Add a link to your resume for recruiters to review');
    }
    
    return suggestions;
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

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-100"> 
        <div className="flex items-start md:items-center flex-col md:flex-row md:justify-between">
          <div className="flex items-center space-x-6 mb-4 md:mb-0">
            {developer.profile_pic_url ? (
              <img 
                src={developer.profile_pic_url} 
                alt={developer.user.name}
                className="w-20 h-20 rounded-2xl object-cover shadow-xl"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = "w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl";
                    fallback.textContent = developer.user.name.split(' ').map(n => n[0]).join('');
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">
                {developer.user.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
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
            
            {/* Message Button - Only show for recruiters/admins */}
            {onSendMessage && userProfile?.role !== 'developer' && (
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold flex items-center"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Message
              </button>
            )}
          </div>
        </div>
      </div>
      
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

      {activeTab === 'profile' && ( 
        <div className="space-y-8">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="text-2xl font-black text-gray-900 mb-1">{developer.experience_years}</div>
              <div className="text-sm font-semibold text-gray-600">Years Experience</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <div className="text-2xl font-black text-gray-900 mb-1">{developer.top_languages?.length || 0}</div>
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

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-4">About</h3> 
            <p className="text-gray-600 leading-relaxed">
              {developer.bio || 'No bio provided.'}
            </p>
          </div>

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
              {developer.resume_url && (
                <div className="flex items-center">
                  <FileText className="w-5 h-5 mr-3 text-gray-400" />
                  <a 
                    href={developer.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                  >
                    View Resume
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              )}
              {developer.public_profile_slug && (
                <div className="flex items-center">
                  <Link className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-medium">
                    Public Profile: {developer.public_profile_slug}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notification Preferences */}
          {(userProfile?.role === 'admin' || userProfile?.id === developer.user_id) && 
           developer.notification_preferences && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center mb-4">
                <Bell className="w-5 h-5 mr-2 text-gray-500" />
                <h3 className="text-lg font-black text-gray-900">Notification Preferences</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Email Notifications</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    developer.notification_preferences.email 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {developer.notification_preferences.email ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">In-App Notifications</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    developer.notification_preferences.in_app 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {developer.notification_preferences.in_app ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Message Notifications</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    developer.notification_preferences.messages 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {developer.notification_preferences.messages ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Assignment Notifications</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    developer.notification_preferences.assignments 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {developer.notification_preferences.assignments ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          )}

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

          <ProfileStrengthIndicator
            strength={developer.profile_strength || 0} 
            suggestions={generateProfileSuggestions()}
          />
        </div>
      )}

      {activeTab === 'portfolio' && (
        <div>
          <RealGitHubChart  
            githubHandle={developer.github_handle || ''} 
            className="w-full"
          />
        </div>
      )}

      {activeTab === 'github' && (
        <div>
          <RealGitHubChart  
            githubHandle={developer.github_handle || ''} 
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};