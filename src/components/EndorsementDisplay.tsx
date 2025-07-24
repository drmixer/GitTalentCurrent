// src/components/EndorsementDisplay.tsx

import React from 'react';
import { Endorsement } from '../types'; // Assuming '../types' resolves to types/index.ts due to module resolution
import { Award, Loader, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom'; // Import Link for user profiles

interface EndorsementDisplayProps {
  endorsements: Endorsement[];
  isLoading: boolean;
  error: string | null;
  canManageVisibility: boolean; // Indicates if the user can manage visibility
  onToggleVisibility?: (endorsementId: string, isPublic: boolean) => void;
}

const EndorsementDisplay: React.FC<EndorsementDisplayProps> = ({
  endorsements,
  isLoading,
  error,
  canManageVisibility,
  onToggleVisibility,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="animate-spin h-8 w-8 text-blue-500 mr-3" />
        <p className="text-gray-600">Loading endorsements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-600 bg-red-50 rounded-lg border border-red-200">
        <AlertCircle className="h-10 w-10 mx-auto mb-4" />
        <p className="font-semibold">Error loading endorsements:</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (endorsements.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <Award className="h-10 w-10 mx-auto mb-4" />
        <p className="font-semibold">No public endorsements yet.</p>
        {!canManageVisibility && (
          <p className="text-sm mt-2">This developer hasn't received any public endorsements.</p>
        )}
        {canManageVisibility && (
          <p className="text-sm mt-2">Share your profile to receive endorsements!</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {endorsements.map((endorsement) => (
        // Added bolder styling to the card container: stronger shadow, more defined border
        <div
          key={endorsement.id}
          className="bg-white p-6 rounded-lg shadow-lg border border-gray-300 transform hover:scale-[1.005] transition-transform duration-200 ease-in-out"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              {/* Conditional rendering for endorser name/link */}
              {endorsement.endorser_id && endorsement.endorser_user?.name && endorsement.endorser_user.developers?.[0]?.public_profile_slug ? (
                // If it's a registered GitTalent user with a public profile slug, link to their profile
                <Link
                  to={`/u/${endorsement.endorser_user.developers[0].public_profile_slug}`}
                  className="text-xl font-extrabold text-blue-700 hover:text-blue-900 transition-colors cursor-pointer" // Bolder name, darker hover
                >
                  {endorsement.endorser_user.name}
                </Link>
              ) : (
                // If anonymous or not a registered GitTalent user with a public profile
                <p className="text-xl font-extrabold text-gray-900"> {/* Bolder name */}
                  {endorsement.is_anonymous ? 'Anonymous Endorser' : endorsement.endorser_user?.name || 'Endorser'}
                </p>
              )}
              {endorsement.endorser_role && (
                // ENSURED: className string is complete on one line. This was the source of the "unexpected token" error.
                <p className="text-sm text-gray-700 font-semibold">{endorsement.endorser_role}</p>
              )}
              {/* Removed endorser_email display entirely for privacy reasons */}
            </div>
            {canManageVisibility && (
              <button
                onClick={() => onToggleVisibility && onToggleVisibility(endorsement.id, !endorsement.is_public)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  endorsement.is_public ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {endorsement.is_public ? 'Public' : 'Private'}
              </button>
            )}
          </div>
          {/* Bolder comment text with darker color */}
          <p className="text-gray-800 leading-relaxed italic text-base font-bold">
            "{endorsement.comment}"
          </p>
          <p className="text-xs text-gray-600 mt-3 text-right"> {/* Darker date */}
            {new Date(endorsement.created_at).toLocaleDateString()}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-200 text-purple-900"> {/* Darker skill tag */}
              {endorsement.skill}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EndorsementDisplay;
