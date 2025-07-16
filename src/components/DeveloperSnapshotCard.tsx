import React from 'react';
import { 
  User, 
  Github, 
  Linkedin, 
  Mail, 
  MapPin, 
  Star,
  ExternalLink,
  Code,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';
import { Developer } from '@/types';
import { formatDisplayName } from '@/utils/displayName';
import { useDeveloperProfile } from '@/hooks/useDeveloperProfile';
import { useGitHub } from '@/hooks/useGitHub';

interface DeveloperSnapshotCardProps {
  developer: Developer;
  onViewProfile: (developer: Developer) => void;
}

const DeveloperSnapshotCard: React.FC<DeveloperSnapshotCardProps> = ({ 
  developer: initialDeveloper,
  onViewProfile 
}) => {
  const { developer, portfolioItems, loading } = useDeveloperProfile(initialDeveloper?.user_id);
  const { gitHubData, loading: githubLoading, error: githubError } = useGitHub();

  const currentDeveloper = developer || initialDeveloper;
  const githubUser = gitHubData?.user;

  if (!currentDeveloper) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 flex items-center justify-center h-full">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const featuredProject = portfolioItems.find(p => p.featured);

  const displayName = currentDeveloper.user?.name || currentDeveloper.name || 'Unnamed Developer';
  const displayEmail = currentDeveloper.email || '';
  const avatarUrl = currentDeveloper.user?.avatar_url || currentDeveloper.profile_pic_url;

  const getAvailabilityStatus = () => {
    if (currentDeveloper.availability) {
      return { text: 'Available', color: 'text-emerald-600', icon: CheckCircle };
    }
    return { text: 'Unavailable', color: 'text-red-600', icon: XCircle };
  };

  const availabilityStatus = getAvailabilityStatus();
  const AvailabilityIcon = availabilityStatus.icon;

  if (loading && !developer) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 flex items-center justify-center h-full">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1 h-full flex flex-col">
      <div className="flex items-start space-x-4">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-2xl object-cover shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {displayName ? displayName.split(' ').map(n => n[0]).join('') : 'U'}
              </div>
            )}
            
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
              currentDeveloper.availability ? 'bg-emerald-500' : 'bg-gray-400'
            }`}>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-xl font-black text-gray-900">{displayName}</h3>
              <div className={`flex items-center space-x-1 ${availabilityStatus.color}`}>
                <AvailabilityIcon size={16} />
                <span className="text-sm font-medium">{availabilityStatus.text}</span>
              </div>
            </div>
            <p className="text-gray-600">{currentDeveloper.preferred_title}</p>
            
            {currentDeveloper.github_handle && (
              <a
                href={`https://github.com/${currentDeveloper.github_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 transition-colors mt-1"
              >
                <Github size={14} />
                <span>@{currentDeveloper.github_handle}</span>
              </a>
            )}

            {currentDeveloper.location && (
              <div className="flex items-center space-x-1 text-sm text-gray-600 mt-1">
                <MapPin size={14} />
                <span>{currentDeveloper.location}</span>
              </div>
            )}
          </div>
        </div>

      <div className="flex-grow mt-6">
        {currentDeveloper.skills && currentDeveloper.skills.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Code size={16} className="text-blue-600" />
              <h4 className="font-semibold text-gray-900">Skills</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentDeveloper.skills.slice(0, 6).map((skill, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
                >
                  {skill}
                </span>
              ))}
              {currentDeveloper.skills.length > 6 && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  +{currentDeveloper.skills.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {featuredProject && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Star size={16} className="text-yellow-500" />
              <h4 className="font-semibold text-gray-900">Featured Project</h4>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 mb-1">{featuredProject.title}</h5>
                  <p className="text-sm text-gray-600 line-clamp-2">{featuredProject.description}</p>
                  {featuredProject.technologies && featuredProject.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {featuredProject.technologies.slice(0, 3).map((tech, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-white text-gray-600 rounded text-xs border"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {(featuredProject.url || featuredProject.image_url) && (
                  <ExternalLink size={16} className="text-gray-400 ml-2 flex-shrink-0" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-3">
          {currentDeveloper.linkedin_url && (
            <a
              href={currentDeveloper.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
            >
              <Linkedin size={16} className="text-blue-600" />
            </a>
          )}
          {displayEmail && (
            <a 
              href={`mailto:${displayEmail}`}
              className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
            >
              <Mail size={16} className="text-green-600" />
            </a>
          )}
        </div>
        
        <button
          onClick={() => onViewProfile(currentDeveloper, gitHubData, githubLoading, githubError)}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          View Profile
        </button>
      </div>
    </div>
  );
};

export default DeveloperSnapshotCard;