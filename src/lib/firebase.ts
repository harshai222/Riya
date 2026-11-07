import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  getDocs,
  deleteDoc,
  getDocFromServer,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Administrator identity configuration
export const ADMIN_GOOGLE_EMAIL = '3881229harsh@gmail.com';

export function isUserAdmin(user: User | null): boolean {
  if (!user || !user.email) return false;
  return user.email.toLowerCase().trim() === ADMIN_GOOGLE_EMAIL.toLowerCase().trim();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot (browser only)
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline.');
    }
  }
}
if (typeof window !== 'undefined') {
  testConnection();
}

export interface DbUserProfile {
  uid: string;
  username?: string;
  usernameNormalized?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  preferredName: string;
  favoriteVibe?: string;
  bio?: string;
  role?: 'user' | 'admin';
  onboardingCompleted?: boolean;
  createdAt: string;
  lastLoginAt: string;
  updatedAt?: string;
}

export interface DbUsernameReservation {
  uid: string;
  username: string;
  usernameNormalized: string;
  createdAt: string;
}

export interface DbMemoryFact {
  id: string;
  userId: string;
  category: string;
  fact: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DbConversationSession {
  id: string;
  userId: string;
  summary: string;
  vibeUsed?: string;
  highlights?: string;
  messageCount?: number;
  createdAt: string;
}

export interface DbConversationMessage {
  id: string;
  conversationId: string;
  userId: string;
  speaker: 'user' | 'riya';
  text: string;
  createdAt: string;
}

// ==========================================
// USERNAME VALIDATION & TRANSACTIONS
// ==========================================

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsernameFormat(username: string): { isValid: boolean; error?: string } {
  const trimmed = username.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Username is required.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters.' };
  }
  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username cannot exceed 20 characters.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  return { isValid: true };
}

