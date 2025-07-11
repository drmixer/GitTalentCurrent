import React from 'react';
import { Endorsement } from '../../types'; // Assuming Endorsement type is defined
import { Award, MessageSquare, UserCircle } from 'lucide-react';

interface LatestEndorsementsProps {
  endorsements: Endorsement[];
  loading?: boolean;
  error?: string | null;
}

export const LatestEndorsements: React.FC<LatestEndorsementsProps> = ({ endorsements, loading, error }) => {
  const displayEndorsements = endorsements.slice(0, 2); // Show 1-2 most recent

  return (
    <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Latest Endorsements</h3>

      {loading && <p className="text-gray-500">Loading endorsements...</p>}
      {error && <p className="text-red-500">Error loading endorsements: {error}</p>}

      {!loading && !error && displayEndorsements.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          <Award size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm">No endorsements yet.</p>
          <p className="text-xs mt-1">Why not ask colleagues or clients for one?</p>
        </div>
      )}

      {!loading && !error && displayEndorsements.length > 0 && (
        <ul className="space-y-4">
          {displayEndorsements.map((endorsement) => (
            <li key={endorsement.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-start space-x-3">
                {endorsement.endorser?.avatar_url ? (
                  <img
                    src={endorsement.endorser.avatar_url}
                    alt={endorsement.endorser.name || 'Endorser'}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <UserCircle size={40} className="text-gray-400 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">"{endorsement.text}"</p>
                  <p className="text-xs text-gray-500 mt-1">
                    &mdash; {endorsement.endorser?.name || 'Anonymous Endorser'}
                    {endorsement.endorser?.title && <span className="text-gray-400">, {endorsement.endorser.title}</span>}
                  </p>
                   <p className="text-xs text-gray-400">{new Date(endorsement.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* TODO: Add a button/link to view all endorsements or request endorsements */}
    </div>
  );
};
