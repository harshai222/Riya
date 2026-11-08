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
  where,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
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
  publicUid?: string;
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
  accountType: 'public' | 'private';
  followersCount: number;
  followingCount: number;
}

export interface DbFollowRelationship {
  id: string; // followerUid_followingUid
  followerUid: string;
  followingUid: string;
  status: 'following';
  createdAt: string;
}

export interface DbFollowRequest {
  id: string;
  senderUid: string;
  receiverUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface DbChatConversation {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageAt: string;
  lastSenderId?: string;
  unreadCount?: Record<string, number>;
}

export interface DbChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string; // for easier validation/filtering
  type: 'text' | 'image' | 'video';
  text?: string;
  mediaUrl?: string;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: string;
  read: boolean;
}

export interface DbSocialNotification {
  id: string;
  userId: string;
  type: 'follow_request' | 'follow_accept' | 'new_message';
  fromUid: string;
  fromUsername?: string;
  relatedId: string;
  read: boolean;
  createdAt: string;
}

export interface AdminGeminiConfig {
  activeModel: string;
  activeVoice: string;
  version: number;
  status: 'active' | 'invalid' | 'maintenance';
  updatedAt: string;
  apiKeyMasked: string;
  isUsingEnvKey: boolean;
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
      
      let publicUid = existingUserData?.publicUid;
      if (!publicUid) {
        publicUid = await generatePublicUid();
      }

      // Explicitly construct the profile to avoid 'undefined' and whitelisting issues
      const updatedProfile: DbUserProfile = {
        uid: user.uid,
        publicUid,
        username: rawUsername.trim(),
        usernameNormalized: normalized,
        preferredName: rawUsername.trim(),
        favoriteVibe: existingUserData?.favoriteVibe || 'cyberpunk',
        role: isAdmin ? 'admin' : (existingUserData?.role || 'user'),
        onboardingCompleted: true,
        createdAt: existingUserData?.createdAt || now,
        lastLoginAt: now,
        updatedAt: now,
        accountType: existingUserData?.accountType || 'public',
        followersCount: existingUserData?.followersCount || 0,
        followingCount: existingUserData?.followingCount || 0,
      };
      
      if (user.displayName || existingUserData?.displayName) {
        updatedProfile.displayName = user.displayName || existingUserData?.displayName;
      }
      if (user.email || existingUserData?.email) {
        updatedProfile.email = user.email || existingUserData?.email;
      }
      if (user.photoURL || existingUserData?.photoURL) {
        updatedProfile.photoURL = user.photoURL || existingUserData?.photoURL;
      }
      if (existingUserData?.bio) {
        updatedProfile.bio = existingUserData.bio;
      }

      transaction.set(usernameRef, {
        uid: user.uid,
        username: rawUsername.trim(),
        usernameNormalized: normalized,
        createdAt: now,
      });

      transaction.set(userRef, updatedProfile, { merge: true });
      
