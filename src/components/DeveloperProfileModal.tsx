// src/components/DeveloperProfileModal.tsx

import React, { useState, useEffect } from 'react';
import { Developer } from '../types';
import { X, Github, Mail, MapPin, Loader } from 'lucide-react';
import { GitHubUserActivityDetails } from './GitHub/GitHubUserActivityDetails';
import { useDeveloperProfile } from '@/hooks/useDeveloperProfile';
import { useGitHub } from '@/hooks/useGitHub';
import { PortfolioManager } from './Portfolio/PortfolioManager';
import { RealGitHubChart } from './GitHub/RealGitHubChart';
import EndorsementDisplay from './EndorsementDisplay'; // CORRECTED: Imported as default
// CORRECTED: Changed to default import
import fetchEndorsementsForDeveloper from '../lib/endorsementUtils';
import { Endorsement } from '../types';

interface DeveloperProfileModalProps {
  developer: Developer;
  onClose: () => void;
}

export const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({ developer: initialDeveloper, onClose }) => {
  const { developer, loading, error } = useDeveloperProfile(initialDeveloper.user_id);
  const { gitHubData, loading: githubLoading, error: githubError } = useGitHub(developer || initialDeveloper);

  const currentDeveloper = developer || initialDeveloper;
  const displayName = currentDeveloper.user?.name || currentDeveloper.name || 'Unnamed Developer';
  const avatarUrl = currentDeveloper.user?.avatar_pic_url || currentDeveloper.profile_pic_url; // Corrected: changed avatar_url to avatar_pic_url

  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(true);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);

  useEffect(() => {
    const loadEndorsements = async () => {
      if (currentDeveloper?.user_id) {
        setIsLoadingEndorsements(true);
        setEndorsementError(null);
        try {
          const fetchedEndorsements = await fetchEndorsementsForDeveloper(currentDeveloper.user_id, true); // Fetch only PUBLIC endorsements
          if (fetchedEndorsements) {
            setEndorsements(fetchedEndorsements);
          } else {
            setEndorsementError("Failed to load endorsements.");
          }
        } catch (err) {
          console.error("Error fetching endorsements in recruiter view:", err);
          setEndorsementError("An unexpected error occurred while loading endorsements.");
        } finally {
          setIsLoadingEndorsements(false);
        }
      }
    };

    loadEndorsements();
  }, [currentDeveloper?.user_id]);

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
            <img src={avatarUrl || '/path/to/default/avatar.png'} alt={displayName} className="w-24 h-24 rounded-full shadow-lg object-cover" />
            <div>
              <h3 className="text-2xl font-bold">{displayName}</h3>
              <p className="text-gray-600 text-lg">{currentDeveloper.title}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                {currentDeveloper.github_handle && (
                  <a href={`https://github.com/${currentDeveloper.github_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-600">
                    <Github size={16} className="mr-1" />{currentDeveloper.github_handle}
                  </a>
                )}
                {currentDeveloper.user?.email && <span className="flex items-center"><Mail size={16} className="mr-1" />{currentDeveloper.user.email}</span>}
                {currentDeveloper.location && <span className="flex items-center"><MapPin size={16} className="mr-1" />{currentDeveloper.location}</span>}
              </div>
            </div>
          </div>

          {currentDeveloper.bio && (
            <div className="mt-8">
              <h4 className="font-bold text-lg mb-3">Bio</h4>
              <p className="text-gray-700">{currentDeveloper.bio}</p>
            </div>
          )}

          {currentDeveloper.skills?.length > 0 && (
            <div className="mt-8">
              <h4 className="font-bold text-lg mb-3">Tech Skills</h4>
              <div className="flex flex-wrap gap-2">
                {currentDeveloper.skills.map(skill => (
                  <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">{skill}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <PortfolioManager
              developerId={currentDeveloper.user_id}
              isEditable={false}
            />
          </div>

          <div className="mt-8">
            <h4 className="font-bold text-lg mb-3">Endorsements</h4>
            <EndorsementDisplay
              endorsements={endorsements}
              isLoading={isLoadingEndorsements}
              error={endorsementError}
              canManageVisibility={false}
            />
          </div>

          <div className="mt-8">
            <h4 className="font-bold text-lg mb-3">GitHub Activity</h4>
            <div className="flex flex-col lg:flex-row gap-6">
              {githubLoading ? (
                <div className="flex items-center justify-center h-48 w-full">
                  <Loader className="animate-spin h-8 w-8 text-blue-600" />
                </div>
              ) : currentDeveloper.github_handle ? (
                <>
                  <div className="lg:w-2/5 flex-shrink-0">
                    <div className="max-w-md mx-auto lg:mx-0 bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                      <RealGitHubChart
                        githubHandle={currentDeveloper.github_handle}
                        gitHubData={gitHubData}
                        loading={githubLoading}
                        error={githubError}
                        isGitHubAppInstalled={!!currentDeveloper.github_installation_id}
                        className="w-full"
                        displayMode="dashboardSnippet"
                      />
                    </div>
                  </div>
                  <div className="lg:w-3/5 flex-grow bg-white p-4 sm:p-6 rounded-lg shadow-md border">
                    <GitHubUserActivityDetails gitHubData={gitHubData} />
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 w-full p-8 border rounded-lg bg-gray-50">
                  <Github className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p>No GitHub handle provided by this developer.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
