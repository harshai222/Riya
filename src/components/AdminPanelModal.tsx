import React, { useState, useEffect } from 'react';
import {
  User,
  DbUserProfile,
  DbMemoryFact,
  DbConversationSession,
  DbConversationMessage,
  DbUsernameReservation,
  adminSearchUserByUsername,
  adminListRecentUsernames,
  getMemoryFacts,
  getPastSessions,
  getConversationMessages,
  ADMIN_GOOGLE_EMAIL,
  isUserAdmin,
} from '../lib/firebase';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  X,
  User as UserIcon,
  Brain,
  MessageSquare,
  Sliders,
  Calendar,
  Lock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  RefreshCw,
  LogOut,
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSignOut: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'users'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected User State for Deep Inspection
  const [selectedUser, setSelectedUser] = useState<DbUserProfile | null>(null);
  const [userMemories, setUserMemories] = useState<DbMemoryFact[]>([]);
  const [userSessions, setUserSessions] = useState<DbConversationSession[]>([]);
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);

  // Conversation Messages Inspection
  const [selectedSession, setSelectedSession] = useState<DbConversationSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<DbConversationMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Recent Users Registry
  const [recentUsernames, setRecentUsernames] = useState<DbUsernameReservation[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Pagination for conversation sessions
  const [currentPage, setCurrentPage] = useState(1);
  const SESSIONS_PER_PAGE = 5;

  const isAdmin = isUserAdmin(currentUser);

  // Load recent registered usernames when modal opens or tab switches
  useEffect(() => {
    if (isOpen && isAdmin) {
      loadRecentUsers();
    }
  }, [isOpen, isAdmin]);

  const loadRecentUsers = async () => {
    setIsLoadingRecent(true);
    try {
      const list = await adminListRecentUsernames(30);
      setRecentUsernames(list || []);
    } catch (err) {
      console.error('Failed to load recent usernames:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  if (!isOpen) return null;

  // Strict Security Gate: If non-admin attempts to view
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-rose-800 shadow-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-700/80 mx-auto flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">403 — Unauthorized Access</h2>
            <p className="text-xs text-rose-300/90 mt-1">
              Admin privileges are strictly restricted to the verified administrator account (
              <span className="font-mono">{ADMIN_GOOGLE_EMAIL}</span>).
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 text-left space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Security Policy Enforced</span>
            </div>
            <div>Your Account: {currentUser?.email || 'Unauthenticated'}</div>
            <div>Firebase UID: {currentUser?.uid || 'None'}</div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Return to Assistant
          </button>
        </div>
      </div>
    );
  }

  // Handle Search by Username (using normalized lookup)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    setIsSearching(true);
    setSearchError(null);
    setSelectedSession(null);

    try {
      const { userProfile, reservation } = await adminSearchUserByUsername(queryStr);
      if (!userProfile) {
        setSearchError(`No user found with username "@${queryStr}".`);
        setSelectedUser(null);
      } else {
        setSelectedUser(userProfile);
        loadUserDetails(userProfile.uid);
      }
    } catch (err: any) {
      console.error('Admin search error:', err);
      setSearchError(err?.message || 'Error occurred while querying username registry.');
    } finally {
      setIsSearching(false);
    }
  };

  const loadUserDetails = async (uid: string) => {
    setIsLoadingUserDetails(true);
    setCurrentPage(1);
    setSelectedSession(null);
    try {
      const [mems, sess] = await Promise.all([getMemoryFacts(uid), getPastSessions(uid, 50)]);
      setUserMemories(mems || []);
      setUserSessions(sess || []);
    } catch (err) {
      console.error('Failed to load user details:', err);
    } finally {
      setIsLoadingUserDetails(false);
    }
  };

  const handleSelectRecentUser = (username: string) => {
    setSearchQuery(username);
    setIsSearching(true);
    setSearchError(null);
    setSelectedSession(null);

    adminSearchUserByUsername(username)
      .then(({ userProfile }) => {
        if (userProfile) {
          setSelectedUser(userProfile);
          loadUserDetails(userProfile.uid);
        } else {
          setSearchError(`User @${username} record could not be loaded.`);
        }
      })
      .catch((err) => {
        setSearchError(err?.message || 'Error loading user.');
      })
      .finally(() => {
        setIsSearching(false);
      });
  };

  const handleSelectSession = async (session: DbConversationSession) => {
    setSelectedSession(session);
    if (!selectedUser) return;
    setIsLoadingMessages(true);
    try {
      const msgs = await getConversationMessages(selectedUser.uid, session.id);
      setSessionMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Pagination calculation
  const totalPages = Math.ceil(userSessions.length / SESSIONS_PER_PAGE) || 1;
  const paginatedSessions = userSessions.slice(
    (currentPage - 1) * SESSIONS_PER_PAGE,
    currentPage * SESSIONS_PER_PAGE
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[92vh] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Header */}
        <header className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold tracking-wide text-white font-['Space_Grotesk']">
                  RIYA // ADMIN CONTROL PANEL
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  ROOT AUTHORIZED
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Authorized Administrator: <span className="font-mono text-slate-300">{ADMIN_GOOGLE_EMAIL}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close admin panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-5 pt-2 space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'search'
                ? 'border-violet-500 text-violet-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Username Search & Inspection</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              loadRecentUsers();
            }}
            className={`pb-2.5 border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'users'
                ? 'border-violet-500 text-violet-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Registered Users Registry ({recentUsernames.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-2.5 border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'border-violet-500 text-violet-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>System & Privacy Notice</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* TAB 1: USERNAME SEARCH & DETAILS */}
          {activeTab === 'search' && (
            <div className="space-y-5">
              {/* Search Bar */}
              <form onSubmit={handleSearch} className="flex gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by exact username (e.g. harsh_dev)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search User</span>
                </button>
              </form>

              {/* Search Error */}
              {searchError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* User Inspection Dashboard */}
              {selectedUser ? (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* User Profile Summary Card */}
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3.5">
                      {selectedUser.photoURL ? (
                        <img
                          src={selectedUser.photoURL}
                          alt={selectedUser.displayName || 'User'}
                          className="w-14 h-14 rounded-2xl object-cover border border-violet-500/40 shadow-md"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-violet-950 border border-violet-800 flex items-center justify-center text-lg font-bold text-violet-300">
                          {selectedUser.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-bold text-white">
                            @{selectedUser.username || 'unknown'}
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40">
                            {selectedUser.role || 'user'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300">{selectedUser.displayName}</div>
                        <div className="text-[11px] text-slate-500">{selectedUser.email}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] w-full md:w-auto">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">UID</span>
                        <span className="font-mono text-slate-300 truncate block max-w-[120px]">
                          {selectedUser.uid}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Preferred Aura</span>
                        <span className="text-violet-300 font-semibold">{selectedUser.favoriteVibe || 'cyberpunk'}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 col-span-2 sm:col-span-1">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Active</span>
                        <span className="text-slate-300">
                          {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Two Column Inspection: Memories & Conversations */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Left: Saved Memories */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-400">
                          <Brain className="w-4 h-4" />
                          <span>Persistent Memory Vault ({userMemories.length})</span>
                        </div>
                      </div>

                      <div className="mt-3 flex-1 overflow-y-auto space-y-2 max-h-72 pr-1">
                        {isLoadingUserDetails ? (
                          <div className="text-center py-8 text-xs text-slate-500 flex items-center justify-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                            <span>Loading memories...</span>
                          </div>
                        ) : userMemories.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-500 italic">
                            No persistent memory facts recorded yet for this user.
                          </div>
                        ) : (
                          userMemories.map((m) => (
                            <div
                              key={m.id}
                              className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-violet-950 text-violet-300 border border-violet-800/30">
                                  {m.category}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(m.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-slate-200 font-medium">{m.fact}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right: Conversations & Highlights */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-pink-400">
                          <MessageSquare className="w-4 h-4" />
                          <span>Past Conversations ({userSessions.length})</span>
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center space-x-1.5 text-xs">
                            <button
                              disabled={currentPage <= 1}
                              onClick={() => setCurrentPage((p) => p - 1)}
                              className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {currentPage}/{totalPages}
                            </span>
                            <button
                              disabled={currentPage >= totalPages}
                              onClick={() => setCurrentPage((p) => p + 1)}
                              className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex-1 overflow-y-auto space-y-2 max-h-72 pr-1">
                        {isLoadingUserDetails ? (
                          <div className="text-center py-8 text-xs text-slate-500 flex items-center justify-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                            <span>Loading conversations...</span>
                          </div>
                        ) : userSessions.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-500 italic">
                            No voice conversation recaps found for this user.
                          </div>
                        ) : (
                          paginatedSessions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSelectSession(s)}
                              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                                selectedSession?.id === s.id
                                  ? 'bg-pink-950/40 border-pink-500/60 text-white'
                                  : 'bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                <span className="font-semibold text-pink-300">
                                  {new Date(s.createdAt).toLocaleString()}
                                </span>
                                <span className="font-mono text-slate-500">
                                  {s.messageCount ? `${s.messageCount} turns` : 'recap'}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-slate-200 line-clamp-2">
                                {s.summary}
                              </p>
                              {s.highlights && (
                                <p className="text-[11px] text-slate-400 italic mt-1 line-clamp-1">
                                  "{s.highlights}"
                                </p>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Speech Turn Transcript Viewer */}
                  {selectedSession && (
                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Transcript View: {new Date(selectedSession.createdAt).toLocaleTimeString()}</span>
                          </h4>
                          <p className="text-[11px] text-slate-400">{selectedSession.summary}</p>
                        </div>
                        <button
                          onClick={() => setSelectedSession(null)}
                          className="p-1 text-slate-500 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {isLoadingMessages ? (
                          <div className="text-center py-6 text-xs text-slate-500 flex items-center justify-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>Retrieving messages...</span>
                          </div>
                        ) : sessionMessages.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 italic">
                            No individual speech turns recorded for this session.
                          </div>
                        ) : (
                          sessionMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-2.5 rounded-xl text-xs max-w-[85%] ${
                                msg.speaker === 'user'
                                  ? 'ml-auto bg-violet-950/80 border border-violet-800/50 text-violet-100'
                                  : 'mr-auto bg-slate-800/80 border border-slate-700/60 text-slate-200'
                              }`}
                            >
                              <div className="text-[10px] font-bold uppercase mb-0.5 opacity-70">
                                {msg.speaker === 'user' ? `@${selectedUser.username}` : 'Riya'}
                              </div>
                              <p>{msg.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <Search className="w-10 h-10 mx-auto text-slate-700" />
                  <p className="text-xs font-medium">
                    Search any user by their unique @username above or pick from the registry to inspect their profile, memories, and past chats.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REGISTERED USERS REGISTRY */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Global Usernames Index ({recentUsernames.length})
                </span>
                <button
                  onClick={loadRecentUsers}
                  disabled={isLoadingRecent}
                  className="flex items-center space-x-1 text-xs text-violet-400 hover:text-violet-300 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecent ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingRecent ? (
                <div className="text-center py-12 text-xs text-slate-500 flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  <span>Loading registry...</span>
                </div>
              ) : recentUsernames.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 italic">
                  No usernames claimed yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {recentUsernames.map((u) => (
                    <button
                      key={u.usernameNormalized}
                      onClick={() => {
                        handleSelectRecentUser(u.username);
                        setActiveTab('search');
                      }}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/60 hover:bg-slate-850 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-sm text-white group-hover:text-violet-300">
                          @{u.username}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 text-violet-400 transition-all" />
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        UID: {u.uid}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Reserved: {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM & PRIVACY NOTICE */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              {/* Privacy Notice Box */}
              <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-800/40 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-violet-300 font-bold uppercase text-[11px] tracking-wider">
                  <Info className="w-4 h-4" />
                  <span>Administrative Access & Privacy Notice</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Authorized administrators have read access to user profile metadata, persistent memory facts, and past conversation logs strictly for legitimate operational, support, moderation, and auditing purposes.
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Firebase Authentication handles all credentials; passwords and private OAuth tokens are never accessible or stored in Firestore.
                </p>
              </div>

              {/* Architecture & Stats */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Admin Google Identity</div>
                  <div className="font-mono text-emerald-400 font-semibold mt-1 truncate">{ADMIN_GOOGLE_EMAIL}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Live Model</div>
                  <div className="font-mono text-cyan-300 font-semibold mt-1">gemini-3.1-flash-live-preview</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Firestore Registry</div>
                  <div className="font-mono text-violet-300 font-semibold mt-1">usernames/{"{normalized}"}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">User Isolation</div>
                  <div className="font-mono text-pink-300 font-semibold mt-1">users/{"{uid}"}/**</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            Riya Neural AI &middot; Administrative Audit Mode
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
          >
            Close Panel
          </button>
        </footer>
      </div>
    </div>
  );
};
