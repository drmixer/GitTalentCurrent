import React from 'react';
import { 
  User, 
  Github, 
  MapPin, 
  Briefcase, 
  Code, 
  MessageSquare, 
  Eye,
  ExternalLink
} from 'lucide-react';
import { Developer, User as UserType } from '../types';

interface DeveloperCardProps {
  developer: Developer & { user: UserType };
  onViewProfile: () => void;
  onSendMessage: () => void;
}

export const DeveloperCard: React.FC<DeveloperCardProps> = ({
  developer,
  onViewProfile,
  onSendMessage
}) => {
  // Gracefully handle cases where user data might be missing
  if (!developer.user) {
    console.warn('DeveloperCard: Developer object is missing user data for user_id:', developer.user_id);
    console.log('Developer object:', developer);
    // Optionally render a placeholder or return null
    return null;
  }

  console.log('Rendering DeveloperCard for:', developer.user_id, developer.user.name);
  
  // Get display name in format: FirstName (GitHubUsername)
  const displayName = developer.github_handle 
    ? `${developer.user.name.split(' ')[0]} (${developer.github_handle})`
    : developer.user.name;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start space-x-4">
        <div className="relative">
          {developer.profile_pic_url ? (
            <img 
              src={developer.profile_pic_url} 
              alt={developer.user.name}
              className="w-16 h-16 rounded-xl object-cover shadow-lg"
              onError={(e) => {
                // Fallback to initials if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = "w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg";
                  fallback.textContent = developer.user.name.split(' ').map(n => n[0]).join('');
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
              {developer.user.name.split(' ').map(n => n[0]).join('')}
            </div>
          )}
          
          {/* Availability indicator */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
            developer.availability ? 'bg-emerald-500' : 'bg-gray-400'
          }`}>
            <div className="w-full h-full flex items-center justify-center">
              <div className={`w-1.5 h-1.5 rounded-full ${
                developer.availability ? 'bg-white animate-pulse' : 'bg-white'
              }`}></div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-1">
            <h3 className="text-lg font-bold text-gray-900 truncate">{displayName}</h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
              developer.availability 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                developer.availability ? 'bg-emerald-500' : 'bg-gray-500'
              }`}></div>
              {developer.availability ? 'Available' : 'Busy'}
            </span>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center">
              <Briefcase className="w-4 h-4 mr-1" />
              {developer.experience_years} years
            </div>
            {developer.location && (
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {developer.location}
              </div>
            )}
            {developer.github_handle && (
              <div className="flex items-center">
                <Github className="w-4 h-4 mr-1" />
                <a 
                  href={`https://github.com/${developer.github_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{developer.github_handle}
                </a>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {developer.top_languages.slice(0, 5).map((lang, index) => (
              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                {lang}
              </span>
            ))}
            {developer.top_languages.length > 5 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg">
                +{developer.top_languages.length - 5} more
              </span>
            )}
          </div>
          
          {developer.bio && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-4">{developer.bio}</p>
          )}
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onViewProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Snapshot
            </button>
            <button
              onClick={onSendMessage}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};