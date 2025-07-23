// src/pages/EndorsementPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase'; // Corrected path from previous step

// Assuming you might have a component to display LatestEndorsements, you can import it here
// import { LatestEndorsements } from '../components/Overview/LatestEndorsements';

interface Endorsement {
  id: string;
  developer_id: string; // Updated to match schema
  endorser_id: string;
  text: string; // Changed from 'message' to 'text' to match schema
  created_at: string;
  updated_at: string | null; // Added updated_at from schema
}

const EndorsementPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEndorsements = async () => {
      if (!userId) {
        setError("Error: User ID is missing from the URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      console.log(`Fetching endorsements for developer_id: ${userId}`); // Debugging log

      const { data, error } = await supabase
        .from('endorsements')
        .select('*')
        .eq('developer_id', userId) // <--- CORRECTED COLUMN NAME HERE!
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching endorsements:', error.message);
        setError(error.message);
        setEndorsements([]);
      } else {
        setEndorsements(data || []);
        setError(null);
      }
      setLoading(false);
    };

    fetchEndorsements();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center p-8">
        <p className="text-xl font-semibold text-gray-700">Loading endorsements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center p-8 text-red-600 font-semibold">
        <p>Error: {error}</p>
        <p>Please check your Supabase tables and policies, or try refreshing.</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center p-8">
        <p className="text-xl font-semibold text-gray-700">No developer ID provided.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Endorsements for Developer ID: {userId.substring(0, 8)}...
      </h1>

      {endorsements.length === 0 ? (
        <p className="text-gray-600 text-center text-lg mt-8">
          No endorsements found for this developer yet. Be the first to give one!
        </p>
      ) : (
        <div className="space-y-6">
          {endorsements.map((endorsement) => (
            <div key={endorsement.id} className="bg-white shadow-md rounded-lg p-6 border border-gray-100 transition-all duration-200 hover:shadow-lg">
              <p className="text-gray-800 text-lg mb-2 leading-relaxed">
                "{endorsement.text}" {/* Updated from 'message' to 'text' */}
              </p>
              <p className="text-sm text-gray-500 text-right mt-4">
                — Endorsed by {endorsement.endorser_id ? `User ${endorsement.endorser_id.substring(0, 8)}...` : 'Anonymous'} on {new Date(endorsement.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/*
        If you have an endorsement submission form, you can include it here.
        Example: <EndorsementSubmissionForm recipientId={userId} onEndorsementAdded={fetchEndorsements} />
      */}
    </div>
  );
};

export default EndorsementPage;
