// src/components/EndorsementDisplay.tsx

import React from 'react';
import { Endorsement } from '../types'; // Adjust this path to your Endorsement interface

interface EndorsementDisplayProps {
  endorsements: Endorsement[];
  isLoading?: boolean;
  error?: string | null;
  canManageVisibility?: boolean; // NEW PROP: If true, show controls to toggle visibility
  onToggleVisibility?: (endorsementId: string, currentIsPublic: boolean) => void; // NEW PROP: Callback for toggling visibility
}

const EndorsementDisplay: React.FC<EndorsementDisplayProps> = ({ endorsements, isLoading, error, canManageVisibility, onToggleVisibility }) => {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading endorsements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>Error loading endorsements: {error}</p>
      </div>
    );
  }

  if (!endorsements || endorsements.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No endorsements found for this developer yet.</p>
        {/* You could add a button/link here to encourage leaving an endorsement */}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 rounded-lg shadow-inner">
      <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">Endorsements ({endorsements.length})</h2>
      {endorsements.map((endorsement) => (
        <div key={endorsement.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <p className="text-gray-700 leading-relaxed italic">"{endorsement.text}"</p>
          <div className="mt-4 text-right text-sm text-gray-500 flex justify-between items-center"> {/* Modified for layout */}
            <span>
              —{' '}
              {endorsement.endorser_name
                ? // Display name and optionally email for anonymous
                  `${endorsement.endorser_name}${endorsement.endorser_email ? ` (${endorsement.endorser_email})` : ''}`
                : // For authenticated endorsers, just say "A GitTalent User" as we're not joining profiles here
                  'A GitTalent User'}
              {' on '}
              {new Date(endorsement.created_at).toLocaleDateString()}
            </span>
            {canManageVisibility && onToggleVisibility && ( // Render visibility toggle if allowed and callback provided
              <button
                onClick={() => onToggleVisibility(endorsement.id, endorsement.is_public ?? true)} // Pass current status
                className={`ml-4 px-3 py-1 text-xs rounded-full transition-colors font-medium
                  ${(endorsement.is_public ?? true) ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`
                }
              >
                {(endorsement.is_public ?? true) ? 'Public (Click to Hide)' : 'Hidden (Click to Make Public)'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EndorsementDisplay;
