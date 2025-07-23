// src/pages/EndorsementPage.tsx
// This component will be responsible for fetching and displaying endorsements.

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Make sure this path is correct for your Supabase client

// You'll likely use or display content from this component
// import { LatestEndorsements } from '../components/Overview/LatestEndorsements';

interface Endorsement {
  id: string;
  message: string;
  endorser_id: string; // Example: who gave the endorsement
  recipient_user_id: string; // Example: who received it
  created_at: string;
  // Add other fields relevant to your 'endorsements' table
}

const EndorsementPage: React.FC = () => {
  // Use 'userId' here to match the URL parameter name we'll use in the Route
  const { userId } = useParams<{ userId: string }>();
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEndorsements = async () => {
      if (!userId) {
        setError("User ID is missing from the URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null); // Clear previous errors

      const { data, error } = await supabase
        .from('endorsements')
        .select('*') // Select all relevant columns from your endorsements table
        .eq('recipient_user_id', userId) // Filter by the user who received the endorsement
        .order('created_at', { ascending: false }); // Order by newest first

      if (error) {
        console.error('Error fetching endorsements:', error.message);
        setError(error.message);
      } else {
        setEndorsements(data || []); // Ensure data is an array
      }
      setLoading(false);
    };

    fetchEndorsements();
  }, [userId]); // Re-run effect if userId changes

  if (loading) {
    return <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center p-8"><p className="text-xl font-semibold text-gray-700">Loading endorsements...</p></div>;
  }

  if (error) {
    return <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center p-8 text-red-600 font-semibold">Error: {error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Endorsements for Developer ID: {userId}</h1>

      {endorsements.length === 0 ? (
        <p className="text-gray-600">No endorsements found for this developer yet. Be the first to give one!</p>
      ) : (
        <div className="space-y-6">
          {/* You can map over endorsements here or pass them to your LatestEndorsements component */}
          {/* Example:
          <LatestEndorsements endorsements={endorsements} />
          */}
          {endorsements.map((endorsement) => (
            <div key={endorsement.id} className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
              <p className="text-gray-800 text-lg mb-2">{endorsement.message}</p>
              <p className="text-sm text-gray-500">- Endorsed by {endorsement.endorser_id || 'Anonymous'} on {new Date(endorsement.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add your endorsement submission form here, if applicable */}
      {/* <EndorsementSubmissionForm recipientId={userId} onEndorsementAdded={fetchEndorsements} /> */}
    </div>
  );
};

export default EndorsementPage; // Use default export since your other page components use it
