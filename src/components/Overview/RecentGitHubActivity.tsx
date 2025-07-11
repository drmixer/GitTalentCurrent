import React from 'react';
import { GitCommit, ExternalLink } from 'lucide-react'; // Assuming use of Lucide icons

// Define a simple type for a commit for now. This should ideally come from your GitHub data types.
interface Commit {
  sha: string;
  message: string;
  repoName: string;
  date: string;
  url: string;
}

interface RecentGitHubActivityProps {
  commits?: Commit[]; // Make commits optional for loading/error states
  loading?: boolean;
  error?: string | null;
  githubProfileUrl?: string;
}

export const RecentGitHubActivity: React.FC<RecentGitHubActivityProps> = ({
  commits,
  loading,
  error,
  githubProfileUrl
}) => {
  const displayCommits = commits?.slice(0, 3) || [];

  return (
    <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-800">Recent GitHub Activity</h3>
        {githubProfileUrl && (
          <a
            href={githubProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center"
          >
            View All Activity <ExternalLink size={14} className="ml-1" />
          </a>
        )}
      </div>

      {loading && <p className="text-gray-500">Loading activity...</p>}
      {error && <p className="text-red-500">Error loading activity: {error}</p>}

      {!loading && !error && displayCommits.length === 0 && (
        <p className="text-gray-500">No recent commit activity to display.</p>
      )}

      {!loading && !error && displayCommits.length > 0 && (
        <ul className="space-y-3">
          {displayCommits.map((commit) => (
            <li key={commit.sha} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-start space-x-3">
                <GitCommit size={18} className="text-gray-400 mt-1 flex-shrink-0" />
                <div>
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 hover:underline block truncate"
                    title={commit.message}
                  >
                    {commit.message.length > 80 ? `${commit.message.substring(0, 80)}...` : commit.message}
                  </a>
                  <p className="text-xs text-gray-500">
                    Committed to <span className="font-medium">{commit.repoName}</span> on {new Date(commit.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
