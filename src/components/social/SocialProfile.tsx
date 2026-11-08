import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Shield, 
  MessageSquare, 
  UserPlus, 
  UserCheck, 
  Clock,
  MapPin,
  Calendar,
  Globe
} from 'lucide-react';
import { SocialService } from '../../services/socialService';
import { PresenceService } from '../../services/presenceService';
import { DbUserProfile, User } from '../../lib/firebase';
import { FollowersListModal } from './FollowersListModal';

interface SocialProfileProps {
  currentUser: User;
  targetUser: DbUserProfile;
  onMessage: (user: DbUserProfile) => void;
  onSelectUser?: (user: DbUserProfile) => void;
  onBack?: () => void;
}

export const SocialProfile: React.FC<SocialProfileProps> = ({ 
  currentUser, 
  targetUser, 
  onMessage,
  onSelectUser,
  onBack 
}) => {
  const [relationship, setRelationship] = useState<'NONE' | 'REQUESTED' | 'FOLLOWING'>('NONE');
  const [isFollowingYou, setIsFollowingYou] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'followers' | 'following' | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const unsub = PresenceService.subscribeUserPresence(targetUser.uid, (online) => {
      setIsOnline(online);
    });
    return () => unsub();
  }, [targetUser.uid]);

  useEffect(() => {
    const checkStatus = async () => {
      const status = await SocialService.getRelationshipStatus(currentUser.uid, targetUser.uid);
      setRelationship(status);
      
      const followsYou = await SocialService.isFollowing(targetUser.uid, currentUser.uid);
      setIsFollowingYou(followsYou);

      setIsLoading(false);
    };
    checkStatus();
  }, [currentUser.uid, targetUser.uid]);

  const handleFollow = async () => {
    setActionLoading(true);
    try {
      await SocialService.followUser(currentUser.uid, targetUser);
      const status = await SocialService.getRelationshipStatus(currentUser.uid, targetUser.uid);
      setRelationship(status);
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!window.confirm(`Unfollow @${targetUser.username}?`)) return;
    
    setActionLoading(true);
    try {
      await SocialService.unfollowUser(currentUser.uid, targetUser.uid);
      setRelationship('NONE');
    } catch (error) {
      console.error('Unfollow error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const isOwnProfile = currentUser.uid === targetUser.uid;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Profile Header */}
      <div className="relative mb-6">
        <div className="h-32 w-full bg-gradient-to-r from-cyan-900/40 via-purple-900/40 to-cyan-900/40 rounded-t-2xl border-x border-t border-white/10" />
        <div className="absolute -bottom-12 left-6">
          <div className="relative">
            {targetUser.photoURL ? (
              <img
                src={targetUser.photoURL}
                alt={targetUser.username}
                className="w-24 h-24 rounded-2xl border-4 border-black bg-black object-cover shadow-2xl shadow-cyan-500/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl border-4 border-black bg-cyan-950 flex items-center justify-center shadow-2xl shadow-cyan-500/20">
                <UserIcon className="w-12 h-12 text-cyan-500" />
              </div>
            )}
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-black ${
              isOnline ? 'bg-green-500' : 'bg-slate-600'
            }`} />
          </div>
        </div>
      </div>

      <div className="mt-14 px-6 space-y-6 pb-8">
        {/* Name and Stats */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-cyan-50">@{targetUser.username}</h2>
              {targetUser.accountType === 'private' && (
                <Shield className="w-5 h-5 text-amber-500" />
              )}
              {isOnline ? (
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span>Online</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-medium border border-slate-700">
                  Offline
                </span>
              )}
            </div>
            <p className="text-sm text-cyan-500/60 font-mono">ID: {targetUser.publicUid}</p>
            {isFollowingYou && !isOwnProfile && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                Follows you
              </span>
            )}
          </div>

          {!isOwnProfile && (
            <div className="flex gap-2">
              <button
                onClick={() => onMessage(targetUser)}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all"
                title="Message"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              
              {relationship === 'FOLLOWING' ? (
                <button
                  onClick={handleUnfollow}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center gap-2"
                >
                  <UserCheck className="w-5 h-5" />
                  <span className="font-medium">{isFollowingYou ? 'Mutual' : 'Following'}</span>
                </button>
              ) : relationship === 'REQUESTED' ? (
                <button
                  disabled
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-cyan-500/50 flex items-center gap-2 cursor-not-allowed"
                >
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Requested</span>
                </button>
              ) : (
                <button
                  onClick={handleFollow}
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 text-black font-bold hover:bg-cyan-400 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {actionLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black animate-spin rounded-full" />
                  ) : (
                    <UserPlus className="w-5 h-5" />
                  )}
                  <span>{isFollowingYou ? 'Follow back' : 'Follow'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        {targetUser.bio && (
          <p className="text-cyan-50/80 leading-relaxed max-w-lg">
            {targetUser.bio}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/5">
          <button 
            onClick={() => setModalTab('followers')}
            className="text-center group hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="text-xl font-bold text-cyan-50 group-hover:text-cyan-400">{targetUser.followersCount || 0}</div>
            <div className="text-xs text-cyan-500/40 uppercase tracking-widest">Followers</div>
          </button>
          
          <button 
            onClick={() => setModalTab('following')}
            className="text-center border-x border-white/5 group hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="text-xl font-bold text-cyan-50 group-hover:text-cyan-400">{targetUser.followingCount || 0}</div>
            <div className="text-xs text-cyan-500/40 uppercase tracking-widest">Following</div>
          </button>

          <div className="text-center">
            <div className="text-xl font-bold text-cyan-50">32</div>
            <div className="text-xs text-cyan-500/40 uppercase tracking-widest">Posts</div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-y-3">
          <div className="flex items-center gap-2 text-cyan-500/60 text-sm">
            <Calendar className="w-4 h-4" />
            <span>Joined {new Date(targetUser.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-500/60 text-sm">
            <MapPin className="w-4 h-4" />
            <span>Cyber Space</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-500/60 text-sm">
            <Globe className="w-4 h-4" />
            <span>riya-assistant.ai</span>
          </div>
        </div>

        {/* Privacy Notice if Private and not following */}
        {targetUser.accountType === 'private' && relationship !== 'FOLLOWING' && !isOwnProfile && (
          <div className="mt-8 p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
            <Shield className="w-12 h-12 mx-auto mb-4 text-cyan-500/30" />
            <h3 className="text-lg font-medium text-cyan-50">This Account is Private</h3>
            <p className="text-cyan-500/40 mt-1 max-w-xs mx-auto">Follow this user to see their photos and videos.</p>
          </div>
        )}
      </div>

      {/* Followers / Following Modal */}
      {modalTab && (
        <FollowersListModal
          currentUser={currentUser}
          profileUser={targetUser}
          initialTab={modalTab}
          onClose={() => setModalTab(null)}
          onSelectUser={(u) => {
            if (onSelectUser) onSelectUser(u);
          }}
        />
      )}
    </div>
  );
};
