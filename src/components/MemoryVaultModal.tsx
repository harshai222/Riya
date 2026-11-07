import React, { useState } from 'react';
import {
  DbUserProfile,
  DbMemoryFact,
  DbConversationSession,
  User,
  signInWithGoogle,
  signOutUser,
} from '../lib/firebase';
import { VibeType, VIBE_CONFIGS } from '../utils/sessionTypes';
import {
  Brain,
  X,
  Plus,
  Trash2,
  LogIn,
  LogOut,
  Sparkles,
  MessageSquare,
  BookmarkCheck,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

interface MemoryVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  profile: DbUserProfile | null;
  memories: DbMemoryFact[];
  pastSessions: DbConversationSession[];
  onSaveProfile: (preferredName: string, favoriteVibe: VibeType) => Promise<void>;
  onAddMemory: (category: string, fact: string) => Promise<void>;
  onDeleteMemory: (memoryId: string) => Promise<void>;
}

export const MemoryVaultModal: React.FC<MemoryVaultModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  profile,
  memories,
  pastSessions,
  onSaveProfile,
  onAddMemory,
  onDeleteMemory,
}) => {
  const [nameInput, setNameInput] = useState(profile?.preferredName || '');
  const [vibeInput, setVibeInput] = useState<VibeType>(
    (profile?.favoriteVibe as VibeType) || 'cyberpunk'
  );
  const [newCategory, setNewCategory] = useState('personal');
  const [newFact, setNewFact] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'memories' | 'sessions' | 'profile'>('memories');
  const [authLoading, setAuthLoading] = useState(false);

  // Sync inputs when profile changes
  React.useEffect(() => {
    if (profile) {
      setNameInput(profile.preferredName);
      if (profile.favoriteVibe) {
        setVibeInput(profile.favoriteVibe as VibeType);
      }
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setIsSaving(true);
    try {
      await onSaveProfile(nameInput.trim(), vibeInput);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    setIsSaving(true);
    try {
      await onAddMemory(newCategory, newFact.trim());
      setNewFact('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    try {
      if (currentUser) {
        await signOutUser();
      } else {
        await signInWithGoogle();
      }
    } catch (err) {
      console.error('Google Auth Error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-700/60 text-violet-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                <span>Riya's Memory Vault</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-900/60 text-violet-300 border border-violet-700/40">
                  Firestore
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Persistent preferences & conversation history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close memory vault"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Auth Banner */}
        <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-violet-500/50 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-950 border border-violet-800 flex items-center justify-center text-xs text-violet-300 font-bold">
                {profile?.preferredName ? profile.preferredName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="text-xs">
              <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <span>{currentUser?.displayName || profile?.preferredName || 'Authenticated User'}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                  Secured
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                {currentUser?.email || 'Google Account'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleGoogleAuth}
              disabled={authLoading}
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/60 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 bg-slate-950 px-5 pt-2 space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('memories')}
            className={`pb-2.5 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'memories'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>Remembered Facts ({memories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'profile'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Profile & Name</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`pb-2.5 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'sessions'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Past Chats ({pastSessions.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          {/* TAB 1: MEMORIES */}
          {activeTab === 'memories' && (
            <div className="space-y-4">
              {/* Add Memory Form */}
              <form
                onSubmit={handleAddMemorySubmit}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                    Teach Riya a new memory
                  </span>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-md px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-violet-500"
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Work / Tech</option>
                    <option value="hobby">Hobby / Music</option>
                    <option value="preference">Food & Drink</option>
                    <option value="relationship">Relationship</option>
                  </select>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newFact}
                    onChange={(e) => setNewFact(e.target.value)}
                    placeholder="e.g. My golden retriever is named Bruno, and I drink matcha"
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={isSaving || !newFact.trim()}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-all flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Remember</span>
                  </button>
                </div>
              </form>

              {/* Memory List */}
              <div className="space-y-2">
                {memories.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 space-y-1">
                    <Sparkles className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                    <p className="font-semibold">Riya hasn't stored any memories yet.</p>
                    <p className="text-[11px]">
                      Just speak normally! Whenever you mention facts (pets, favorites, jobs), Riya will remember them automatically.
                    </p>
                  </div>
                ) : (
                  memories.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all group"
                    >
                      <div className="space-y-1 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-violet-950 text-violet-300 border border-violet-800/50">
                            {m.category}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-200">{m.fact}</p>
                      </div>
                      <button
                        onClick={() => onDeleteMemory(m.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition-colors opacity-70 group-hover:opacity-100"
                        title="Delete memory"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-800/40">
                <h4 className="font-bold text-violet-300 text-xs mb-1">
                  How Riya Knows You
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Riya uses your nickname to address you like a real friend during voice chats. She also tunes her mood to your preferred ambient vibe.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Your Preferred Name / Nickname
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Harsh, Boss, Captain"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Default Aura Vibe
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(VIBE_CONFIGS).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVibeInput(v.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                        vibeInput === v.id
                          ? 'bg-violet-950/70 border-violet-500 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: v.accentColor }}
                      />
                      <span className="font-semibold text-xs">{v.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving || !nameInput.trim()}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PAST CONVERSATIONS */}
          {activeTab === 'sessions' && (
            <div className="space-y-3">
              {pastSessions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 space-y-1">
                  <MessageSquare className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                  <p className="font-semibold">No voice conversations recorded yet.</p>
                  <p className="text-[11px]">
                    When you end a voice session with Riya, a recap of what you discussed is automatically archived here!
                  </p>
                </div>
              ) : (
                pastSessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">
                        {new Date(s.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {s.vibeUsed && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold">
                          {s.vibeUsed}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {s.summary}
                    </p>
                    {s.highlights && (
                      <p className="text-[11px] text-violet-400 italic">
                        "{s.highlights}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/30 flex justify-between items-center text-[11px] text-slate-400">
          <span>Synced directly with Firebase Firestore</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
