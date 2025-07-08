import React from 'react';
import { useGitHub } from '../../hooks/useGitHub';
import { useAuth } from '../../hooks/useAuth';
import { Github, Loader, AlertCircle, Star, GitFork } from 'lucide-react';
import { 
  getContributionColorClass, 
  getContributionTooltipText, 
  calculateLanguagePercentage, 
  getLanguageColorClass 
} from '../../utils/githubUtils';

interface RealGitHubChartProps {
  githubHandle: string;
  className?: string;
  displayMode?: 'full' | 'dashboardSnippet';
}

export const RealGitHubChart: React.FC<RealGitHubChartProps> = ({
  githubHandle,
  className = '',
  displayMode = 'full'
}) => {
  const { gitHubData, loading, error } = useGitHub();
  const { developerProfile } = useAuth();

  const GITHUB_APP_SLUG = 'GitTalentApp'; // IMPORTANT: Must match your GitHub App slug exactly
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

  const isDashboardSnippet = displayMode === 'dashboardSnippet';
  const contributionsToDisplay = isDashboardSnippet
    ? gitHubData.contributions.slice(-84) // Last 12 weeks (12 * 7 = 84 days)
    : gitHubData.contributions;

  const totalContributionsForDisplay = contributionsToDisplay.reduce((sum, day) => sum + day.count, 0);

  // If we have data, render the GitHub contribution chart
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3 mb-4">
          {isDashboardSnippet ? (
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Github className="w-8 h-8 text-white" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <Github className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <h3 className={`font-black text-gray-900 ${isDashboardSnippet ? 'text-xl' : 'text-xl'}`}>
              {isDashboardSnippet && gitHubData.user?.name ? gitHubData.user.name : 'GitHub Activity'}
            </h3>
            <div className="flex items-center text-sm text-gray-600">
              <a 
                href={`https://github.com/${githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-blue-600 transition-colors"
              >
                @{githubHandle}
                {!isDashboardSnippet && <span className="ml-1 text-xs">↗</span>}
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
            {isDashboardSnippet ? 'Recent Activity' : 'Last 12 months'}
          </span>
        </div>
      </div>

      {/* Contribution Graph */}
      <div className="mb-6">
        <div className={`grid ${isDashboardSnippet ? 'grid-cols-12' : 'grid-cols-53'} gap-1 mb-3`}>
          {contributionsToDisplay.map((day, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-sm ${getContributionColorClass(day.level)} hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all duration-200 hover:scale-110`}
              title={getContributionTooltipText(day)}
            />
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-medium">Less</span>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 bg-gray-100 rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-emerald-200 rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-emerald-300 rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-emerald-600 rounded-sm"></div>
          </div>
          <span className="font-medium">More</span>
        </div>
      </div>

      {/* Stats */}
      {isDashboardSnippet ? (
        <div className="grid grid-cols-3 gap-4 mb-6 text-center">
           <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
            <div className="text-2xl font-black text-gray-900">{gitHubData.repos.length}</div>
            <div className="text-xs font-semibold text-gray-600">Repositories</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
            <div className="text-2xl font-black text-gray-900">{totalContributionsForDisplay}</div>
            <div className="text-xs font-semibold text-gray-600">Contributions</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-3 border border-yellow-100">
             <div className="flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-500 mr-1" />
                <div className="text-2xl font-black text-gray-900">{gitHubData.totalStars}</div>
              </div>
            <div className="text-xs font-semibold text-gray-600">Stars Earned</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="text-xl font-black text-gray-900 mb-1">{totalContributionsForDisplay}</div> {/* Use total from full data */}
            <div className="text-xs font-semibold text-gray-600">Total Contributions</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
            <div className="text-xl font-black text-gray-900 mb-1">{gitHubData.currentStreak || 0}</div>
            <div className="text-xs font-semibold text-gray-600">Current Streak</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="text-xl font-black text-gray-900 mb-1">{gitHubData.longestStreak || 0}</div>
            <div className="text-xs font-semibold text-gray-600">Longest Streak</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100">
            <div className="text-xl font-black text-gray-900 mb-1">{gitHubData.averageContributions || 0}</div>
            <div className="text-xs font-semibold text-gray-600">Avg per Day</div>
          </div>
        </div>
      )}

      {/* Repository Stats - only shown in full mode */}
      {displayMode === 'full' && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-900">Top Repositories</h4>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center">
                <Star className="w-3 h-3 mr-1 text-yellow-500" />
                <span className="font-medium">{gitHubData.totalStars} stars</span>
              </div>
              <div className="flex items-center">
                <GitFork className="w-3 h-3 mr-1" />
                <span className="font-medium">{gitHubData.repos.length} repos</span>
              </div>
            </div>
          </div>

          {gitHubData.repos && gitHubData.repos.length > 0 ? (
            <div className="space-y-3">
              {gitHubData.repos.slice(0, 3).map((repo, index) => (
                <a
                  key={index}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-blue-600">{repo.name}</div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Star className="w-3 h-3 mr-1 text-yellow-500" />
                      <span>{repo.stargazers_count}</span>
                    </div>
                  </div>
                  {repo.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-1">{repo.description}</p>
                  )}
                  {repo.language && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {repo.language}
                      </span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No repositories found</p>
          )}
        </div>
      )}

      {/* Language Stats - Shown in both modes */}
      {(gitHubData.languages && Object.keys(gitHubData.languages).length > 0) && (
         <div className="mt-6 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-bold text-gray-900 mb-4">Top Languages</h4>
          <div className="space-y-3">
            {Object.entries(gitHubData.languages || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 4)
              .map(([language], index) => {
                const percentage = calculateLanguagePercentage(gitHubData.languages, language);
                return (
                  <div key={index} className="flex items-center text-sm">
                    <div className={`w-3 h-3 ${getLanguageColorClass(index)} rounded-full mr-3`}></div>
                    <span className="text-gray-700 flex-1 font-medium">{language}</span>
                    <span className="text-gray-900 font-bold">{percentage}%</span>
                  </div>
                );
              })}
          </div>

          {/* Language Progress Bar */}
          <div className="flex mt-4 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            {Object.entries(gitHubData.languages || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 4)
              .map(([language], index) => {
                const percentage = calculateLanguagePercentage(gitHubData.languages, language);
                return (
                  <div
                    key={index}
                    className={getLanguageColorClass(index)}
                    style={{ width: `${percentage}%` }}
                  ></div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};