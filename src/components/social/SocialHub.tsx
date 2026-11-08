import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  MessageSquare, 
  User as UserIcon,
  ChevronLeft,
  Share2,
  Shield,
  Zap
} from 'lucide-react';
import { UserSearch } from './UserSearch';
import { SocialProfile } from './SocialProfile';
import { ChatScreen } from './ChatScreen';
import { NotificationCenter } from './NotificationCenter';
import { ProfileTabLoader } from './ProfileTabLoader';
import { ChatService } from '../../services/chatService';
import { PresenceService } from '../../services/presenceService';
import { DbUserProfile, DbChatConversation, User, getUserProfile } from '../../lib/firebase';

interface SocialHubProps {
  currentUser: User;
  onBack?: () => void;
}

type Tab = 'discover' | 'chats' | 'notifications' | 'profile';

export const SocialHub: React.FC<SocialHubProps> = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [selectedUser, setSelectedUser] = useState<DbUserProfile | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<DbChatConversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, DbUserProfile>>({});
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Initialize presence for current user when SocialHub is open
  useEffect(() => {
    if (currentUser?.uid) {
      const stop = PresenceService.initPresence(currentUser.uid);
      return () => stop();
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsub = ChatService.onConversations(currentUser.uid, (convs) => {
      setConversations(convs);
      
      // Calculate total unread count across all conversations
      const total = ChatService.getTotalUnreadCount(convs, currentUser.uid);
      setUnreadTotal(total);

      // Fetch participant profiles
      convs.forEach(async (c) => {
        const otherId = c.participantIds.find(id => id !== currentUser.uid);
        if (otherId && !profiles[otherId]) {
          const profile = await getUserProfile(otherId);
          if (profile) {
            setProfiles(prev => ({ ...prev, [otherId]: profile }));
          }
        }
      });
    });

    return () => unsub();
  }, [currentUser.uid]);

  const handleSelectUser = (user: DbUserProfile) => {
    setSelectedUser(user);
  };

  const handleStartChat = async (user: DbUserProfile) => {
    const id = await ChatService.getOrCreateConversation(currentUser.uid, user.uid);
    setActiveConversationId(id);
    setSelectedUser(user);
    setActiveTab('chats');
  };

  const renderContent = () => {
    if (activeConversationId && selectedUser) {
      return (
        <ChatScreen 
          currentUser={currentUser}
          targetUser={selectedUser}
          onBack={() => {
            setActiveConversationId(null);
            setSelectedUser(null);
          }}
        />
      );
    }

    if (selectedUser) {
      return (
        <div className="space-y-4">
          <button 
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-cyan-500/60 hover:text-cyan-400 transition-colors p-4"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Matrix</span>
          </button>
          <SocialProfile 
            currentUser={currentUser}
            targetUser={selectedUser}
            onMessage={handleStartChat}
            onSelectUser={(u) => setSelectedUser(u)}
          />
        </div>
      );
    }

    switch (activeTab) {
      case 'discover':
        return (
          <div className="p-6 space-y-6 max-w-2xl mx-auto">
            <UserSearch onSelectUser={handleSelectUser} />
          </div>
        );

      case 'chats':
        return (
          <div className="p-6 space-y-6 max-w-2xl mx-auto">
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-cyan-50 tracking-tight">MESSAGES</h1>
              <p className="text-cyan-500/40 text-sm">Secure frequency links for data exchange.</p>
            </div>
            
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <div className="text-center py-20 text-cyan-500/20">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <p>No active data links.</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const otherId = conv.participantIds.find(id => id !== currentUser.uid);
                  const profile = otherId ? profiles[otherId] : null;
                  
                  return (
                    <ConversationListItem
                      key={conv.id}
                      conv={conv}
                      profile={profile}
                      currentUserId={currentUser.uid}
                      onSelect={() => {
                        if (profile) {
                          setSelectedUser(profile);
                          setActiveConversationId(conv.id);
                        }
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="p-6 space-y-6 max-w-2xl mx-auto">
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-cyan-50 tracking-tight">UPDATES</h1>
              <p className="text-cyan-500/40 text-sm">System alerts and interaction logs.</p>
            </div>
            <NotificationCenter 
              currentUser={currentUser} 
              onViewProfile={setSelectedUser}
              onViewChat={(id) => {
                setActiveConversationId(id);
                setActiveTab('chats');
              }}
            />
          </div>
        );

      case 'profile':
        return <ProfileTabLoader currentUser={currentUser} onStartChat={handleStartChat} onSelectUser={setSelectedUser} />;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-screen bg-black overflow-hidden border-x border-white/10 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15)]">
      {/* Top Nav (Mobile & Layout Header) */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/5 rounded-full text-cyan-500">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Zap className="w-5 h-5 text-cyan-500 fill-cyan-500" />
            </div>
            <span className="font-black text-xl tracking-tighter text-cyan-50">SOCIAL<span className="text-cyan-500">HUB</span></span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="grid grid-cols-3 border-t border-white/10 bg-black/80 backdrop-blur-md p-2">
        <NavButton 
          active={activeTab === 'discover'} 
          onClick={() => { setActiveTab('discover'); setSelectedUser(null); setActiveConversationId(null); }}
          icon={<Search className="w-6 h-6" />}
          label="Discover"
        />
        <NavButton 
          active={activeTab === 'chats'} 
          onClick={() => { setActiveTab('chats'); setSelectedUser(null); setActiveConversationId(null); }}
          icon={<MessageSquare className="w-6 h-6" />}
          label="Chats"
          badge={unreadTotal > 0 ? ChatService.formatUnreadBadge(unreadTotal) : undefined}
        />
        <NavButton 
          active={activeTab === 'profile'} 
          onClick={() => { setActiveTab('profile'); setSelectedUser(null); setActiveConversationId(null); }}
          icon={<UserIcon className="w-6 h-6" />}
          label="Me"
        />
      </div>
    </div>
  );
};

interface ConversationListItemProps {
  conv: DbChatConversation;
  profile: DbUserProfile | null;
  currentUserId: string;
  onSelect: () => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({ conv, profile, currentUserId, onSelect }) => {
  const [isOnline, setIsOnline] = useState(false);

  const otherId = conv.participantIds.find(id => id !== currentUserId);

  useEffect(() => {
    if (!otherId) return;
    const unsub = PresenceService.subscribeUserPresence(otherId, (online) => {
      setIsOnline(online);
    });
    return () => unsub();
  }, [otherId]);

  const unreadCount = conv.unreadCount?.[currentUserId] || 0;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center p-4 rounded-2xl border transition-all group ${
        unreadCount > 0 
          ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-900/10' 
          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-cyan-500/30'
      }`}
    >
      <div className="relative">
        {profile?.photoURL ? (
          <img src={profile.photoURL} alt="" className="w-12 h-12 rounded-full border border-cyan-500/30" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-cyan-900/20 flex items-center justify-center border border-cyan-500/30">
            <UserIcon className="w-6 h-6 text-cyan-500" />
          </div>
        )}
        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-black ${
          isOnline ? 'bg-green-500' : 'bg-slate-600'
        }`} />
      </div>
      
      <div className="ml-4 flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-50">@{profile?.username || 'unknown'}</span>
            {isOnline && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-green-500/20 text-green-400 font-semibold border border-green-500/30">
                Online
              </span>
            )}
          </div>
          <span className="text-[10px] text-cyan-500/40">
            {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <div className="flex justify-between items-center mt-1">
          <p className={`text-sm truncate pr-2 ${unreadCount > 0 ? 'text-white font-bold' : 'text-cyan-500/60'}`}>
            {conv.lastSenderId === currentUserId ? 'You: ' : ''}
            {conv.lastMessage || 'Link established...'}
          </p>
          
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold shadow-lg shadow-rose-500/40 shrink-0 border border-black animate-pulse">
              🔴 {ChatService.formatUnreadBadge(unreadCount)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, badge }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center py-2 transition-all relative ${
      active ? 'text-cyan-400' : 'text-cyan-500/30 hover:text-cyan-500/60'
    }`}
  >
    <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-cyan-500/10' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] mt-1 font-bold uppercase tracking-widest">{label}</span>
    {badge !== undefined && badge !== '' && (
      <div className="absolute top-1 right-1/2 translate-x-4 bg-rose-500 text-white text-[9px] font-black min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/50 border border-black animate-bounce">
        {badge}
      </div>
    )}
  </button>
);
