import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  UserCheck, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  X,
  Shield,
  User as UserIcon
} from 'lucide-react';
import { SocialService } from '../../services/socialService';
import { DbUserProfile, User, getUserProfile } from '../../lib/firebase';

interface FollowersListModalProps {
  currentUser: User;
  profileUser: DbUserProfile;
  initialTab: 'followers' | 'following';
  onClose: () => void;
  onSelectUser: (user: DbUserProfile) => void;
}

export const FollowersListModal: React.FC<FollowersListModalProps> = ({
  currentUser,
  profileUser,
  initialTab,
  onClose,
  onSelectUser,
}) => {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [usersList, setUsersList] = useState<DbUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [relationshipStates, setRelationshipStates] = useState<Record<string, 'NONE' | 'REQUESTED' | 'FOLLOWING'>>({});
  const [currentUserFollowingMap, setCurrentUserFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadList();
  }, [activeTab, profileUser.uid]);

  const loadList = async () => {
    setLoading(true);
    try {
      let uids: string[] = [];
      if (activeTab === 'followers') {
        uids = await SocialService.getFollowersUids(profileUser.uid);
      } else {
        uids = await SocialService.getFollowingUids(profileUser.uid);
      }

      // Fetch profiles
      const profiles: DbUserProfile[] = [];
      const relMap: Record<string, 'NONE' | 'REQUESTED' | 'FOLLOWING'> = {};
      const currFollowingMap: Record<string, boolean> = {};

      for (const uid of uids) {
        const uProfile = await getUserProfile(uid);
        if (uProfile) {
          profiles.push(uProfile);
          // Check relationship between current logged-in user and this listed user
          const status = await SocialService.getRelationshipStatus(currentUser.uid, uid);
          relMap[uid] = status;

          // Check if listed user follows current user ("Follows you")
          const isFollowingCurrent = await SocialService.isFollowing(uid, currentUser.uid);
          currFollowingMap[uid] = isFollowingCurrent;
        }
      }

      setUsersList(profiles);
      setRelationshipStates(relMap);
      setCurrentUserFollowingMap(currFollowingMap);
    } catch (err) {
      console.error('Failed to load list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (targetUser: DbUserProfile) => {
    try {
      const currentStatus = relationshipStates[targetUser.uid];
      if (currentStatus === 'FOLLOWING') {
        await SocialService.unfollowUser(currentUser.uid, targetUser.uid);
        setRelationshipStates(prev => ({ ...prev, [targetUser.uid]: 'NONE' }));
      } else {
        await SocialService.followUser(currentUser.uid, targetUser);
        const newStatus = targetUser.accountType === 'public' ? 'FOLLOWING' : 'REQUESTED';
        setRelationshipStates(prev => ({ ...prev, [targetUser.uid]: newStatus }));
      }
    } catch (err) {
      console.error('Action error:', err);
    }
  };

  const filteredUsers = usersList.filter(u => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      u.username?.toLowerCase().includes(term) ||
      u.publicUid?.includes(term) ||
      u.displayName?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-md h-[80vh] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <h3 className="font-bold text-white text-base">@{profileUser.username}</h3>
            <p className="text-xs text-slate-400">UID: {profileUser.publicUid}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('followers')}
            className={`py-3 text-center border-b-2 transition-all ${activeTab === 'followers' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
          >
            Followers ({profileUser.followersCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`py-3 text-center border-b-2 transition-all ${activeTab === 'following' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
          >
            Following ({profileUser.followingCount || 0})
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/30">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          {loading ? (
            <div className="text-center py-16 text-xs text-slate-500">Loading network matrix...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-500">No users found.</div>
          ) : (
            filteredUsers.map((user) => {
              const status = relationshipStates[user.uid] || 'NONE';
              const followsYou = currentUserFollowingMap[user.uid];
              const isSelf = user.uid === currentUser.uid;

              return (
                <div key={user.uid} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => { onSelectUser(user); onClose(); }}>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-11 h-11 rounded-full object-cover border border-slate-700" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-cyan-950 flex items-center justify-center border border-slate-700">
                        <UserIcon className="w-5 h-5 text-cyan-400" />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                        <span>@{user.username}</span>
                        {user.accountType === 'private' && <Shield className="w-3 h-3 text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">UID: {user.publicUid}</div>
                      {followsYou && !isSelf && (
                        <div className="text-[9px] text-cyan-400 font-semibold mt-0.5">Follows you</div>
                      )}
                    </div>
                  </div>

                  {!isSelf && (
                    <div>
                      {status === 'FOLLOWING' ? (
                        <button
                          onClick={() => handleAction(user)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-red-950/40 hover:text-red-300 hover:border-red-500/40 transition-all"
                        >
                          {followsYou ? 'Mutual' : 'Following'}
                        </button>
                      ) : status === 'REQUESTED' ? (
                        <button
                          disabled
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium flex items-center gap-1 cursor-not-allowed"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Requested</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(user)}
                          className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-lg shadow-cyan-500/10"
                        >
                          {followsYou ? 'Follow back' : 'Follow'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
