import React, { useState, useEffect } from 'react';
import {
  User,
  DbUserProfile,
  DbMemoryFact,
  DbConversationSession,
  DbConversationMessage,
  DbUsernameReservation,
  AdminGeminiConfig,
  adminSearchUserByUsername,
  adminListRecentUsernames,
  adminGetGeminiConfig,
  adminUpdateGeminiConfig,
  adminTestGeminiConfig,
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
  Settings,
  Database,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Activity,
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'users' | 'api_config'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected User State
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

  // API Configuration State
  const [geminiConfig, setGeminiConfig] = useState<AdminGeminiConfig | null>(null);
  const [isLoadingConfig, setIsLoadingRecentConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingConfig, setIsTestingConfig] = useState(false);
  
  // Config Edit Form
  const [editModel, setEditModel] = useState('');
  const [editVoice, setEditVoice] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Pagination for conversation sessions
  const [currentPage, setCurrentPage] = useState(1);
  const SESSIONS_PER_PAGE = 5;

  const isAdmin = isUserAdmin(currentUser);

  useEffect(() => {
    if (isOpen && isAdmin) {
      if (activeTab === 'users') loadRecentUsers();
      if (activeTab === 'api_config') loadGeminiConfig();
    }
  }, [isOpen, isAdmin, activeTab]);

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

  const loadGeminiConfig = async () => {
    setIsLoadingRecentConfig(true);
    setConfigError(null);
    try {
      const config = await adminGetGeminiConfig();
      setGeminiConfig(config);
      setEditModel(config.activeModel);
      setEditVoice(config.activeVoice);
    } catch (err: any) {
      console.error('Failed to load config:', err);
      setConfigError(err.message || 'Failed to retrieve global configuration.');
    } finally {
      setIsLoadingRecentConfig(false);
    }
  };

  if (!isOpen) return null;

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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;
    setIsSearching(true);
    setSearchError(null);
    setSelectedSession(null);
    try {
      const { userProfile } = await adminSearchUserByUsername(queryStr);
      if (!userProfile) {
        setSearchError(`No user found matching "@${queryStr}" or UID "${queryStr}".`);
        setSelectedUser(null);
      } else {
        setSelectedUser(userProfile);
        loadUserDetails(userProfile.uid);
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Error occurred while querying registry.');
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
    handleSearch();
    setActiveTab('search');
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

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigError(null);
    setConfigSuccess(null);
    try {
      const res = await adminUpdateGeminiConfig({
        activeModel: editModel || undefined,
        activeVoice: editVoice || undefined,
        apiKey: editApiKey || undefined,
      });
      const message = editApiKey 
        ? 'Gemini API Key updated and verified in Firestore successfully.' 
        : (res.message || 'Configuration updated successfully.');
      setConfigSuccess(message);
      setEditApiKey('');
      loadGeminiConfig();
    } catch (err: any) {
      setConfigError(err.message || 'Failed to save configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConfig = async () => {
    setIsTestingConfig(true);
    setConfigError(null);
    setConfigSuccess(null);
    try {
      const res = await adminTestGeminiConfig({
        activeModel: editModel || undefined,
        apiKey: editApiKey || undefined,
      });
      setConfigSuccess(`[${res.category || 'Success'}] ${res.message}`);
    } catch (err: any) {
      setConfigError(err.message || 'API configuration test failed.');
    } finally {
      setIsTestingConfig(false);
    }
  };

  const totalPages = Math.ceil(userSessions.length / SESSIONS_PER_PAGE) || 1;
  const paginatedSessions = userSessions.slice(
    (currentPage - 1) * SESSIONS_PER_PAGE,
    currentPage * SESSIONS_PER_PAGE
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[92vh] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
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
                Administrator: <span className="font-mono text-slate-300">{ADMIN_GOOGLE_EMAIL}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex border-b border-slate-800 bg-slate-950 px-5 pt-2 space-x-6 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('search')} className={`pb-2.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${activeTab === 'search' ? 'border-violet-500 text-violet-300 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Search className="w-4 h-4" />
            <span>Search & Inspection</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`pb-2.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${activeTab === 'users' ? 'border-violet-500 text-violet-300 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <UserIcon className="w-4 h-4" />
            <span>User Registry</span>
          </button>
          <button onClick={() => setActiveTab('api_config')} className={`pb-2.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${activeTab === 'api_config' ? 'border-violet-500 text-violet-300 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Settings className="w-4 h-4" />
            <span>API Configuration</span>
          </button>
          <button onClick={() => setActiveTab('dashboard')} className={`pb-2.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${activeTab === 'dashboard' ? 'border-violet-500 text-violet-300 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Sliders className="w-4 h-4" />
            <span>System & Privacy</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* TAB: API CONFIGURATION */}
          {activeTab === 'api_config' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Status Header */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-lg ${geminiConfig?.status === 'active' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' : 'bg-rose-950/40 border-rose-500/40 text-rose-400'}`}>
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Gemini Live Active Status</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${geminiConfig?.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                        {geminiConfig?.status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        v{geminiConfig?.version || 0} &middot; Last Update: {geminiConfig?.updatedAt ? new Date(geminiConfig.updatedAt).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={loadGeminiConfig} disabled={isLoadingConfig} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${isLoadingConfig ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Messages */}
              {configError && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start space-x-3 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span className="leading-relaxed">{configError}</span>
                </div>
              )}
              {configSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-start space-x-3 animate-in slide-in-from-top-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="leading-relaxed">{configSuccess}</span>
                </div>
              )}

              {/* Configuration Form */}
              <form onSubmit={handleSaveConfig} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Target Gemini Model</label>
                      <span className="text-[10px] text-cyan-400">Live API</span>
                    </div>
                    <input 
                      type="text" 
                      value={editModel} 
                      onChange={(e) => setEditModel(e.target.value)}
                      placeholder="gemini-3.1-flash-live-preview"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-cyan-300 focus:outline-none focus:border-violet-500"
                    />
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-[10px] text-slate-500">Quick set:</span>
                      <button type="button" onClick={() => setEditModel('gemini-3.1-flash-live-preview')} className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/40">gemini-3.1-flash-live-preview</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Prebuilt Voice</label>
                    <input 
                      type="text" 
                      value={editVoice} 
                      onChange={(e) => setEditVoice(e.target.value)}
                      placeholder="Lyra, Aoede, Charon..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-pink-300 focus:outline-none focus:border-violet-500"
                    />
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-[10px] text-slate-500">Voices:</span>
                      <button type="button" onClick={() => setEditVoice('Lyra')} className="text-[10px] px-2 py-0.5 rounded bg-pink-950 hover:bg-pink-900 text-pink-300 border border-pink-800/40">Lyra</button>
                      <button type="button" onClick={() => setEditVoice('Charon')} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">Charon</button>
                      <button type="button" onClick={() => setEditVoice('Fenrir')} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">Fenrir</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Privileged Gemini API Key</label>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-slate-300">
                        <Lock className="w-4 h-4 text-emerald-500" />
                        <span>Current Key: <strong className="font-mono text-emerald-400">{geminiConfig?.apiKeyMasked}</strong></span>
                        {geminiConfig?.isUsingEnvKey && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/40">From Env</span>}
                      </div>
                    </div>
                    
                    <div className="relative">
                      <input 
                        type={showApiKey ? 'text' : 'password'} 
                        value={editApiKey}
                        onChange={(e) => setEditApiKey(e.target.value)}
                        placeholder="Replace with new API Key (Paste key to update)..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 italic flex items-center space-x-1">
                      <Info className="w-3 h-3 shrink-0" />
                      <span>The key is stored server-side in a restricted document. It is never sent to users.</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={isSavingConfig}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isSavingConfig ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    <span>Save & Activate Configuration</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={handleTestConfig}
                    disabled={isTestingConfig || isSavingConfig}
                    className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl border border-slate-700 transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isTestingConfig ? <Loader2 className="w-5 h-5 animate-spin text-cyan-400" /> : <Activity className="w-5 h-5 text-cyan-400" />}
                    <span>Test</span>
                  </button>
                </div>
              </form>

              {/* Safety Warning */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-[11px] text-amber-200/80 leading-relaxed">
                  <strong className="block text-amber-400 mb-0.5 uppercase">Critical: Production Configuration</strong>
                  Updating these values affects all users globally in real-time. New voice sessions will use the updated model and voice configuration immediately. Ensure your API Key has the necessary quotas and permissions for bidirectional audio streaming.
                </div>
              </div>
            </div>
          )}

          {/* TAB: SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-5">
              <form onSubmit={handleSearch} className="flex gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Search by username or 10-11 digit UID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-violet-500 font-mono" />
                </div>
                <button type="submit" disabled={isSearching || !searchQuery.trim()} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center space-x-2 disabled:opacity-50">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search User</span>
                </button>
              </form>

              {searchError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {selectedUser ? (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3.5">
                      {selectedUser.photoURL ? (
                        <img src={selectedUser.photoURL} alt={selectedUser.displayName || 'User'} className="w-14 h-14 rounded-2xl object-cover border border-violet-500/40" />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-violet-950 border border-violet-800 flex items-center justify-center text-lg font-bold text-violet-300">
                          {selectedUser.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-bold text-white">@{selectedUser.username}</h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40">{selectedUser.role}</span>
                        </div>
                        <div className="text-xs text-slate-300">{selectedUser.displayName}</div>
                        <div className="text-[11px] text-slate-500">{selectedUser.email}</div>
                        <div className="mt-1 flex items-center space-x-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Public UID:</span>
                          <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-800/30">
                            {selectedUser.publicUid || 'PENDING MIGRATION'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col h-80">
                      <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-400 pb-3 border-b border-slate-800">
                        <Brain className="w-4 h-4" />
                        <span>Memory Vault ({userMemories.length})</span>
                      </div>
                      <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
                        {isLoadingUserDetails ? <div className="text-center py-8 text-xs text-slate-500">Loading...</div> : userMemories.map(m => (
                          <div key={m.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                            <div className="flex justify-between mb-1 text-[10px] opacity-60">
                              <span className="uppercase font-bold">{m.category}</span>
                              <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-200 font-medium">{m.fact}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col h-80">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-pink-400">
                          <MessageSquare className="w-4 h-4" />
                          <span>Conversations ({userSessions.length})</span>
                        </div>
                      </div>
                      <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
                        {isLoadingUserDetails ? <div className="text-center py-8 text-xs text-slate-500">Loading...</div> : paginatedSessions.map(s => (
                          <button key={s.id} onClick={() => handleSelectSession(s)} className={`w-full text-left p-3 rounded-xl border transition-all ${selectedSession?.id === s.id ? 'bg-pink-950/40 border-pink-500/60' : 'bg-slate-950 border-slate-800/80 hover:bg-slate-900'}`}>
                            <div className="text-[10px] text-pink-300 font-semibold mb-1">{new Date(s.createdAt).toLocaleString()}</div>
                            <p className="text-xs text-slate-200 line-clamp-2">{s.summary}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedSession && (
                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Transcript View: {new Date(selectedSession.createdAt).toLocaleTimeString()}</span>
                        </h4>
                        <button onClick={() => setSelectedSession(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {isLoadingMessages ? <div className="text-center py-6 text-xs text-slate-500">Retrieving...</div> : sessionMessages.map(msg => (
                          <div key={msg.id} className={`p-2.5 rounded-xl text-xs max-w-[85%] ${msg.speaker === 'user' ? 'ml-auto bg-violet-950/80 border border-violet-800/50' : 'mr-auto bg-slate-800/80 border border-slate-700/60'}`}>
                            <div className="text-[9px] font-bold uppercase mb-0.5 opacity-50">{msg.speaker === 'user' ? `@${selectedUser.username}` : 'Riya'}</div>
                            <p>{msg.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <Search className="w-10 h-10 mx-auto text-slate-700" />
                  <p className="text-xs font-medium text-slate-600">Search any user to inspect their profile and history.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: USERS REGISTRY */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered Usernames Index</span>
                <button onClick={loadRecentUsers} className="flex items-center space-x-1 text-xs text-violet-400 hover:text-violet-300">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecent ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {recentUsernames.map(u => (
                  <button key={u.usernameNormalized} onClick={() => handleSelectRecentUser(u.username)} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/60 transition-all text-left">
                    <div className="font-mono font-bold text-sm text-white">@{u.username}</div>
                    <div className="text-[9px] font-mono text-slate-600 truncate mt-1">Registry Record &middot; Active</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DASHBOARD / INFO */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-800/40 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-violet-300 font-bold uppercase tracking-wider">
                  <Info className="w-4 h-4" />
                  <span>Administrative Policy</span>
                </div>
                <p className="text-slate-300 leading-relaxed">Administrators have read access to user data for operational support, moderation, and auditing. API credentials are securely managed and never exposed to normal users.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Config Version</div>
                  <div className="font-mono text-emerald-400 font-semibold mt-1">v{geminiConfig?.version || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">API Key Status</div>
                  <div className="font-mono text-cyan-300 font-semibold mt-1">{geminiConfig?.apiKeyMasked}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Riya Neural AI &middot; Audit Mode</span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer">Close Panel</button>
        </footer>
      </div>
    </div>
  );
};
