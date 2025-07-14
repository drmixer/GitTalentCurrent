import React from 'react';
import { 
  User, 
  Github, 
  Linkedin, 
  Mail, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Star,
  ExternalLink,
  Code,
  Briefcase,
  Award,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Developer, PortfolioItem } from '@/types';
import { formatDisplayName } from '@/utils/displayName';
import { useDeveloperProfile } from '@/hooks/useDeveloperProfile';

interface DeveloperSnapshotCardProps {
  developer: Developer;
  onViewProfile: (developer: Developer) => void;
}

const DeveloperSnapshotCard: React.FC<DeveloperSnapshotCardProps> = ({ 
  developer, 
  onViewProfile 
}) => {
  const { portfolioItems, loading } = useDeveloperProfile(developer.user_id);
  const displayName = formatDisplayName(developer.user, developer);
  const displayEmail = developer.email || '';

  const formatRate = (rate: number | null) => {
    if (!rate) return 'Rate not specified';
    return `$${rate}/hour`;
  };

  const getAvailabilityStatus = () => {
    if (developer.availability) {
      return { text: 'Available', color: 'text-emerald-600', icon: CheckCircle };
    }
    return { text: 'Unavailable', color: 'text-red-600', icon: XCircle };
  };

  const availabilityStatus = getAvailabilityStatus();
  const AvailabilityIcon = availabilityStatus.icon;

  return (
    <div className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1">
      <div className="flex items-start space-x-4">
          <div className="relative">
            {developer.user?.avatar_url ? (
              <img 
                src={developer.user.avatar_url}
                alt={developer.user?.name || ''}
                className="w-16 h-16 rounded-2xl object-cover shadow-lg"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = "w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg";
                    fallback.textContent = (developer.user?.name || 'U').split(' ').map(n => n[0]).join('');
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {(developer.user?.name || 'U').split(' ').map(n => n[0]).join('')}
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
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-xl font-black text-gray-900">{displayName}</h3>
              <div className={`flex items-center space-x-1 ${availabilityStatus.color}`}>
                <AvailabilityIcon size={16} />
                <span className="text-sm font-medium">{availabilityStatus.text}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
              {developer.location && (
                <div className="flex items-center space-x-1">
                  <MapPin size={14} />
                  <span>{developer.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Portfolio Preview */}
      {portfolioItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Briefcase size={16} className="text-purple-600" />
            <h4 className="font-semibold text-gray-900">Recent Work</h4>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {portfolioItems.slice(0, 2).map((item) => (
              <div key={item.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 mb-1">{item.title}</h5>
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                    {item.technologies && item.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.technologies.slice(0, 3).map((tech, index) => (
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
                  {(item.project_url || item.github_url) && (
                    <ExternalLink size={16} className="text-gray-400 ml-2 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Links */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-3">
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
          onClick={() => onViewProfile(developer)}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          View Profile
        </button>
      </div>
    </div>
  );
};

export default DeveloperSnapshotCard;