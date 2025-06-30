import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, REALTIME_LISTEN_TYPES } from '../../lib/supabase';
import { 
  Send, 
  ArrowLeft, 
  User, 
  Building, 
  Code,
  Clock,
  CheckCircle,
  Loader,
  Lock
} from 'lucide-react';
import { Message } from '../../types';

interface MessageThreadProps {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  jobContext?: {
    id: string;
    title: string;
  };
  onBack?: () => void;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  otherUserId,
  otherUserName,
  otherUserRole,
  otherUserProfilePicUrl,
  jobContext,
  onBack
}) => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [hasInitiatedContact, setHasInitiatedContact] = useState(false);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProfile && otherUserId) {
      fetchMessages();
      checkCanSendMessage();
      
      // Set up real-time subscription for new messages
      const subscription = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: REALTIME_LISTEN_TYPES.INSERT,
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${otherUserId},receiver_id=eq.${userProfile.id}`
          },
          (payload) => {
            console.log('New message received:', payload);
            // Fetch the complete message with sender/receiver info
            fetchNewMessage(payload.new.id);
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [userProfile, otherUserId, jobContext]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkCanSendMessage = async () => {
    if (!userProfile?.id || !otherUserId) return;

    // Recruiters can always message developers
    if (userProfile.role === 'recruiter' && otherUserRole === 'developer') {
      setCanSendMessage(true);
      return;
    }
    
    // Admins can always message anyone
    if (userProfile.role === 'admin') {
      setCanSendMessage(true);
      return;
    }
    
    // Anyone can message admins
    if (otherUserRole === 'admin') {
      setCanSendMessage(true);
      return;
    }
    
    // Developers can only message recruiters who have messaged them first
    if (userProfile.role === 'developer' && otherUserRole === 'recruiter') {
      try {
        // Check if there are any messages from the recruiter to the developer
        const { count, error: messagesError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', otherUserId)
          .eq('receiver_id', userProfile.id);
          
        if (messagesError) throw messagesError;
        
        // Developer can only send messages if the recruiter has messaged first
        setCanSendMessage(count ? count > 0 : false);
      } catch (error) {
        console.error('Error checking message permissions:', error);
        setCanSendMessage(false);
      }
      return;
    }
    
    // Default: no messaging allowed
    setCanSendMessage(false);
  };

  const fetchNewMessage = async (messageId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(*),
          receiver:users!messages_receiver_id_fkey(*)
        `)
        .eq('id', messageId)
        .single();

      if (error) throw error;
      
      if (data) {
        // Add the new message to the state
        setMessages(prev => [...prev, data]);
        
        // Mark the message as read
        await supabase
          .from('messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', messageId);
          
        // If this is the first message from the recruiter, update canSendMessage
        if (data.sender_id === otherUserId && userProfile?.role === 'developer' && otherUserRole === 'recruiter') {
          setCanSendMessage(true);
        }
      }
    } catch (error) {
      console.error('Error fetching new message:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);

      if (!userProfile?.id) return;

      // Build query conditions
      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(*),
          receiver:users!messages_receiver_id_fkey(*)
        `)
        .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userProfile.id})`);

      // Add job context filter if provided
      if (jobContext?.id) {
        query = query.eq('job_role_id', jobContext.id);
      } else {
        query = query.is('job_role_id', null);
      }

      const { data, error } = await query.order('sent_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // Check if there are any messages from the current user to the other user
      // This determines if contact has been initiated
      const hasInitiated = data?.some(msg => msg.sender_id === userProfile.id) || false;
      setHasInitiatedContact(hasInitiated);

      // Check if there are any messages from the other user to the current user
      // This determines if the developer can reply to a recruiter
      if (userProfile.role === 'developer' && otherUserRole === 'recruiter') {
        const hasReceivedMessage = data?.some(msg => msg.sender_id === otherUserId) || false;
        setCanSendMessage(hasReceivedMessage);
      } else {
        setCanSendMessage(true);
      }

      // Mark messages as read
      await markMessagesAsRead();

    } catch (error: any) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      if (!userProfile?.id) return;

      let query = supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('receiver_id', userProfile.id)
        .eq('sender_id', otherUserId)
        .eq('is_read', false);

      if (jobContext?.id) {
        query = query.eq('job_role_id', jobContext.id);
      } else {
        query = query.is('job_role_id', null);
      }

      await query;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !userProfile?.id || sending || !canSendMessage) return;

    try {
      setSending(true);

      const messageData = {
        sender_id: userProfile.id,
        receiver_id: otherUserId,
        subject: subject.trim() || (jobContext ? `Re: ${jobContext.title}` : 'Message'),
        body: newMessage.trim(),
        job_role_id: jobContext?.id || null,
        assignment_id: null, // Could be enhanced to link to specific assignments
        is_read: false
      };

      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) throw error;

      setNewMessage('');
      setSubject('');
      setHasInitiatedContact(true);
      await fetchMessages();

    } catch (error: any) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <User className="w-4 h-4" />;
      case 'recruiter':
        return <Building className="w-4 h-4" />;
      case 'developer':
        return <Code className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Determine if we should show limited info for the other user
  const shouldShowLimitedInfo = () => {
    return false;
  };

  const showLimitedInfo = shouldShowLimitedInfo();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          {otherUserProfilePicUrl ? (
            <img 
              src={otherUserProfilePicUrl} 
              alt={otherUserName}
              className="w-12 h-12 rounded-xl object-cover shadow-lg"
              onError={(e) => {
                // Fallback to initials if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = "w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg";
                  fallback.textContent = showLimitedInfo ? "?" : otherUserName.split(' ').map(n => n[0]).join('');
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
              {showLimitedInfo ? (
                <Lock className="w-6 h-6" />
              ) : (
                otherUserName.split(' ').map(n => n[0]).join('')
              )}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-gray-900">
                {showLimitedInfo ? "Recruiter" : otherUserName}
              </h2>
              <div className="flex items-center text-gray-500">
                {getRoleIcon(otherUserRole)}
                <span className="ml-1 text-sm capitalize">{otherUserRole}</span>
              </div>
            </div>
            {jobContext && (
              <p className="text-sm text-blue-600 font-medium">
                Re: {jobContext.title}
              </p>
            )}
            {showLimitedInfo && (
              <p className="text-xs text-gray-500 mt-1">
                <Lock className="w-3 h-3 inline mr-1" />
                Full details will be visible after the recruiter contacts you
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length > 0 ? (
          messages.map((message) => {
            const isFromCurrentUser = message.sender_id === userProfile?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    isFromCurrentUser
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.body}</p>
                  <div className={`flex items-center justify-between mt-2 text-xs ${
                    isFromCurrentUser ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    <span>{formatTime(message.sent_at)}</span>
                    {isFromCurrentUser && message.is_read && (
                      <CheckCircle className="w-3 h-3 ml-2" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {getRoleIcon(otherUserRole)}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a conversation</h3>
            <p className="text-gray-600">
              {showLimitedInfo 
                ? "Send a message to introduce yourself to the recruiter" 
                : `Send a message to ${otherUserName} to get started.`}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-6">
        {messages.length === 0 && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Subject (optional)"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={!canSendMessage}
            />
          </div>
        )}
        <div className="flex space-x-4">
          <textarea
            placeholder={canSendMessage ? "Type your message..." : "You can reply after the recruiter contacts you first"}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
            rows={3}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sending || !canSendMessage}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending || !canSendMessage}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            {sending ? (
              <Loader className="animate-spin w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        {!canSendMessage && userProfile?.role === 'developer' && otherUserRole === 'recruiter' && (
          <div className="mt-2 text-xs text-amber-600 font-medium">
            <Lock className="w-3 h-3 inline mr-1" />
            You can only reply after the recruiter contacts you first
          </div>
        )}
      </div>
    </div>
  );
};