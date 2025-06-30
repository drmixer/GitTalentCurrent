import React from 'react';
import { 
  User, 
  Github, 
  MapPin, 
  Briefcase, 
  Code, 
  Eye, 
  ArrowRight,
  ExternalLink,
  Star
} from 'lucide-react';
import { Developer, User as UserType, PortfolioItem } from '../../types';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

interface DeveloperSnapshotCardProps {
  developer: Developer & { user: UserType };
  onViewFullProfile: () => void;
  className?: string;
}

export const DeveloperSnapshotCard: React.FC<DeveloperSnapshotCardProps> = ({
  developer,
  onViewFullProfile,
  className = ''
}) => {
  console.log('Rendering DeveloperSnapshotCard for:', developer.user_id, developer.user.name);
  console.log('Developer data in snapshot card:', { 
    githubHandle: developer.github_handle || 'none',
    bio: developer.bio?.substring(0, 20) + '...' || 'none',
    languages: developer.top_languages?.length || 0,
    availability: developer.availability
  });

  console.log('Rendering DeveloperSnapshotCard for:', developer.user_id, developer.user.name);
  console.log('Developer data in snapshot card:', { 
    githubHandle: developer.github_handle || 'none',
    bio: developer.bio?.substring(0, 20) + '...' || 'none',
    languages: developer.top_languages?.length || 0,
    availability: developer.availability
  });

  const [featuredPortfolioItem, setFeaturedPortfolioItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Fetching portfolio items for developer:', developer.user_id);
    console.log('Fetching portfolio items for developer:', developer.user_id);
    fetchFeaturedPortfolioItem();
  }, [developer.user_id]);

  const fetchFeaturedPortfolioItem = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('developer_id', developer.user_id)
        .eq('featured', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setFeaturedPortfolioItem(data);
      } else {
        // If no featured item, get the most recent one
        const { data: recentData, error: recentError } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('developer_id', developer.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (recentError) throw recentError;
        setFeaturedPortfolioItem(recentData);
      }
    } catch (error) {
      console.error('Error fetching featured portfolio item:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get display name in format: FirstName (GitHubUsername)
  const displayName = developer.github_handle 
    ? `${developer.user.name.split(' ')[0]} (${developer.github_handle})`
    : developer.user.name;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {developer.user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-xl font-black text-gray-900">{displayName}</h3>
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
            <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      </div>

      {/* GitHub Activity Snapshot */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-900">GitHub Activity</h4>
          {developer.github_handle ? (
            <a 
              href={`https://github.com/${developer.github_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              View on GitHub
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          ) : (
            <span className="text-xs text-gray-500">
              No GitHub handle
            </span>
          ) : (
            <span className="text-xs text-gray-500">
              No GitHub handle
            </span>
          )}
        </div>
        
        {developer.github_handle ? (
          <div className="grid grid-cols-7 gap-1 mb-2">
            {/* Simplified contribution graph - just for visual representation */}
            {Array.from({ length: 49 }, (_, i) => {
              const intensity = Math.random();
              let bgColor = 'bg-gray-100';
              if (intensity > 0.8) bgColor = 'bg-emerald-600';
              else if (intensity > 0.6) bgColor = 'bg-emerald-500';
              else if (intensity > 0.4) bgColor = 'bg-emerald-400';
              else if (intensity > 0.2) bgColor = 'bg-emerald-300';
              else if (intensity > 0.1) bgColor = 'bg-emerald-200';
              
              return (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm ${bgColor}`}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-gray-500">GitHub not connected</p>
          </div>
        )}
      </div>

      {/* Featured Portfolio Item */}
      {featuredPortfolioItem && (
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-900">Featured Project</h4>
            {featuredPortfolioItem.featured && (
              <span className="flex items-center text-xs text-yellow-600 font-medium">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </span>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <h5 className="font-bold text-gray-900">{featuredPortfolioItem.title}</h5>
              {featuredPortfolioItem.url && (
                <a 
                  href={featuredPortfolioItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            
            {featuredPortfolioItem.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {featuredPortfolioItem.description}
              </p>
            )}
            
            <div className="flex flex-wrap gap-1">
              {featuredPortfolioItem.technologies.slice(0, 3).map((tech, index) => (
                <span key={index} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                  {tech}
                </span>
              ))}
              {featuredPortfolioItem.technologies.length > 3 && (
                <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                  +{featuredPortfolioItem.technologies.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bio Preview */}
      {developer.bio && (
        <div className="p-6 border-b border-gray-100">
          <h4 className="text-sm font-bold text-gray-900 mb-2">About</h4>
          <p className="text-sm text-gray-600 line-clamp-3">
            {developer.bio}
          </p>
        </div>
      )}

      {/* View Full Profile Button */}
      <div className="p-6">
        <button
          onClick={onViewFullProfile}
          className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Full Profile
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};