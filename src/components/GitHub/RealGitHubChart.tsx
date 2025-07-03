import React from 'react';
import { useGitHub } from '../../hooks/useGitHub';
import { useAuth } from '../../hooks/useAuth'; // Import useAuth to check developerProfile
import { Github, Loader, AlertCircle } from 'lucide-react';

export const RealGitHubChart = () => {
  const { gitHubData, loading, error } = useGitHub();
  const { developerProfile } = useAuth(); // Get developerProfile to check for installation ID

  // IMPORTANT: Replace 'gittalentapp' with your actual GitHub App slug!
  // You can find this in your GitHub App settings under "Public page" or "Install App" URL.
  const GITHUB_APP_SLUG = 'gittalentapp'; // <--- YOU MUST CHANGE THIS TO YOUR APP'S SLUG
  const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;

  // Determine if the GitHub App is installed based on developerProfile
  const isGitHubAppInstalled = !!developerProfile?.github_installation_id;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-12 w-12 text-blue-500" />
        <p className="ml-4 text-gray-600">Loading GitHub data...</p>
      </div>
    );
  }

  // Display the "Connect App" message and button if the app is not installed
  if (!isGitHubAppInstalled) {
    return (
      <div className="text-center p-8 bg-white rounded-xl shadow-md">
        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">GitHub App Not Connected</h2>
        <p className="text-gray-600 mb-4">
          To display your real contribution data and unlock full features, please connect the GitHub App.
        </p>
        <a
          href={githubAppInstallUrl}
          target="_blank" // Open in a new tab
          rel="noopener noreferrer"
          className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold shadow-lg"
        >
          <Github className="w-5 h-5 mr-2" />
          Connect GitHub App
        </a>
        {error && <p className="text-red-500 mt-4">{error.message}</p>}
      </div>
    );
  }

  // If we reach here, it means the GitHub App is installed, and we should attempt to display data.
  // The 'weird' chart is due to the fallback data. Once the app is connected, this will improve.
  return (
    <div>
      {/* Your existing chart rendering logic using gitHubData */}
      <h2 className="text-2xl font-bold mb-4">GitHub Contributions for {gitHubData.user?.login || developerProfile?.github_handle || 'User'}</h2>
      {/* Render your contribution chart here */}
      <div className="grid grid-cols-7 gap-1 p-2 bg-gray-100 rounded-lg">
        {gitHubData.contributions.map((day, index) => (
          <div
            key={index}
            className={`w-4 h-4 rounded-sm
              ${day.level === 0 ? 'bg-gray-200' : ''}
              ${day.level === 1 ? 'bg-green-100' : ''}
              ${day.level === 2 ? 'bg-green-300' : ''}
              ${day.level === 3 ? 'bg-green-500' : ''}
              ${day.level === 4 ? 'bg-green-700' : ''}
            `}
            title={`${day.count} contributions on ${day.date}`}
          ></div>
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-4">
        Total Stars: {gitHubData.totalStars} | Repos: {gitHubData.repos.length}
      </p>
    </div>
  );
};