import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { REALTIME_LISTEN_TYPES } from '@supabase/supabase-js';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  User, 
  Clock,
  Mail,
  MailOpen,
  Building,
  Code,
  Loader,
  AlertCircle,
  X,
  Lock,
  Archive,
  Trash2
} from 'lucide-react';
import { Message, User as UserType } from '../../types';

interface MessageThread {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  lastMessage: Message;
  unreadCount: number;
  jobContext?: {
    id: string;
    title: string;
  };
}

interface MessageListProps {
  onThreadSelect?: (thread: MessageThread) => void;
  searchTerm?: string;
}

export const MessageList: React.FC<MessageListProps> = ({ onThreadSelect, searchTerm = '' }) => {
  const { userProfile } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<UserType[]>([]);
  const [canInitiateContacts, setCanInitiateContacts] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (userProfile) {
      fetchMessageThreads();
      fetchAvailableContacts();
      
      // Set up real-time subscription for new messages
      const subscription = supabase
        .channel('public-messages-thread-list')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT and UPDATE
            schema: 'public',
            table: 'messages',
            // Filter for messages where the current user is either sender or receiver,
            // as changes to 'is_read' status or new messages can affect thread list.
            filter: `receiver_id=eq.${userProfile.id}` // More specific for updates relevant to this user's unread counts
          },
          (payload) => {
            fetchMessageThreads();
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [userProfile, onThreadSelect]);

  const fetchMessageThreads = async () => {
    try {
      setLoading(true);
      setError('');

      if (!userProfile?.id) return;

      // Fetch all messages where user is sender or receiver
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(*),
          receiver:users!messages_receiver_id_fkey(*),
          job_role:job_roles(id, title)
        `)
        .or(`sender_id.eq.${userProfile.id},receiver_id.eq.${userProfile.id}`)
        .order('sent_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Group messages into threads
      const threadMap = new Map<string, MessageThread>();

      // Fetch profile pictures for developers
      const developerIds = new Set<string>();
      messages?.forEach(message => {
        const isFromCurrentUser = message.sender_id === userProfile.id;
        const otherUserId = isFromCurrentUser ? message.receiver_id : message.sender_id;
        const otherUser = isFromCurrentUser ? message.receiver : message.sender;
        
        if (otherUser?.role === 'developer') {
          developerIds.add(otherUserId);
        }
      });

      // Get profile pictures for developers
      const developerProfilePics: Record<string, string> = {};
      if (developerIds.size > 0) {
        const { data: developers } = await supabase
          .from('developers')
          .select('user_id, profile_pic_url')
          .in('user_id', Array.from(developerIds));
          
        developers?.forEach(dev => {
          if (dev.profile_pic_url) {
            developerProfilePics[dev.user_id] = dev.profile_pic_url;
          }
        });
      }

      messages?.forEach((message) => {
        const isFromCurrentUser = message.sender_id === userProfile.id;
        const otherUser = isFromCurrentUser ? message.receiver : message.sender;
        
        if (!otherUser) return;

        // Create thread key based on other user and job context
        const threadKey = `${otherUser.id}-${message.job_role_id || 'general'}`;
        
        const existingThread = threadMap.get(threadKey);
        
        if (!existingThread || new Date(message.sent_at) > new Date(existingThread.lastMessage.sent_at)) {
          // Count unread messages for this thread
          const unreadCount = messages.filter(m => 
            m.receiver_id === userProfile.id && 
            !m.is_read &&
            ((m.sender_id === otherUser.id && m.job_role_id === message.job_role_id) ||
             (m.sender_id === otherUser.id && !m.job_role_id && !message.job_role_id))
          ).length;

          // Get profile picture URL if available
          const profilePicUrl = otherUser.role === 'developer' ? developerProfilePics[otherUser.id] : undefined;

          threadMap.set(threadKey, {
            otherUserId: otherUser.id,
            otherUserName: otherUser.name,
            otherUserRole: otherUser.role,
            otherUserProfilePicUrl: profilePicUrl,
            lastMessage: message,
            unreadCount,
            jobContext: message.job_role ? {
              id: message.job_role.id,
              title: message.job_role.title
            } : undefined
          });
        }
      });

      setThreads(Array.from(threadMap.values()).sort((a, b) => 
        new Date(b.lastMessage.sent_at).getTime() - new Date(a.lastMessage.sent_at).getTime()
      ));

    } catch (error: any) {
      console.error('Error fetching message threads:', error);
      setError(error.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableContacts = async () => {
    try {
      if (!userProfile?.id) return;

      let contacts: UserType[] = [];
      console.log('Fetching available contacts for role:', userProfile.role);

      if (userProfile.role === 'developer') {
        // Developers can message admin and recruiters who have assigned them
        const { data: adminUsers } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'admin');
        
        console.log('Admin users for developer:', adminUsers);

        // Get all recruiters who have messaged this developer
        const { data: recruitersWhoMessaged } = await supabase
          .from('messages')
          .select(`
            sender:users!messages_sender_id_fkey(*)
          `)
          .eq('receiver_id', userProfile.id)
          .eq('sender.role', 'recruiter');
        
        // Extract unique recruiters
        const uniqueRecruiters = new Map();
        recruitersWhoMessaged?.forEach(msg => {
          if (msg.sender && !uniqueRecruiters.has(msg.sender.id)) {
            uniqueRecruiters.set(msg.sender.id, msg.sender);
          }
        });

        contacts = [
          ...(adminUsers || []),
          ...Array.from(uniqueRecruiters.values())
        ];
        
        // For each recruiter, check if they've messaged the developer
        const canInitiate: {[key: string]: boolean} = {};
        for (const contact of contacts) {
          if (contact.role === 'admin') {
            canInitiate[contact.id] = true;
          } else if (contact.role === 'recruiter') {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('sender_id', contact.id)
              .eq('receiver_id', userProfile.id);
            
            canInitiate[contact.id] = count ? count > 0 : false;
          }
        }
        setCanInitiateContacts(canInitiate);
        
      } else if (userProfile.role === 'recruiter') {
        // Recruiters can message assigned developers and admins
        const { data: adminUsers } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'admin');

        // Get all developers
        const { data: developers } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'developer');

        contacts = [
          ...(adminUsers || []),
          ...(developers || [])
        ];
        
        // Recruiters can always initiate contact with developers they're assigned to
        const canInitiate: {[key: string]: boolean} = {};
        for (const contact of contacts) {
          canInitiate[contact.id] = true;
        }
        setCanInitiateContacts(canInitiate);
        
        console.log('Contacts for recruiter:', contacts);
      } else if (userProfile.role === 'admin') {
        // Admins can message anyone
        const { data: allUsers } = await supabase
          .from('users')
          .select('*')
          .neq('id', userProfile.id);

        contacts = allUsers || [];
        
        // Admins can always initiate contact with anyone
        const canInitiate: {[key: string]: boolean} = {};
        for (const contact of contacts) {
          canInitiate[contact.id] = true;
        }
        setCanInitiateContacts(canInitiate);
      }

      // Remove duplicates based on id
      contacts = contacts.filter((contact, index, self) => 
        index === self.findIndex(c => c.id === contact.id)
      );

      setAvailableContacts(contacts);
    } catch (error) {
      console.error('Error fetching available contacts:', error);
    }
  };

  const [viewArchived, setViewArchived] = useState(false);

  const archiveThread = async (otherUserId: string, jobRoleId?: string) => {
    if (!userProfile) return;
    try {
      const { data, error } = await supabase.rpc('archive_thread', {
        p_user_id: userProfile.id,
        p_other_user_id: otherUserId,
        p_job_role_id: jobRoleId || null,
      });

      if (error) throw error;
      fetchMessageThreads();
    } catch (error) {
      console.error('Error archiving thread:', error);
    }
  };

  const deleteThread = async (otherUserId: string, jobRoleId?: string) => {
    if (!userProfile) return;
    if (!window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }
    try {
      const { data, error } = await supabase.rpc('delete_thread', {
        p_user_id: userProfile.id,
        p_other_user_id: otherUserId,
        p_job_role_id: jobRoleId || null,
      });

      if (error) throw error;
      fetchMessageThreads();
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  const filteredThreads = threads.filter(thread => {
    const isSender = thread.lastMessage.sender_id === userProfile?.id;
    const isArchived = isSender ? thread.lastMessage.archived_by_sender : thread.lastMessage.archived_by_receiver;
    const isDeleted = isSender ? thread.lastMessage.deleted_by_sender : thread.lastMessage.deleted_by_receiver;

    return (viewArchived ? isArchived : !isArchived) &&
      !isDeleted &&
      (thread.otherUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (thread.jobContext?.title && thread.jobContext.title.toLowerCase().includes(searchTerm.toLowerCase())))
  });

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
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Messages</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setViewArchived(!viewArchived)}
            className="text-gray-600 hover:text-gray-900"
          >
            {viewArchived ? 'View Inbox' : 'View Archived'}
          </button>
          {availableContacts.length > 0 && (
            <button
              onClick={() => setShowNewMessageModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4 mr-2 inline" />
              New Message
            </button>
          )}
        </div>
      </div>


      {/* Message Threads */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredThreads.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredThreads.map((thread, index) => (
              <div
                key={`${thread.otherUserId}-${thread.jobContext?.id || 'general'}`}
                className="group p-6 hover:bg-gray-50 cursor-pointer transition-colors relative"
                onClick={() => onThreadSelect?.(thread)}
              >
                <div className="flex items-start space-x-4">
                  {thread.otherUserProfilePicUrl ? (
                    <img 
                      src={thread.otherUserProfilePicUrl} 
                      alt={thread.otherUserName}
                      className="w-12 h-12 rounded-xl object-cover shadow-lg"
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = "w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg";
                          fallback.textContent = thread.otherUserName.split(' ').map(n => n[0]).join('');
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                      {thread.otherUserName.split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-bold text-gray-900 truncate">
                          {thread.otherUserName}
                        </h3>
                        <div className="flex items-center text-gray-500">
                          {getRoleIcon(thread.otherUserRole)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {thread.unreadCount > 0 && (
                          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                            {thread.unreadCount}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {formatTime(thread.lastMessage.sent_at)}
                        </span>
                      </div>
                    </div>
                    {thread.jobContext && (
                      <div className="text-sm text-blue-600 font-medium mb-1">
                        Re: {thread.jobContext.title}
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      {thread.lastMessage.sender_id === userProfile?.id ? (
                        <span className="text-sm text-gray-500">You:</span>
                      ) : (
                        <div className="flex items-center text-gray-500">
                          {thread.unreadCount > 0 ? (
                            <Mail className="w-4 h-4 mr-1" />
                          ) : (
                            <MailOpen className="w-4 h-4 mr-1" />
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-600 truncate">
                        {thread.lastMessage.body}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-4 right-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveThread(thread.otherUserId, thread.jobContext?.id);
                    }}
                    className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                    title="Archive"
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(thread.otherUserId, thread.jobContext?.id);
                    }}
                    className="p-2 text-red-500 hover:bg-red-100 rounded-full"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Messages</h3>
            <p className="text-gray-600">
              {searchTerm ? 'No conversations match your search.' : 'Your conversations will appear here.'}
            </p>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-gray-900">New Message</h3>
              <button
                onClick={() => setShowNewMessageModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            {availableContacts.length > 0 ? (
              <div className="space-y-4">
                {availableContacts.map((contact) => {
                  const canInitiate = canInitiateContacts[contact.id] || false;
                  return (
                    <button
                      key={contact.id}
                      className={`w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left ${
                        !canInitiate && userProfile?.role === 'developer' && contact.role === 'recruiter' 
                          ? 'opacity-50 cursor-not-allowed' 
                          : ''
                      }`}
                      onClick={() => {
                        if (canInitiate || userProfile?.role !== 'developer' || contact.role !== 'recruiter') {
                          if (onThreadSelect) {
                            onThreadSelect({
                              otherUserId: contact.id,
                              otherUserName: contact.name,
                              otherUserRole: contact.role,
                              lastMessage: {} as Message,
                              unreadCount: 0
                            });
                          }
                          setShowNewMessageModal(false);
                        }
                      }}
                      disabled={!canInitiate && userProfile?.role === 'developer' && contact.role === 'recruiter'}
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{contact.name}</div>
                        <div className="text-sm text-gray-600 capitalize">{contact.role}</div>
                        {!canInitiate && userProfile?.role === 'developer' && contact.role === 'recruiter' && (
                          <div className="text-xs text-amber-600 flex items-center mt-1">
                            <Lock className="w-3 h-3 mr-1" />
                            Wait for recruiter to contact you first
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No contacts available</p>
                <p className="text-sm text-gray-500 mt-2">
                  You'll be able to message recruiters once you're assigned to their job postings.
                </p>
              </div>
            )}
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowNewMessageModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};