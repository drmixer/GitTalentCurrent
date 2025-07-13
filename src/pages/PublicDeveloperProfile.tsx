import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  DeveloperProfileDetails,
  PortfolioManager, 
  RealGitHubChart 
} from '../components';
import { 
  ArrowLeft, 
  Loader, 
  AlertCircle, 
  User, 
  Code, 
  Briefcase
} from 'lucide-react';
import { Developer, User as UserType } from '../types';

export const PublicDeveloperProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [developer, setDeveloper] = useState<Developer & { user: UserType } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'portfolio' | 'github'>('profile');
  const [gitHubData, setGitHubData] = useState(null);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState(null);

  useEffect(() => {
    if (slug) {
      fetchDeveloperBySlug(slug);
    }
  }, [slug]);

  useEffect(() => {
    const fetchGitHubData = async () => {
      if (developer?.github_handle) {
        setGithubLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('github-proxy', {
            body: {
              handle: developer.github_handle,
              installationId: developer.github_installation_id,
            },
          });

          if (error) {
            throw error;
          }

          setGitHubData(data);
        } catch (error) {
          setGithubError(error as any);
        } finally {
          setGithubLoading(false);
        }
      }
    };

    fetchGitHubData();
  }, [developer]);


  const fetchDeveloperBySlug = async (profileSlug: string) => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('public_profile_slug', profileSlug)
        .single();

      if (error) throw error;
      
      if (!data) {
        setError('Developer profile not found');
        setDeveloper(null);
      } else {
        setDeveloper(data);
      }
    } catch (err: unknown) {
      console.error('Error fetching developer profile by slug:', err);
      setError(err instanceof Error ? err.message : 'Failed to load developer profile');
      setDeveloper(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading developer profile...</p>
        </div>
      </div>
    );
  }

  if (error || !developer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error || "We couldn't find the developer profile you're looking for."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Public Profile Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 mb-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-6 mb-6 md:mb-0">
              {developer.profile_pic_url ? (
                <img 
                  src={developer.profile_pic_url} 
                  alt={developer.user?.name || developer.github_handle}
                  className="w-24 h-24 rounded-2xl object-cover shadow-lg border-4 border-white"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = "w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg border-4 border-white";
                      fallback.textContent = (developer.user?.name || developer.github_handle)?.split(' ').map(n => n[0]).join('');
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg border-4 border-white">
                  {(developer.user?.name || developer.github_handle)?.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-black mb-2">
                  {developer.user?.name || developer.github_handle}
                </h1>
                <div className="flex items-center space-x-4 text-blue-100">
                  <div className="flex items-center">
                    <Code className="w-4 h-4 mr-1" />
                    {developer.skills && developer.skills.length > 0 ? (
                      <>
                        {developer.skills.slice(0, 3).join(', ')}
                        {developer.skills.length > 3 && '...'}
                      </>
                    ) : (
                      'No skills specified'
                    )}
                  </div>
                  {developer.location && (
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      {developer.location}
                    </div>
                  )}
                  <div className="flex items-center">
                    <Briefcase className="w-4 h-4 mr-1" />
                    {developer.experience_years} years experience
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                developer.availability 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  developer.availability ? 'bg-white' : 'bg-gray-500'
                }`}></div>
                {developer.availability ? 'Available for hire' : 'Not available'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-t-2xl shadow-sm border border-gray-100 mb-0">
          <div className="px-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
                { id: 'github', label: 'GitHub Activity', icon: Code },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'profile' | 'portfolio' | 'github')}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`mr-2 h-5 w-5 ${
                      activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
                    }`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 border-t-0 p-6">
          {activeTab === 'profile' && (
            <DeveloperProfileDetails
              developer={developer}
            />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioManager
              developerId={developer.user_id}
              isEditable={false}
            />
          )}
          {activeTab === 'github' && developer.github_handle && (
            <RealGitHubChart
              githubHandle={developer.github_handle}
              gitHubData={gitHubData}
              loading={githubLoading}
              error={githubError}
              className="w-full"
              displayMode="dashboardSnippet"
              isGitHubAppInstalled={!!developer?.github_installation_id}
            />
          )}
        </div>
      </div>
    </div>
  );
};