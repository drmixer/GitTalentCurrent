import React from 'react';
import { Developer } from '../types';
import { X, Github, Mail, MapPin, Loader } from 'lucide-react';
import { GitHubUserActivityDetails } from './GitHub/GitHubUserActivityDetails';
import { useDeveloperProfile } from '@/hooks/useDeveloperProfile';
import { useGitHub } from '@/hooks/useGitHub';
import { PortfolioManager } from './Portfolio/PortfolioManager';

interface DeveloperProfileModalProps {
  developer: Developer;
  onClose: () => void;
}

export const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({ developer: initialDeveloper, onClose }) => {
  const { developer, loading, error } = useDeveloperProfile(initialDeveloper.user_id);
  const { gitHubData, loading: githubLoading } = useGitHub();

  const currentDeveloper = developer || initialDeveloper;

  if (loading && !developer) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-96 flex items-center justify-center">
          <Loader className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold">Developer Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
        </div>
        <div className="p-6">
          <div className="flex items-start space-x-6">
            <img src={currentDeveloper.avatar_url || ''} alt={currentDeveloper.name || ''} className="w-24 h-24 rounded-full shadow-lg" />
            <div>
              <h3 className="text-2xl font-bold">{currentDeveloper.name || 'Unnamed Developer'}</h3>
              <p className="text-gray-600 text-lg">{currentDeveloper.preferred_title}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                {currentDeveloper.github_username && (
                  <a href={`https://github.com/${currentDeveloper.github_username}`} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-600">
                    <Github size={16} className="mr-1" />{currentDeveloper.github_username}
                  </a>
                )}
                {currentDeveloper.email && <span className="flex items-center"><Mail size={16} className="mr-1" />{currentDeveloper.email}</span>}
                {currentDeveloper.location && <span className="flex items-center"><MapPin size={16} className="mr-1" />{currentDeveloper.location}</span>}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="font-bold text-lg mb-3">Tech Skills</h4>
            <div className="flex flex-wrap gap-2">
              {currentDeveloper.skills?.map(skill => (
                <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">{skill}</span>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <PortfolioManager
              developerId={currentDeveloper.user_id}
              isEditable={false}
            />
          </div>

          <div className="mt-8">
            <h4 className="font-bold text-lg mb-3">GitHub Activity</h4>
            <div className="border rounded-lg p-4">
              {githubLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader className="animate-spin h-8 w-8 text-blue-600" />
                </div>
              ) : (
                <GitHubUserActivityDetails gitHubData={gitHubData} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
