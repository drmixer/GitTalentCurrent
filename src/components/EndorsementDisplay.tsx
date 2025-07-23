// src/components/EndorsementDisplay.tsx

import React from 'react';
import { Endorsement } from '../types'; // Adjust this path to your Endorsement interface

interface EndorsementDisplayProps {
  endorsements: Endorsement[];
  isLoading?: boolean;
  error?: string | null;
}

const EndorsementDisplay: React.FC<EndorsementDisplayProps> = ({ endorsements, isLoading, error }) => {
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
          <div className="mt-4 text-right text-sm text-gray-500">
            —{' '}
            {endorsement.endorser_name
              ? // Display name and optionally email for anonymous
                `${endorsement.endorser_name}${endorsement.endorser_email ? ` (${endorsement.endorser_email})` : ''}`
              : // For authenticated endorsers, just say "A GitTalent User" as we're not joining profiles here
                'A GitTalent User'}
            {' on '}
            {new Date(endorsement.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EndorsementDisplay;
