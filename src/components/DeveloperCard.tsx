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
import { Developer } from '../types';
import { formatDisplayName } from '@/utils/displayName';

interface DeveloperCardProps {
  developer: Developer;
  onViewProfile: (developer: Developer) => void;
  onSendMessage: () => void;
}

import { Loader } from 'lucide-react';

export const DeveloperCard: React.FC<DeveloperCardProps> = ({
  developer,
  onViewProfile,
  onSendMessage
}) => {
  if (!developer) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-center">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const displayName = developer.user?.name || developer.name || 'Unnamed Developer';
  const userInitial = displayName.split(' ').map(n => n[0]).join('');
  const avatarUrl = developer.user?.avatar_url || developer.avatar_url;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start space-x-4">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-xl object-cover shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
              {userInitial}
            </div>
          )}
          
          {/* Availability indicator */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
            developer.availability ? 'bg-emerald-500' : 'bg-gray-400'
          }`}>
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
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onViewProfile(developer)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center w-full justify-center"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Snapshot
            </button>
            <button
              onClick={onSendMessage}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center w-full justify-center"
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