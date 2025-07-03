import React from 'react';
import { useGitHub } from '../../hooks/useGitHub'; // Corrected path by Bolt
import { useAuth } from '../../hooks/useAuth'; // Corrected path by Bolt
import { Github, Loader, AlertCircle } from 'lucide-react';

export const RealGitHubChart = () => {
  const { gitHubData, loading, error } = useGitHub();
  const { developerProfile } = useAuth();

  const GITHUB_APP_SLUG = 'gittalentapp'; // IMPORTANT: Confirm this is your actual GitHub App slug
  const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;

  const isGitHubAppInstalled = !!developerProfile?.github_installation_id;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-12 w-12 text-blue-500" />
        <p className="ml-4 text-gray-600">Loading GitHub data...</p>
      </div>
    );
  }

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
          target="_blank"
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

  // --- Chart Rendering Logic ---
  return (
    <div className="p-4"> {/* Add padding around the entire chart section */}
      <h2 className="text-2xl font-bold mb-4 text-gray-800">GitHub Contributions for {gitHubData.user?.login || developerProfile?.github_handle || 'User'}</h2>

      {/* NEW: Wrapper for the chart grid to control its width and centering */}
      <div className="w-full max-w-lg mx-auto bg-gray-100 rounded-lg p-3 shadow-inner">
        <div className="grid grid-flow-col-dense auto-cols-min gap-0.5"> {/* Adjusted gap and flow */}
          {/* Generate 53 columns for 53 weeks in a year (approx) */}
          {Array.from({ length: 53 }).map((_, weekIndex) => (
            <div key={`week-${weekIndex}`} className="flex flex-col gap-0.5">
              {/* Generate 7 rows for 7 days in a week */}
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                // Calculate the actual index in the contributions array
                const contributionDayIndex = (weekIndex * 7) + dayIndex;
                const day = gitHubData.contributions[contributionDayIndex];

                // Default to a gray square if no data or data is missing
                const levelClass = day
                  ? `bg-green-${day.level === 0 ? '200' : day.level === 1 ? '300' : day.level === 2 ? '500' : day.level === 3 ? '700' : '900'}`
                  : 'bg-gray-200'; // Fallback for missing data

                const titleText = day ? `${day.count} contributions on ${day.date}` : 'No contributions';

                return (
                  <div
                    key={`day-${weekIndex}-${dayIndex}`}
                    className={`w-4 h-4 rounded-sm ${levelClass}`}
                    title={titleText}
                  ></div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600 text-center">
        <p>Total Stars: {gitHubData.totalStars} | Repos: {gitHubData.repos.length}</p>
      </div>
    </div>
  );
};