export async function checkUsernameAvailability(
  username: string,
  currentUid?: string
): Promise<{ available: boolean; message: string }> {
  const normalized = normalizeUsername(username);
  const formatCheck = validateUsernameFormat(username);
  if (!formatCheck.isValid) {
    return { available: false, message: formatCheck.error! };
  }

  const path = `usernames/${normalized}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', normalized));
    if (!snap.exists()) {
      return { available: true, message: 'Username available' };
    }
    const data = snap.data();
    if (currentUid && data?.uid === currentUid) {
      return { available: true, message: 'Username available' };
    }
    return { available: false, message: 'This username is already in use. Please choose another one.' };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Atomically claim a unique username in a Firestore transaction.
 * Ensures two users trying to claim the same username cannot both succeed.
 */
export async function claimUsernameTransaction(
  user: User,
  rawUsername: string,
  currentProfile?: DbUserProfile | null
): Promise<DbUserProfile> {
  const normalized = normalizeUsername(rawUsername);
  const validation = validateUsernameFormat(rawUsername);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const usernameRef = doc(db, 'usernames', normalized);
  const userRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  const isAdmin = isUserAdmin(user);

  try {
    return await runTransaction(db, async (transaction) => {
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists()) {
        const existingOwner = usernameDoc.data()?.uid;
        if (existingOwner !== user.uid) {
          throw new Error('This username is already in use. Please choose another one.');
        }
      }

      const userDoc = await transaction.get(userRef);
      const existingUserData = userDoc.exists() ? (userDoc.data() as DbUserProfile) : null;

      const updatedProfile: DbUserProfile = {
        uid: user.uid,
        username: rawUsername.trim(),
        usernameNormalized: normalized,
        displayName: user.displayName || existingUserData?.displayName || rawUsername.trim(),
        email: user.email || existingUserData?.email || '',
        photoURL: user.photoURL || existingUserData?.photoURL || '',
        preferredName: rawUsername.trim(),
        favoriteVibe: existingUserData?.favoriteVibe || 'cyberpunk',
        bio: existingUserData?.bio || '',
        role: isAdmin ? 'admin' : 'user',
        onboardingCompleted: true,
        createdAt: existingUserData?.createdAt || now,
        lastLoginAt: now,
        updatedAt: now,
      };

      // Write reservation into usernames collection
      transaction.set(usernameRef, {
        uid: user.uid,
        username: rawUsername.trim(),
        usernameNormalized: normalized,
        createdAt: now,
      });

      // Update user profile document
      transaction.set(userRef, updatedProfile, { merge: true });

      return updatedProfile;
    });
  } catch (err: any) {
    if (err.message && err.message.includes('already in use')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `usernames/${normalized}`);
  }
}

// ==========================================
// USER PROFILE OPERATIONS
// ==========================================

export async function getUserProfile(userId: string): Promise<DbUserProfile | null> {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return snap.data() as DbUserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function syncUserProfileOnLogin(user: User): Promise<DbUserProfile> {
  const path = `users/${user.uid}`;
  const now = new Date().toISOString();
  const isAdmin = isUserAdmin(user);

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const existing = snap.data() as DbUserProfile;
      const updated: DbUserProfile = {
        ...existing,
        displayName: user.displayName || existing.displayName,
        email: user.email || existing.email,
        photoURL: user.photoURL || existing.photoURL,
        role: isAdmin ? 'admin' : (existing.role || 'user'),
        lastLoginAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
      return updated;
    } else {
      const newProfile: DbUserProfile = {
        uid: user.uid,
        displayName: user.displayName || undefined,
        email: user.email || undefined,
        photoURL: user.photoURL || undefined,
        preferredName: user.displayName ? user.displayName.split(' ')[0] : 'Friend',
        favoriteVibe: 'cyberpunk',
        role: isAdmin ? 'admin' : 'user',
        onboardingCompleted: false,
        createdAt: now,
        lastLoginAt: now,
      };
      await setDoc(doc(db, 'users', user.uid), newProfile);
      return newProfile;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveUserProfile(profile: DbUserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), profile, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ==========================================
// MEMORY FACTS OPERATIONS
// ==========================================

export async function getMemoryFacts(userId: string): Promise<DbMemoryFact[]> {
  const path = `users/${userId}/memories`;
  try {
    const q = query(collection(db, 'users', userId, 'memories'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as DbMemoryFact);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function addMemoryFact(
  userId: string,
  category: string,
  fact: string
): Promise<DbMemoryFact> {
  const memoryId = 'mem_' + Date.now() + Math.random().toString(36).substring(2, 6);
  const path = `users/${userId}/memories/${memoryId}`;
  const record: DbMemoryFact = {
    id: memoryId,
    userId,
    category,
    fact,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'users', userId, 'memories', memoryId), record);
    return record;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteMemoryFact(userId: string, memoryId: string): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'memories', memoryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function forgetFactByQuery(
  userId: string,
  queryText: string,
  memories: DbMemoryFact[]
): Promise<DbMemoryFact | null> {
  const qLower = queryText.toLowerCase().trim();
  if (!qLower) return null;

  const match = memories.find(
    (m) =>
      m.fact.toLowerCase().includes(qLower) ||
      m.category.toLowerCase().includes(qLower) ||
      qLower.includes(m.fact.toLowerCase())
  );

  if (match) {
    await deleteMemoryFact(userId, match.id);
    return match;
  }
  return null;
}

// ==========================================
// CONVERSATIONS & MESSAGES OPERATIONS
// ==========================================

export async function saveConversationSession(
  session: DbConversationSession,
  messages?: DbConversationMessage[]
): Promise<void> {
  const sessionPath = `users/${session.userId}/conversations/${session.id}`;
  try {
    await setDoc(doc(db, 'users', session.userId, 'conversations', session.id), session);

    if (messages && messages.length > 0) {
      for (const msg of messages) {
        const msgPath = `users/${session.userId}/conversations/${session.id}/messages/${msg.id}`;
        await setDoc(doc(db, 'users', session.userId, 'conversations', session.id, 'messages', msg.id), msg);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, sessionPath);
  }
}

export async function getPastSessions(userId: string, maxLimit = 15): Promise<DbConversationSession[]> {
  const path = `users/${userId}/conversations`;
  try {
    const q = query(
      collection(db, 'users', userId, 'conversations'),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as DbConversationSession);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function getConversationMessages(
  userId: string,
  conversationId: string
): Promise<DbConversationMessage[]> {
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const q = query(
      collection(db, 'users', userId, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as DbConversationMessage);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ==========================================
// ADMIN PANEL OPERATIONS (AUTHORIZED ONLY)
// ==========================================

export async function adminSearchUserByUsername(
  rawUsername: string
): Promise<{ userProfile: DbUserProfile | null; reservation: DbUsernameReservation | null }> {
  const normalized = normalizeUsername(rawUsername);
  const path = `usernames/${normalized}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', normalized));
    if (!snap.exists()) {
      return { userProfile: null, reservation: null };
    }
    const reservation = snap.data() as DbUsernameReservation;
    const userProfile = await getUserProfile(reservation.uid);
    return { userProfile, reservation };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function adminListRecentUsernames(maxLimit = 25): Promise<DbUsernameReservation[]> {
  const path = 'usernames';
  try {
    const q = query(collection(db, 'usernames'), orderBy('createdAt', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as DbUsernameReservation);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ==========================================
// AUTH HELPERS
// ==========================================

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export { onAuthStateChanged };
export type { User };
