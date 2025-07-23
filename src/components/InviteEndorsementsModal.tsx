import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, CheckCircle, Copy, Loader, AlertCircle, X, Link as LinkIcon, Award, Send } from 'lucide-react';
import { Developer } from '../types';

interface InviteEndorsementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  developer: Developer | null;
}

export const InviteEndorsementsModal: React.FC<InviteEndorsementsModalProps> = ({ isOpen, onClose, developer }) => {
  const [email, setEmail] = useState('');
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setInvitationLink(null);
      setStatusMessage(null);
      setIsSending(false);
      setCopySuccess(false);
    }
  }, [isOpen]);

  const handleSendInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    // CHANGED: developer?.id to developer?.user_id
    if (!email || !developer?.user_id) {
      setStatusMessage('Please enter an email and ensure your developer profile is loaded.');
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    setInvitationLink(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-endorsement-invite', {
        body: JSON.stringify({
          recipientEmail: email,
          // CHANGED: developer.id to developer.user_id
          developerId: developer.user_id,
          developerName: developer.user?.name || 'A Developer',
        }),
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setStatusMessage('Invitation email sent successfully!');
        setEmail('');
      } else {
        setStatusMessage(data?.message || 'Failed to send invitation. Please try again.');
      }

    } catch (error: any) {
      console.error('Error sending invitation:', error);
      setStatusMessage(`Error: ${error.message || 'Could not send invitation.'}`);
    } finally {
      setIsSending(false);
    }
  }, [email, developer]);

  const handleGenerateLink = useCallback(async () => {
    // CHANGED: developer?.id to developer?.user_id
    if (!developer?.user_id) {
      setStatusMessage('Please ensure your developer profile is loaded to generate a link.');
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    setInvitationLink(null);
    setCopySuccess(false);

    try {
      const { data, error } = await supabase.functions.invoke('generate-endorsement-link', {
        body: JSON.stringify({
          // CHANGED: developer.id to developer.user_id
          developerId: developer.user_id,
        }),
      });

      if (error) {
        throw error;
      }

      if (data?.success && data?.link) {
        setInvitationLink(data.link);
        setStatusMessage('Link generated. Share this with your endorsers!');
      } else {
        setStatusMessage(data?.message || 'Failed to generate link. Please try again.');
      }

    } catch (error: any) {
      console.error('Error generating link:', error);
      setStatusMessage(`Error: ${error.message || 'Could not generate link.'}`);
    } finally {
      setIsSending(false);
    }
  }, [developer]);


  const handleCopyLink = useCallback(() => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch(err => {
        console.error('Failed to copy text:', err);
        setCopySuccess(false);
      });
    }
  }, [invitationLink]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 sm:p-8 transform transition-all duration-300 scale-100 opacity-100">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Award size={24} className="mr-3 text-amber-500" /> Invite Endorsements
        </h2>

        <p className="text-gray-600 mb-6">
          Help build your professional profile by asking colleagues or clients to endorse your skills and experience.
        </p>

        {statusMessage && (
          <div className={`p-3 rounded-md mb-4 text-sm ${
            statusMessage.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          } flex items-center`}>
            {statusMessage.startsWith('Error') ? <AlertCircle size={18} className="mr-2" /> : <CheckCircle size={18} className="mr-2" />}
            {statusMessage}
          </div>
        )}

        {/* Invite by Email Section */}
        <div className="mb-8 p-5 border border-gray-200 rounded-md">
          <h3 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
            <Mail size={20} className="mr-2 text-blue-500"/> Invite via Email
          </h3>
          <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-150 flex items-center justify-center"
              disabled={isSending}
            >
              {isSending ? <Loader size={20} className="animate-spin mr-2" /> : <Send size={20} className="mr-2" />}
              {isSending ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>

        {/* Shareable Link Section */}
        <div className="p-5 border border-gray-200 rounded-md">
          <h3 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
            <Copy size={20} className="mr-2 text-purple-500"/> Get a Shareable Link
          </h3>
          {invitationLink ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                readOnly
                value={invitationLink}
                className="flex-grow p-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none text-sm"
              />
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-150 flex items-center justify-center"
              >
                {copySuccess ? <CheckCircle size={20} className="mr-2" /> : <Copy size={20} className="mr-2" />}
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateLink}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-150 flex items-center justify-center"
              disabled={isSending}
            >
              {isSending ? <Loader size={20} className="animate-spin mr-2" /> : <LinkIcon size={20} className="mr-2" />}
              {isSending ? 'Generating...' : 'Generate Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
