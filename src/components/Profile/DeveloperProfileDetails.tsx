import { formatDisplayName } from '@/utils/displayName';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { RealGitHubChart } from '../GitHub/RealGitHubChart';
import { GitHubUserActivityDetails } from '../GitHub/GitHubUserActivityDetails';
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
  Link as LinkIcon,
  MessageSquare,
  Share2
} from 'lucide-react';
import { Developer, User as UserType, PortfolioItem } from '../../types'; // Added PortfolioItem import here

interface DeveloperProfileDetailsProps {
  developerId: string;
}

export const DeveloperProfileDetails: React.FC<DeveloperProfileDetailsProps> = ({
  developerId,
}) => {
  const { userProfile } = useAuth();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  // Moved outside useEffect to be accessible for featuredProject state management
  const [featuredProject, setFeaturedProject] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    if (developerId) {
      fetchDeveloperProfile();
    }
  }, [developerId]);


  const fetchDeveloperProfile = async () => {
    try {
      setLoading(true);
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
        setError(fetchError.message || 'Failed to load developer profile');
        setDeveloper(null);
      } else {
        setDeveloper(data as Developer); // Cast data to Developer type
        // Fetch portfolio items and find the featured one
        const { data: portfolioItems, error: portfolioError } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('developer_id', developerId);

        if (portfolioError) {
          console.error('Error fetching portfolio items:', portfolioError);
        } else {
          const featured = portfolioItems.find(item => item.featured);
          setFeaturedProject(featured || null);
        }
      }

    } catch (err: any) { // Explicitly type err as any
      setError('Unexpected error loading developer profile');
      setDeveloper(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = () => {
    // Navigate to GitHub setup page instead of direct GitHub App URL
    window.location.href = '/github-setup';
  };

  // Generate profile strength suggestions based on missing data
  const generateProfileSuggestions = (): string[] => {
    const suggestions: string[] = [];

    if (!developer) return suggestions;

    if (!developer.github_handle) {
      suggestions.push('Add your GitHub handle to showcase your coding activity');
    }

    if (!developer.github_installation_id) {
      suggestions.push('Connect your GitHub account to display real-time contribution data');
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
        </div>
      </div>
    );
  }

  const displayName = formatDisplayName(developer?.user, developer);
  // UPDATED: More comprehensive fallback for avatarUrl
  const avatarUrl = developer?.user?.avatar_url
    || developer?.user?.profile_pic_url
    || developer?.profile_pic_url
    || developer?.avatar_url;

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'github', label: 'GitHub Activity' },
  ];

  const isOwnProfile = userProfile?.id === developer.user_id;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-5xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-24 h-24 rounded-full" />
        ) : (
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-3xl">
            {displayName ? displayName.split(' ').map(n => n[0]).join('') : 'U'}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold">{displayName}</h2>
          <p className="text-gray-600">{developer.preferred_title}</p>
        </div>
      </div>
      <div className="space-y-8">
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
              {developer.skills_categories && Object.keys(developer.skills_categories).length > 0 ? (
                Object.entries(developer.skills_categories).map(([category, skills]) => (
                  <div key={category} className="mb-4">
                    <h5 className="font-semibold text-gray-800 mb-2">{category}</h5>
                    <div className="flex flex-wrap gap-2">
                      {(skills as string[]).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No skills specified</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-900 mb-4">Featured Project</h3>
          {featuredProject ? (
            <div>
              {featuredProject.image_url && (
                <img
                  src={featuredProject.image_url}
                  alt={featuredProject.title}
                  className="w-full h-auto rounded-lg mb-4"
                />
              )}
              <h4 className="font-bold text-gray-900">{featuredProject.title}</h4>
              <p className="text-gray-600 my-2">{featuredProject.description}</p>
              <a href={featuredProject.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                View Project
              </a>
            </div>
          ) : (
            <p className="text-gray-500">No featured project provided.</p>
          )}
        </div>
      </div>
    </div>
  );
};
