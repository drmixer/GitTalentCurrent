// src/pages/EndorsementPage.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext'; // To get the current user's ID if logged in

const EndorsementPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>(); // The ID of the developer to endorse
  const navigate = useNavigate();
  const { user } = useAuth(); // Get the currently logged-in user from AuthContext

  const [endorsementText, setEndorsementText] = useState('');
  const [endorserName, setEndorserName] = useState(''); // New state for endorser's name
  const [endorserEmail, setEndorserEmail] = useState(''); // New state for endorser's email

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      setSubmitError("Cannot submit endorsement: Developer ID is missing from the URL.");
      return;
    }

    if (endorsementText.trim() === '') {
      setSubmitError("Endorsement message cannot be empty.");
      return;
    }

    // If user is NOT logged in, name and email are required
    if (!user && (endorserName.trim() === '' || endorserEmail.trim() === '')) {
        setSubmitError("Please provide your name and email to submit an anonymous endorsement.");
        return;
    }
    // Basic email validation (you might want a more robust one)
    if (!user && endorserEmail.trim() !== '' && !/\S+@\S+\.\S+/.test(endorserEmail.trim())) {
        setSubmitError("Please enter a valid email address.");
        return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const { data, error } = await supabase
        .from('endorsements')
        .insert({
          developer_id: userId, // The ID of the developer receiving the endorsement
          endorser_id: user?.id || null, // The ID of the person leaving the endorsement (null if not logged in)
          comment: endorsementText.trim(), // FIXED: Changed from 'text' to 'comment'
          endorser_email: user ? user.email : endorserEmail.trim() || null, // Use logged-in user's email or provided email
          endorser_name: user ? null : endorserName.trim() || null, // CORRECTED: Using endorser_name for the name
          endorser_role: null, // You can add a role field to the form if needed
          is_anonymous: !user, // Set to true if not logged in
          is_public: true, // Default to public, you can change this logic
        })
        .select(); // Select the inserted row to confirm

      if (error) {
        console.error('Error submitting endorsement:', error);
        // Provide more user-friendly messages for common errors if possible
        if (error.code === '23502') { // Not null violation
            setSubmitError("Missing required information. Please ensure all fields are filled.");
        } else {
            setSubmitError(error.message || "Failed to submit endorsement.");
        }
      } else {
        console.log('Endorsement submitted successfully:', data);
        setSubmitSuccess(true);
        setEndorsementText(''); // Clear the form
        setEndorserName('');
        setEndorserEmail('');

        // Redirect to home/landing page after a delay
        setTimeout(() => {
          navigate(`/`); // Redirect to the home/landing page
        }, 3000);
      }
    } catch (err) {
      console.error('Unexpected error during submission:', err);
      setSubmitError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center p-8">
        <p className="text-xl font-semibold text-gray-700">Developer ID is missing from the URL. Cannot leave an endorsement.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8 bg-white shadow-lg rounded-lg mt-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Leave an Endorsement for Developer ID: {userId.substring(0, 8)}...
      </h1>

      {submitSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Success!</strong>
          <span className="block sm:inline"> Your endorsement has been submitted. Redirecting to home...</span>
        </div>
      )}

      {submitError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Endorsement Textarea */}
        <div>
          <label htmlFor="endorsementText" className="block text-sm font-medium text-gray-700">
            Your Endorsement
          </label>
          <div className="mt-1">
            <textarea
              id="endorsementText"
              name="endorsementText"
              rows={6}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border-gray-300 rounded-md p-3 resize-y"
              placeholder="Share your positive experience with this developer..."
              value={endorsementText}
              onChange={(e) => setEndorsementText(e.target.value)}
              required
              disabled={isSubmitting || submitSuccess}
            ></textarea>
          </div>
        </div>

        {/* Conditional Name and Email Fields (if not logged in) */}
        {!user && (
          <div className="space-y-4">
            <div>
              <label htmlFor="endorserName" className="block text-sm font-medium text-gray-700">
                Your Name
              </label>
              <input
                type="text"
                id="endorserName"
                name="endorserName"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3"
                placeholder="e.g., Jane Doe"
                value={endorserName}
                onChange={(e) => setEndorserName(e.target.value)}
                required={!user} // Required only if not logged in
                disabled={isSubmitting || submitSuccess}
              />
            </div>
            <div>
              <label htmlFor="endorserEmail" className="block text-sm font-medium text-gray-700">
                Your Email
              </label>
              <input
                type="email"
                id="endorserEmail"
                name="endorserEmail"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3"
                placeholder="e.g., jane.doe@example.com"
                value={endorserEmail}
                onChange={(e) => setEndorserEmail(e.target.value)}
                required={!user} // Required only if not logged in
                disabled={isSubmitting || submitSuccess}
              />
            </div>
          </div>
        )}

        {/* Submission Info */}
        <p className="mt-2 text-sm text-gray-500 text-center">
            {user ? `You are submitting this as ${user.email || 'a logged-in user'}.` : "Your name and email will be used for this endorsement. Your identity will not be shared publicly without consent."}
        </p>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting || submitSuccess}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Endorsement'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EndorsementPage;
