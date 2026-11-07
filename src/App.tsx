import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveSessionStatus,
  VibeType,
  VIBE_CONFIGS,
  ActiveTimer,
  OpenedLinkAction,
  ToolCallExecution,
  LiveTranscriptItem,
} from './utils/sessionTypes';
import { LiveClient } from './services/LiveClient';
import { HeaderHUD } from './components/HeaderHUD';
import { RiyaCoreOrb } from './components/RiyaCoreOrb';
import { ToolWidgets } from './components/ToolWidgets';
import { ConversationStarters } from './components/ConversationStarters';
import { CaptionsOverlay } from './components/CaptionsOverlay';
import { SettingsModal } from './components/SettingsModal';
import { MemoryVaultModal } from './components/MemoryVaultModal';
import { AuthScreen } from './components/AuthScreen';
import { UsernameSetupScreen } from './components/UsernameSetupScreen';
import { AdminPanelModal } from './components/AdminPanelModal';
import {
  auth,
  onAuthStateChanged,
  User,
  DbUserProfile,
  DbMemoryFact,
  DbConversationSession,
  DbConversationMessage,
  syncUserProfileOnLogin,
  saveUserProfile,
  getMemoryFacts,
  addMemoryFact,
  deleteMemoryFact,
  forgetFactByQuery,
  saveConversationSession,
  getPastSessions,
  signOutUser,
  isUserAdmin,
} from './lib/firebase';
import { AlertCircle, X, Sparkles, Brain } from 'lucide-react';

