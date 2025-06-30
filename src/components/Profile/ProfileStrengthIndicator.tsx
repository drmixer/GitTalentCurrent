import React from 'react';
import { CheckCircle, Circle, TrendingUp } from 'lucide-react';

interface ProfileStrengthIndicatorProps {
  strength: number;
  suggestions?: string[];
  className?: string;
}

export const ProfileStrengthIndicator: React.FC<ProfileStrengthIndicatorProps> = ({
  strength,
  suggestions = [],
  className = ''
}) => {
  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return 'text-emerald-600';
    if (strength >= 60) return 'text-blue-600';
    if (strength >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStrengthBgColor = (strength: number) => {
    if (strength >= 80) return 'bg-emerald-600';
    if (strength >= 60) return 'bg-blue-600';
    if (strength >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getStrengthLabel = (strength: number) => {
    if (strength >= 80) return 'Excellent';
    if (strength >= 60) return 'Good';
    if (strength >= 40) return 'Fair';
    return 'Needs Work';
  };

  // Filter suggestions to show only the most relevant ones
  const filteredSuggestions = suggestions.slice(0, 5);

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">Profile Strength</h3>
            <p className="text-sm text-gray-600">Complete your profile to attract more opportunities</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black ${getStrengthColor(strength)}`}>
            {strength}%
          </div>
          <div className={`text-sm font-semibold ${getStrengthColor(strength)}`}>
            {getStrengthLabel(strength)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getStrengthBgColor(strength)}`}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>

      {/* Suggestions */}
      {filteredSuggestions.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-900 mb-3 text-sm">Ways to improve:</h4>
          <div className="space-y-2">
            {filteredSuggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start space-x-3">
                <Circle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-600">{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {strength === 100 && (
        <div className="flex items-center space-x-2 p-3 bg-emerald-50 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">
            Perfect! Your profile is complete and optimized.
          </span>
        </div>
      )}
    </div>
  );
};