      // Register the public UID in our uniqueness index
      transaction.set(doc(db, 'publicUids', publicUid), { uid: user.uid, createdAt: now });

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

export async function generatePublicUid(): Promise<string> {
  let attempts = 0;
  while (attempts < 15) {
    const min = 1000000000;
    const max = 99999999999;
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    const candidate = randomNum.toString();
    
    try {
      const indexRef = doc(db, 'publicUids', candidate);
      const snap = await getDoc(indexRef);
      
      if (!snap.exists()) {
        return candidate;
      }
    } catch (err) {
      console.warn('[GeneratePublicUid] Uniqueness lookup notice:', err);
      return candidate;
    }
    attempts++;
  }
  return Math.floor(1000000000 + Math.random() * 90000000000).toString();
}

export async function syncUserProfileOnLogin(user: User): Promise<DbUserProfile> {
  const path = `users/${user.uid}`;
  const now = new Date().toISOString();
  const isAdmin = isUserAdmin(user);

  try {
    const docRef = doc(db, 'users', user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const existing = snap.data() as DbUserProfile;
      let publicUid = existing.publicUid;

      if (!publicUid) {
        console.log(`[Migration] Generating Public UID for user: ${user.uid}`);
        publicUid = await generatePublicUid();
      }

      const updated: DbUserProfile = {
        uid: user.uid,
        publicUid,
        displayName: user.displayName || existing.displayName || '',
        email: user.email || existing.email || '',
        photoURL: user.photoURL || existing.photoURL || '',
        username: existing.username,
        usernameNormalized: existing.usernameNormalized,
        preferredName: existing.preferredName || user.displayName?.split(' ')[0] || 'Friend',
        favoriteVibe: existing.favoriteVibe || 'cyberpunk',
        bio: existing.bio || '',
        role: isAdmin ? 'admin' : (existing.role || 'user'),
        onboardingCompleted: existing.onboardingCompleted ?? false,
        createdAt: existing.createdAt || now,
        lastLoginAt: now,
        updatedAt: now,
        accountType: existing.accountType || 'public',
        followersCount: existing.followersCount || 0,
        followingCount: existing.followingCount || 0,
      };
      
      await setDoc(docRef, updated, { merge: true });
      
      if (!existing.publicUid) {
        await setDoc(doc(db, 'publicUids', publicUid), { uid: user.uid, createdAt: now });
      }

      return updated;
    } else {
      const publicUid = await generatePublicUid();
      const newProfile: DbUserProfile = {
        uid: user.uid,
        publicUid,
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        preferredName: user.displayName ? user.displayName.split(' ')[0] : 'Friend',
        favoriteVibe: 'cyberpunk',
        role: isAdmin ? 'admin' : 'user',
        onboardingCompleted: false,
        createdAt: now,
        lastLoginAt: now,
        accountType: 'public',
        followersCount: 0,
        followingCount: 0,
      };
      await setDoc(docRef, newProfile);
      
      await setDoc(doc(db, 'publicUids', publicUid), { uid: user.uid, createdAt: now });

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

async function getAdminHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthenticated');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export async function adminGetGeminiConfig(): Promise<AdminGeminiConfig> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/admin/config', { headers });
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    if (contentType.includes('application/json')) {
      try {
        const err = await res.json();
        errorMsg = err.error || err.message || errorMsg;
      } catch (e) {}
    }
    throw new Error(errorMsg);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Server returned invalid HTML response instead of JSON configuration. Please ensure dev server is running on port 3000.');
  }

  return res.json();
}

export async function adminUpdateGeminiConfig(payload: {
  activeModel?: string;
  activeVoice?: string;
  apiKey?: string;
  status?: string;
}): Promise<{ success: boolean; message?: string; category?: string }> {
  const user = auth.currentUser;
  if (!user || !isUserAdmin(user)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const configRef = doc(db, 'systemConfig', 'gemini');
  const now = new Date().toISOString();

  // 1. Fetch existing config to preserve values if partial update
  let existingData: any = {};
  try {
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      existingData = snap.data();
    }
  } catch (err) {
    console.warn('[AdminUpdate] Could not fetch existing Firestore config:', err);
  }

  const targetModel = (payload.activeModel && payload.activeModel.trim()) ? payload.activeModel.trim() : (existingData.activeModel || 'gemini-3.1-flash-live-preview');
  const targetVoice = (payload.activeVoice && payload.activeVoice.trim()) ? payload.activeVoice.trim() : (existingData.activeVoice || 'Lyra');
  const targetApiKey = (payload.apiKey !== undefined) ? payload.apiKey.trim() : existingData.apiKey;
  const targetStatus = payload.status || existingData.status || 'active';
  const newVersion = (typeof existingData.version === 'number' ? existingData.version : 1) + 1;

  const docPayload = {
    apiKey: targetApiKey || '',
    activeModel: targetModel,
    activeVoice: targetVoice,
    version: newVersion,
    status: targetStatus,
    updatedAt: now,
    updatedBy: user.email || ADMIN_GOOGLE_EMAIL,
  };

  try {
    // 2. Write to Firestore systemConfig/gemini (Source of Truth)
    await setDoc(configRef, docPayload, { merge: true });

    // 3. Verification read from Firestore
    const verifySnap = await getDoc(configRef);
    if (!verifySnap.exists() || verifySnap.data()?.updatedAt !== now) {
      throw new Error('API Key verification failed: The document was not correctly persisted to Firestore.');
    }

    console.log('[AdminUpdate] Successfully persisted configuration to Firestore systemConfig/gemini');
  } catch (err: any) {
    console.error('[AdminUpdate] Firestore write/verification failed:', err);
    throw new Error(`Firestore persistence failed: ${err.message || 'Permission denied or network error'}`);
  }

  // 4. Notify backend to validate credentials and sync runtime state
  const headers = await getAdminHeaders();
  const res = await fetch('/api/admin/config/update', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('Server returned non-JSON response during configuration sync.');
  }

  const data = await res.json();
  if (!res.ok) {
    const categoryPrefix = data.category ? `[${data.category}] ` : '';
    throw new Error(`${categoryPrefix}${data.message || data.error || 'Failed to update config'}`);
  }
  return data;
}

export async function adminTestGeminiConfig(payload?: {
  activeModel?: string;
  apiKey?: string;
}): Promise<{ status: string; message: string; category?: string; testedModel?: string }> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/admin/config/test', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {}),
  });
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('Server returned non-JSON response during API test.');
  }

  const data = await res.json();
  if (!res.ok) {
    const categoryPrefix = data.category ? `[${data.category}] ` : '';
    throw new Error(`${categoryPrefix}${data.message || data.error || 'Test failed'}`);
  }
  return data;
}

export async function adminSearchUserByUsername(
  rawSearch: string
): Promise<{ userProfile: DbUserProfile | null; reservation: DbUsernameReservation | null }> {
  const input = (rawSearch || '').trim();
  if (!input) return { userProfile: null, reservation: null };

  // 1. Search by Public Numeric UID (10-11 digits)
  if (/^\d{10,11}$/.test(input)) {
    try {
      const q = query(collection(db, 'users'), where('publicUid', '==', input), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userProfile = snap.docs[0].data() as DbUserProfile;
        // Fetch reservation if username exists
        let reservation: DbUsernameReservation | null = null;
        if (userProfile.usernameNormalized) {
          const resSnap = await getDoc(doc(db, 'usernames', userProfile.usernameNormalized));
          if (resSnap.exists()) {
            reservation = resSnap.data() as DbUsernameReservation;
          }
        }
        return { userProfile, reservation };
      }
    } catch (err) {
      console.warn('[AdminSearch] Public UID search error:', err);
    }
  }

  // 2. Existing Username Search
  const normalized = normalizeUsername(input);
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

export async function getSystemGeminiConfig(): Promise<{ apiKey: string; activeModel?: string; version?: number; updatedAt?: string }> {
  try {
    const snap = await getDoc(doc(db, 'systemConfig', 'gemini'));
    if (snap.exists()) {
      const data = snap.data() as any;
      const apiKey = (data?.apiKey || '').trim();
      if (apiKey) {
        return {
          apiKey,
          activeModel: data.activeModel,
          version: data.version,
          updatedAt: data.updatedAt,
        };
      }
    }
  } catch (err) {
    console.warn('[GeminiConfig] Could not read systemConfig/gemini from Firestore, falling back...');
  }
  return {
    apiKey: '',
    activeModel: 'gemini-3.1-flash-live-preview',
    version: 1,
  };
}

export { onAuthStateChanged };
export { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject };
export type { User };
