import React, { useState, useEffect } from 'react';
import { Search, User as UserIcon, Shield, ShieldAlert, CheckCircle } from 'lucide-react';
import { SocialService } from '../../services/socialService';
import { PresenceService } from '../../services/presenceService';
import { DbUserProfile } from '../../lib/firebase';

interface UserSearchProps {
  onSelectUser: (user: DbUserProfile) => void;
}

const UserSearchResultItem: React.FC<{
  user: DbUserProfile;
  onSelectUser: (user: DbUserProfile) => void;
}> = ({ user, onSelectUser }) => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const unsubscribe = PresenceService.subscribeUserPresence(user.uid, (online) => {
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, [user.uid]);

  return (
    <button
      onClick={() => onSelectUser(user)}
      className="w-full flex items-center p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/30 transition-all group text-left"
    >
      <div className="relative">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.username}
            className="w-12 h-12 rounded-full border border-cyan-500/30 group-hover:border-cyan-400 transition-colors object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center group-hover:border-cyan-400 transition-colors">
            <UserIcon className="w-6 h-6 text-cyan-500" />
          </div>
        )}
        {/* Presence Badge */}
        <span
          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-black ${
            isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
        {user.accountType === 'private' && (
          <div className="absolute -top-1 -right-1 bg-black rounded-full p-0.5">
            <Shield className="w-3 h-3 text-amber-500" />
          </div>
        )}
      </div>
      
      <div className="ml-3 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-cyan-50">@{user.username || 'anonymous'}</span>
          {user.role === 'admin' && (
            <CheckCircle className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" />
          )}
        </div>
        <p className={`text-xs ${isOnline ? 'text-emerald-400 font-medium' : 'text-cyan-500/40'}`}>
          {isOnline ? 'Active Now' : 'Offline'}
        </p>
      </div>
      
      <div className="text-xs text-cyan-500/40 opacity-0 group-hover:opacity-100 transition-opacity">
        View Profile
      </div>
    </button>
  );
};

export const UserSearch: React.FC<UserSearchProps> = ({ onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<DbUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length >= 3) {
        setIsSearching(true);
        try {
          const users = await SocialService.searchUsers(searchTerm);
          setResults(users);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="w-full space-y-4">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-cyan-500/50 group-focus-within:text-cyan-400 transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-cyan-500/30 rounded-lg bg-black/40 text-cyan-50 placeholder-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-md"
          placeholder="Search by Username or Public UID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500"></div>
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {results.map((user) => (
          <UserSearchResultItem key={user.uid} user={user} onSelectUser={onSelectUser} />
        ))}
        
        {searchTerm.trim().length >= 3 && !isSearching && results.length === 0 && (
          <div className="text-center py-8 text-cyan-500/40">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>No matches found in the matrix.</p>
          </div>
        )}
        
        {searchTerm.trim().length > 0 && searchTerm.trim().length < 3 && (
          <p className="text-center text-xs text-cyan-500/30">Enter at least 3 characters...</p>
        )}
      </div>
    </div>
  );
};
