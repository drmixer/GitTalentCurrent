import React, { useState, useEffect } from 'react';
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
import { Developer, User as UserType, PortfolioItem } from '../../types';
import { supabase } from '../../lib/supabase';

interface DeveloperSnapshotCardProps {
  developer: Developer;
  onViewProfile: (developer: Developer) => void;
}

const DeveloperSnapshotCard: React.FC<DeveloperSnapshotCardProps> = ({ 
  developer, 
  onViewProfile 
}) => {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPortfolioItems = async () => {
      try {
        const { data, error } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('developer_id', developer.id)
          .limit(3);

        if (error) throw error;
        setPortfolioItems(data || []);
      } catch (error) {
        console.error('Error fetching portfolio items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioItems();
  }, [developer.id]);

  const displayName = developer.user?.name || 'Unknown Developer';
  const displayEmail = developer.user?.email || '';

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
            {developer.profile_pic_url ? (
              <img 
                src={developer.profile_pic_url} 
                alt={developer.user.name}
                className="w-16 h-16 rounded-2xl object-cover shadow-lg"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = "w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg";
                    fallback.textContent = developer.user.name.split(' ').map(n => n[0]).join('');
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
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
              <div className="flex items-center space-x-1">
                <DollarSign size={14} />
                <span className="font-medium">{formatRate(developer.hourly_rate)}</span>
              </div>
            </div>

            {developer.bio && (
              <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-2">
                {developer.bio}
              </p>
            )}
          </div>
        </div>

      {/* Skills */}
      {developer.skills && developer.skills.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Code size={16} className="text-blue-600" />
            <h4 className="font-semibold text-gray-900">Skills</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {developer.skills.slice(0, 6).map((skill, index) => (
              <span 
                key={index}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
              >
                {skill}
              </span>
            ))}
            {developer.skills.length > 6 && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                +{developer.skills.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

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
          {developer.github_url && (
            <a 
              href={developer.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Github size={16} className="text-gray-600" />
            </a>
          )}
          {developer.linkedin_url && (
            <a 
              href={developer.linkedin_url}
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