export default function App() {
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [status, setStatus] = useState<LiveSessionStatus>('disconnected');
  const [currentVibeId, setCurrentVibeId] = useState<VibeType>('cyberpunk');
  const [userVolume, setUserVolume] = useState<number>(0);
  const [riyaVolume, setRiyaVolume] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [openedLinks, setOpenedLinks] = useState<OpenedLinkAction[]>([]);
  const [latestToolCall, setLatestToolCall] = useState<ToolCallExecution | null>(null);
  const [latestTranscript, setLatestTranscript] = useState<LiveTranscriptItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMemoryVaultOpen, setIsMemoryVaultOpen] = useState<boolean>(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);

  // Authenticated Per-User Database Memory State
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [memories, setMemories] = useState<DbMemoryFact[]>([]);
  const [pastSessions, setPastSessions] = useState<DbConversationSession[]>([]);

  const clientRef = useRef<LiveClient | null>(null);
  const sessionTranscriptsRef = useRef<LiveTranscriptItem[]>([]);
  const activeSessionStartRef = useRef<number | null>(null);
  const memoriesRef = useRef<DbMemoryFact[]>([]);
  memoriesRef.current = memories;

  // Active Vibe configuration
  const vibe = VIBE_CONFIGS[currentVibeId] || VIBE_CONFIGS.cyberpunk;

  // Listen for #admin or /admin in URL
  useEffect(() => {
    const handleLocationCheck = () => {
      if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
        setIsAdminPanelOpen(true);
      }
    };
    handleLocationCheck();
    window.addEventListener('hashchange', handleLocationCheck);
    return () => window.removeEventListener('hashchange', handleLocationCheck);
  }, []);

  // Firebase Auth State Listener & Per-User Isolation Loader
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // If user signed out or changed, immediately disconnect active live voice session
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
      setStatus('disconnected');
      sessionTranscriptsRef.current = [];
      activeSessionStartRef.current = null;

      setCurrentUser(user);

      if (user) {
        try {
          // Sync safe Google account info into users/{uid}
          const userProfile = await syncUserProfileOnLogin(user);
          setProfile(userProfile);

          if (userProfile.favoriteVibe && VIBE_CONFIGS[userProfile.favoriteVibe as VibeType]) {
            setCurrentVibeId(userProfile.favoriteVibe as VibeType);
          }

          // If user already has a claimed username, load their isolated database records
          if (userProfile.username) {
            const facts = await getMemoryFacts(user.uid);
            setMemories(facts || []);

            const sessions = await getPastSessions(user.uid);
            setPastSessions(sessions || []);
          }
        } catch (err) {
          console.error('Failed to load user data from Firestore:', err);
        }
      } else {
        // Complete state teardown on sign out - ensures zero cross-user data leakage
        setProfile(null);
        setMemories([]);
        setPastSessions([]);
        setActiveTimers([]);
        setOpenedLinks([]);
        setLatestToolCall(null);
        setLatestTranscript(null);
        setIsAdminPanelOpen(false);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // When username is claimed for first time, load initial records
  const handleUsernameClaimed = async (updatedProfile: DbUserProfile) => {
    setProfile(updatedProfile);
    if (currentUser) {
      try {
        const [facts, sessions] = await Promise.all([
          getMemoryFacts(currentUser.uid),
          getPastSessions(currentUser.uid),
        ]);
        setMemories(facts || []);
        setPastSessions(sessions || []);
      } catch (err) {
        console.error('Error loading initial user data after username claim:', err);
      }
    }
  };

  // Handle client callbacks
  const handleStatusChange = useCallback(
    async (newStatus: LiveSessionStatus) => {
      setStatus(newStatus);
      if (newStatus === 'listening') {
        setErrorMessage(null);
        if (!activeSessionStartRef.current) {
          activeSessionStartRef.current = Date.now();
        }
      }

      // When call ends, save conversation recap and speech turns into Firestore under users/{uid}/conversations
      if (newStatus === 'disconnected' && activeSessionStartRef.current && currentUser) {
        const dialogHistory = sessionTranscriptsRef.current;
        if (dialogHistory.length >= 2) {
          const userSnippets = dialogHistory
            .filter((d) => d.speaker === 'user')
            .map((d) => d.text)
            .join(' | ');
          const riyaSnippets = dialogHistory
            .filter((d) => d.speaker === 'riya')
            .map((d) => d.text)
            .slice(-1)[0];

          const sessionId = 'conv_' + Date.now();
          const recapSession: DbConversationSession = {
            id: sessionId,
            userId: currentUser.uid,
            summary: userSnippets ? `Discussed: ${userSnippets.slice(0, 160)}` : 'Voice chat with Riya',
            vibeUsed: vibe.name,
            highlights: riyaSnippets ? riyaSnippets.slice(0, 140) : undefined,
            messageCount: dialogHistory.length,
            createdAt: new Date().toISOString(),
          };

          const messages: DbConversationMessage[] = dialogHistory.map((item, idx) => ({
            id: `msg_${idx}_${Date.now()}`,
            conversationId: sessionId,
            userId: currentUser.uid,
            speaker: item.speaker,
            text: item.text,
            createdAt: new Date(item.timestamp).toISOString(),
          }));

          try {
            await saveConversationSession(recapSession, messages);
            setPastSessions((prev) => [recapSession, ...prev.slice(0, 14)]);
          } catch (e) {
            console.error('Failed to log conversation session to Firestore:', e);
          }
        }
        activeSessionStartRef.current = null;
        sessionTranscriptsRef.current = [];
      }
    },
    [currentUser, vibe.name]
  );

  const handleUserVolume = useCallback((vol: number) => {
    setUserVolume(vol);
  }, []);

  const handleRiyaVolume = useCallback((vol: number) => {
    setRiyaVolume(vol);
  }, []);

  const handleTranscript = useCallback((item: LiveTranscriptItem) => {
    setLatestTranscript(item);
    sessionTranscriptsRef.current.push(item);
  }, []);

  const handleToolExecute = useCallback(
    async (tool: ToolCallExecution) => {
      setLatestToolCall(tool);
      if (!currentUser) return;
      const uid = currentUser.uid;

      if (tool.toolName === 'openWebsite') {
        const url = tool.args.url;
        const targetName = tool.args.targetName || 'Link';
        if (url) {
          try {
            window.open(url, '_blank', 'noopener,noreferrer');
          } catch (e) {
            console.warn('Popup blocked, rendered in UI card');
          }

          setOpenedLinks((prev) => [
            {
              id: 'link-' + Date.now(),
              url,
              targetName,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 4),
          ]);
        }
      } else if (tool.toolName === 'changeVibe') {
        const newVibe = tool.args.vibe as VibeType;
        if (newVibe && VIBE_CONFIGS[newVibe]) {
          setCurrentVibeId(newVibe);
          if (profile) {
            const updatedProfile = {
              ...profile,
              favoriteVibe: newVibe,
              updatedAt: new Date().toISOString(),
            };
            setProfile(updatedProfile);
            saveUserProfile(updatedProfile).catch(console.error);
          }
        }
      } else if (tool.toolName === 'setTimer') {
        const seconds = Number(tool.args.seconds) || 60;
        const label = tool.args.label || 'Timer';
        setActiveTimers((prev) => [
          {
            id: 'timer-' + Date.now(),
            label,
            durationSeconds: seconds,
            remainingSeconds: seconds,
            createdAt: Date.now(),
          },
          ...prev,
        ]);
      } else if (tool.toolName === 'rememberFact') {
        const category = tool.args.category || 'personal';
        const fact = tool.args.fact || '';
        if (fact) {
          try {
            const savedFact = await addMemoryFact(uid, category, fact);
            setMemories((prev) => [savedFact, ...prev]);
            setMemoryNotice(`Riya saved to memory: "${fact}"`);
            setTimeout(() => setMemoryNotice(null), 4500);
          } catch (err) {
            console.error('Failed to save memory fact:', err);
          }
        }
      } else if (tool.toolName === 'forgetFact') {
        const factQuery = tool.args.factQuery || '';
        if (factQuery) {
          try {
            const removed = await forgetFactByQuery(uid, factQuery, memoriesRef.current);
            if (removed) {
              setMemories((prev) => prev.filter((m) => m.id !== removed.id));
              setMemoryNotice(`Riya forgot memory: "${removed.fact}"`);
            } else {
              setMemoryNotice(`Riya noted request to forget: "${factQuery}"`);
            }
            setTimeout(() => setMemoryNotice(null), 4500);
          } catch (err) {
            console.error('Failed to remove memory fact:', err);
          }
        }
      } else if (tool.toolName === 'updatePreferences') {
        const preferredName = tool.args.preferredName;
        const favoriteVibe = tool.args.favoriteVibe as VibeType;
        if (favoriteVibe && VIBE_CONFIGS[favoriteVibe]) {
          setCurrentVibeId(favoriteVibe);
        }
        if (preferredName || favoriteVibe) {
          const updated: DbUserProfile = {
            uid,
            username: profile?.username,
            usernameNormalized: profile?.usernameNormalized,
            displayName: currentUser.displayName || profile?.displayName,
            email: currentUser.email || profile?.email,
            photoURL: currentUser.photoURL || profile?.photoURL,
            preferredName: preferredName || profile?.preferredName || profile?.username || 'Friend',
            favoriteVibe: favoriteVibe || currentVibeId,
            role: profile?.role,
            onboardingCompleted: profile?.onboardingCompleted ?? true,
            createdAt: profile?.createdAt || new Date().toISOString(),
            lastLoginAt: profile?.lastLoginAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setProfile(updated);
          saveUserProfile(updated).catch(console.error);
          setMemoryNotice(`Preferences updated: Calling you "${updated.preferredName}"`);
          setTimeout(() => setMemoryNotice(null), 4000);
        }
      }

      // Auto-clear tool highlight after 3.5s
      setTimeout(() => {
        setLatestToolCall((curr) => (curr?.id === tool.id ? null : curr));
      }, 3500);
    },
    [currentUser, currentVibeId, profile]
  );

  const handleError = useCallback((msg: string) => {
    setErrorMessage(msg);
  }, []);

  // Initialize LiveClient
  useEffect(() => {
    clientRef.current = new LiveClient({
      onStatusChange: handleStatusChange,
      onUserVolume: handleUserVolume,
      onRiyaVolume: handleRiyaVolume,
      onTranscript: handleTranscript,
      onToolExecute: handleToolExecute,
      onError: handleError,
    });

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [
    handleStatusChange,
    handleUserVolume,
    handleRiyaVolume,
    handleTranscript,
    handleToolExecute,
    handleError,
  ]);

  const toggleConnect = async () => {
    if (!clientRef.current || !currentUser) return;

    if (status === 'disconnected') {
      setErrorMessage(null);

      // Package relevant persistent memory context for Riya
      const relevantMemories = memories.slice(0, 15).map((m) => ({
        category: m.category,
        fact: m.fact,
      }));
      const recentRecaps = pastSessions.slice(0, 3).map((s) => ({
        summary: s.summary,
      }));

      const memoryContext = {
        preferredName: profile?.preferredName || profile?.username || currentUser.displayName?.split(' ')[0] || 'Friend',
        username: profile?.username,
        favoriteVibe: currentVibeId,
        memories: relevantMemories,
        pastConversations: recentRecaps,
      };

      await clientRef.current.connect(memoryContext);
    } else {
      clientRef.current.disconnect();
    }
  };

  const toggleMute = () => {
    if (!clientRef.current) return;
    const nextMute = !isMuted;
    clientRef.current.setMuted(nextMute);
    setIsMuted(nextMute);
  };

  const handleSelectPrompt = (prompt: string) => {
    setSpeechHint(`Say out loud to Riya: "${prompt}"`);
    setTimeout(() => setSpeechHint(null), 4500);

    if (status === 'disconnected') {
      toggleConnect();
    }
  };

  const handleSignOut = async () => {
    try {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
      await signOutUser();
    } catch (err) {
      console.error('Sign Out Error:', err);
    }
  };

  // Memory Vault actions
  const handleSaveProfile = async (preferredName: string, favoriteVibe: VibeType) => {
    if (!currentUser) return;
    const updated: DbUserProfile = {
      uid: currentUser.uid,
      username: profile?.username,
      usernameNormalized: profile?.usernameNormalized,
      displayName: currentUser.displayName || profile?.displayName,
      email: currentUser.email || profile?.email,
      photoURL: currentUser.photoURL || profile?.photoURL,
      preferredName,
      favoriteVibe,
      role: profile?.role,
      onboardingCompleted: profile?.onboardingCompleted ?? true,
      createdAt: profile?.createdAt || new Date().toISOString(),
      lastLoginAt: profile?.lastLoginAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveUserProfile(updated);
    setProfile(updated);
    setCurrentVibeId(favoriteVibe);
    setMemoryNotice(`Profile saved! Riya will call you "${preferredName}".`);
    setTimeout(() => setMemoryNotice(null), 4000);
  };

  const handleAddMemory = async (category: string, fact: string) => {
    if (!currentUser) return;
    const record = await addMemoryFact(currentUser.uid, category, fact);
    setMemories((prev) => [record, ...prev]);
    setMemoryNotice(`Memory saved: "${fact}"`);
    setTimeout(() => setMemoryNotice(null), 4000);
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!currentUser) return;
    await deleteMemoryFact(currentUser.uid, memoryId);
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
  };

  // 1. Initial Auth Token Checking Screen
  if (authLoading) {
    return (
      <div className="w-screen h-screen bg-[#07080d] flex flex-col items-center justify-center text-slate-300">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin flex items-center justify-center" />
          <Sparkles className="w-6 h-6 text-violet-400 absolute inset-0 m-auto" />
        </div>
        <p className="text-xs font-mono tracking-widest text-violet-300 uppercase">
          INITIALIZING SECURE SESSION...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated: Show Polished Google Sign-In Screen
  if (!currentUser) {
    return <AuthScreen onSignedIn={() => {}} />;
  }

  // 3. First-Time Login: Username Setup Screen (mandatory globally unique username)
  if (!profile?.username) {
    return (
      <UsernameSetupScreen
        currentUser={currentUser}
        currentProfile={profile}
        onUsernameClaimed={handleUsernameClaimed}
        onSignOut={handleSignOut}
      />
    );
  }

  // 4. Authenticated & Onboarded: Full Riya Voice-to-Voice Companion Experience
  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col justify-between select-none transition-colors duration-1000 bg-[#07080d]"
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${vibe.primaryGlow}15 0%, #07080d 70%)`,
      }}
    >
      {/* Dynamic ambient cyber glow background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 transition-all duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, ${vibe.secondaryGlow} 0%, transparent 60%)`,
        }}
      />

      {/* Top Header HUD with Profile Avatar, Username, Admin Button & Sign Out */}
      <HeaderHUD
        status={status}
        currentVibe={vibe}
        userVolume={userVolume}
        riyaVolume={riyaVolume}
        memoryCount={memories.length}
        currentUser={currentUser}
        username={profile?.username}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenMemoryVault={() => setIsMemoryVaultOpen(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        onSelectVibe={(v) => setCurrentVibeId(v)}
        onSignOut={handleSignOut}
      />

      {/* Main Interactive Stage */}
      <main className="relative flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 overflow-y-auto no-scrollbar z-10">
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="w-full max-w-md mx-auto mb-3 p-3.5 rounded-2xl bg-rose-950/90 border border-rose-800/80 shadow-2xl backdrop-blur-xl flex flex-col space-y-2 text-rose-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed">
                <strong className="block text-rose-300 font-semibold mb-0.5">
                  Audio Connection Notice
                </strong>
                {errorMessage}
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white p-1"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {(errorMessage.toLowerCase().includes('microphone') ||
              errorMessage.toLowerCase().includes('permission') ||
              errorMessage.toLowerCase().includes('denied')) && (
              <div className="flex items-center space-x-2 pt-1 border-t border-rose-900/60 justify-end">
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    toggleConnect();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-semibold transition-colors"
                >
                  Try Again
                </button>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center space-x-1"
                >
                  <span>Open Full Window</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Real-time Memory Saved/Forgotten Notification Toast */}
        {memoryNotice && (
          <div className="w-full max-w-md mx-auto mb-2.5 p-3 rounded-xl bg-violet-950/90 border border-violet-700/80 shadow-xl backdrop-blur-md flex items-center space-x-2 text-violet-200 text-xs animate-in fade-in duration-200">
            <Brain className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="font-semibold">{memoryNotice}</span>
          </div>
        )}

        {/* Speech Hint Toast */}
        {speechHint && (
          <div className="w-full max-w-md mx-auto mb-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md flex items-center space-x-2 text-slate-200 text-xs animate-in fade-in duration-200">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="font-medium">{speechHint}</span>
          </div>
        )}

        {/* Tool Action notifications and active countdown widgets */}
        <ToolWidgets
          activeTimers={activeTimers}
          openedLinks={openedLinks}
          latestToolCall={latestToolCall}
          onDismissTimer={(id) =>
            setActiveTimers((prev) => prev.filter((t) => t.id !== id))
          }
          onDismissLink={(id) =>
            setOpenedLinks((prev) => prev.filter((l) => l.id !== id))
          }
        />

        {/* Central Glowing Organic Orb Stage */}
        <RiyaCoreOrb
          status={status}
          userVolume={userVolume}
          riyaVolume={riyaVolume}
          isMuted={isMuted}
          vibe={vibe}
          onToggleConnect={toggleConnect}
          onToggleMute={toggleMute}
        />

        {/* Conversation Starters (Voice only) */}
        <div className="w-full mt-2 mb-4">
          <ConversationStarters
            onSelectPrompt={handleSelectPrompt}
            status={status}
          />
        </div>
      </main>

      {/* Floating Discrete Subtitles / Live Captions */}
      <CaptionsOverlay
        latestTranscript={latestTranscript}
        status={status}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeVibe={currentVibeId}
        onSelectVibe={(v) => {
          setCurrentVibeId(v);
        }}
        onSignOut={handleSignOut}
      />

      {/* Memory Vault Modal (Firestore Persistent Memory) */}
      <MemoryVaultModal
        isOpen={isMemoryVaultOpen}
        onClose={() => setIsMemoryVaultOpen(false)}
        currentUser={currentUser}
        profile={profile}
        memories={memories}
        pastSessions={pastSessions}
        onSaveProfile={handleSaveProfile}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
      />

      {/* Admin Panel Modal (Restricted to verified Administrator) */}
      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
