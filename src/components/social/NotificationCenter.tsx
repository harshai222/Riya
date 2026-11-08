import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  MessageCircle, 
  Check, 
  ShieldAlert,
  Ghost
} from 'lucide-react';
import { SocialService } from '../../services/socialService';
import { DbSocialNotification, User, getUserProfile, DbUserProfile } from '../../lib/firebase';

interface NotificationCenterProps {
  currentUser: User;
  onViewProfile: (user: DbUserProfile) => void;
  onViewChat: (conversationId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  currentUser, 
  onViewProfile,
  onViewChat
}) => {
  const [notifications, setNotifications] = useState<DbSocialNotification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, DbUserProfile>>({});

  useEffect(() => {
    const unsub = SocialService.onNotifications(currentUser.uid, (notifs) => {
      setNotifications(notifs);
      
      // Fetch missing profiles
      notifs.forEach(async (n) => {
        if (!profiles[n.fromUid]) {
          const profile = await getUserProfile(n.fromUid);
          if (profile) {
            setProfiles(prev => ({ ...prev, [n.fromUid]: profile }));
          }
        }
      });
    });

    return () => unsub();
  }, [currentUser.uid]);

  const handleAction = async (notif: DbSocialNotification, action: 'accept' | 'reject') => {
    if (notif.type === 'follow_request') {
      await SocialService.respondToFollowRequest(notif.relatedId, action === 'accept' ? 'accepted' : 'rejected');
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-cyan-500/30">
        <Ghost className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-sm font-medium">No system notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notif) => {
        const profile = profiles[notif.fromUid];
        
        return (
          <div 
            key={notif.id}
            className={`p-4 rounded-xl border transition-all ${
              notif.read 
                ? 'bg-black/20 border-white/5 opacity-70' 
                : 'bg-white/5 border-cyan-500/20 shadow-lg shadow-cyan-500/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {notif.type === 'follow_request' && (
                  <div className="p-2 rounded-full bg-amber-500/10 text-amber-500">
                    <UserPlus className="w-4 h-4" />
                  </div>
                )}
                {notif.type === 'follow_accept' && (
                  <div className="p-2 rounded-full bg-cyan-500/10 text-cyan-500">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                )}
                {notif.type === 'new_message' && (
                  <div className="p-2 rounded-full bg-purple-500/10 text-purple-500">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="text-sm text-cyan-50">
                  {profile ? (
                    <button 
                      onClick={() => onViewProfile(profile)}
                      className="font-bold hover:text-cyan-400"
                    >
                      @{profile.username}
                    </button>
                  ) : (
                    <span className="font-bold">Someone</span>
                  )}
                  {' '}
                  {notif.type === 'follow_request' && 'sent you a follow request.'}
                  {notif.type === 'follow_accept' && 'started following you.'}
                  {notif.type === 'new_message' && 'sent you a new message.'}
                </div>
                <div className="text-[10px] text-cyan-500/40 font-mono">
                  {new Date(notif.createdAt).toLocaleString()}
                </div>

                {notif.type === 'follow_request' && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleAction(notif, 'accept')}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleAction(notif, 'reject')}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-cyan-50 text-xs font-medium hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {notif.type === 'new_message' && (
                  <button
                    onClick={() => onViewChat(notif.relatedId)}
                    className="mt-2 text-xs text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    View Conversation
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
