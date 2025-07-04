import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, XCircle } from 'lucide-react';

interface GitHubConnectPromptProps {
  onClose: () => void;
}

export const GitHubConnectPrompt: React.FC<GitHubConnectPromptProps> = ({ onClose }) => {
  const navigate = useNavigate();

  const handleGoToGitHubActivity = () => {
    // Navigate to GitHub setup page
    navigate('/github-setup', { replace: true });
    onClose(); // Close the prompt after navigating
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <XCircle className="w-6 h-6" />
        </button>
        <div className="flex justify-center mb-6">
          <Github className="w-12 h-12 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
          Welcome to GitTalent!
        </h2>
        <p className="text-gray-700 text-center mb-6">
          To unlock your personalized GitHub activity chart and showcase your contributions, you need to connect the GitHub App.
        </p>
        <div className="flex justify-center">
          <button
            onClick={handleGoToGitHubActivity}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg"
          >
            Connect GitHub App
          </button>
        </div>
      </div>
    </div>
  );
};