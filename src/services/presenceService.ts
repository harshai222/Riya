import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface DbUserPresence {
  uid: string;
  status: 'online' | 'offline';
  lastActiveAt: string;
}

export class PresenceService {
  private static activeHeartbeats: Map<string, number> = new Map();
  private static activeCleanupFns: Map<string, () => void> = new Map();

  /**
   * Initializes and maintains online presence for an authenticated user.
   * Includes 15s heartbeat + beforeunload/visibilitychange hooks.
   */
  static initPresence(userId: string): () => void {
    if (!userId) return () => {};

    // Stop existing if any
    this.stopPresence(userId);

    const presenceRef = doc(db, 'presence', userId);

    const setOnline = async () => {
      try {
        await setDoc(
          presenceRef,
          {
            uid: userId,
            status: 'online',
            lastActiveAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('[Presence] Error setting online state:', err);
      }
    };

    const setOffline = async () => {
      try {
        await setDoc(
          presenceRef,
          {
            uid: userId,
            status: 'offline',
            lastActiveAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('[Presence] Error setting offline state:', err);
      }
    };

    // Initial online signal
    setOnline();

    // 15s Heartbeat to prevent stale online status if connection drops abruptly
    const heartbeatInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setOnline();
      }
    }, 15000);

    this.activeHeartbeats.set(userId, heartbeatInterval);

    // Event listeners
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setOnline();
      } else {
        setOffline();
      }
    };

    const handleBeforeUnload = () => {
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const cleanup = () => {
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
      this.activeHeartbeats.delete(userId);
      this.activeCleanupFns.delete(userId);
    };

    this.activeCleanupFns.set(userId, cleanup);
    return cleanup;
  }

  /**
   * Explicitly stop presence tracking (e.g. on sign out)
   */
  static stopPresence(userId: string) {
    const cleanup = this.activeCleanupFns.get(userId);
    if (cleanup) {
      cleanup();
    }
  }

  /**
   * Subscribe to real-time presence of a single user
   */
  static subscribeUserPresence(
    targetUserId: string,
    callback: (isOnline: boolean, lastActiveAt?: string) => void
  ): () => void {
    if (!targetUserId) {
      callback(false);
      return () => {};
    }

    const presenceRef = doc(db, 'presence', targetUserId);

    return onSnapshot(
      presenceRef,
      (snap) => {
        if (!snap.exists()) {
          callback(false);
          return;
        }

        const data = snap.data() as DbUserPresence;
        const lastActiveTime = data.lastActiveAt ? new Date(data.lastActiveAt).getTime() : 0;
        const timeDiff = Date.now() - lastActiveTime;

        // User is considered Online ONLY if status is 'online' AND lastActiveAt is <= 45s ago
        const isOnline = data.status === 'online' && timeDiff <= 45000;
        callback(isOnline, data.lastActiveAt);
      },
      (error) => {
        console.warn('[Presence] Snapshot listener error:', error);
        callback(false);
      }
    );
  }
}
