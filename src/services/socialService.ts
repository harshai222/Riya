import {
  db,
  DbUserProfile,
  DbFollowRelationship,
  DbFollowRequest,
  DbSocialNotification,
  handleFirestoreError,
  OperationType,
  isUserAdmin
} from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  runTransaction,
  increment,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

export class SocialService {
  /**
   * Search for users by username (partial/exact) or Public UID
   */
  static async searchUsers(searchTerm: string): Promise<DbUserProfile[]> {
    const term = searchTerm.trim();
    if (!term) return [];

    try {
      // 1. Check if it looks like a Public UID (numeric, 10-11 digits)
      if (/^\d{10,11}$/.test(term)) {
        const indexRef = doc(db, 'publicUids', term);
        const indexSnap = await getDoc(indexRef);
        if (indexSnap.exists()) {
          const uid = indexSnap.data().uid;
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            return [userSnap.data() as DbUserProfile];
          }
        }
        // Fallback to query if index missing
        const q = query(collection(db, 'users'), where('publicUid', '==', term), limit(1));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as DbUserProfile);
      }

      // 2. Search by exact username
      const usernameNormalized = term.toLowerCase();
      const userRef = doc(db, 'usernames', usernameNormalized);
      const userResSnap = await getDoc(userRef);
      if (userResSnap.exists()) {
        const uid = userResSnap.data().uid;
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          return [userSnap.data() as DbUserProfile];
        }
      }

      // 3. Search by username prefix (simple startWith search)
      const qPrefix = query(
        collection(db, 'users'),
        where('usernameNormalized', '>=', usernameNormalized),
        where('usernameNormalized', '<=', usernameNormalized + '\uf8ff'),
        limit(10)
      );
      const snapPrefix = await getDocs(qPrefix);
      return snapPrefix.docs.map(d => d.data() as DbUserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  }

  /**
   * Get relationship status between current user and target user
   */
  static async getRelationshipStatus(currentUid: string, targetUid: string): Promise<'NONE' | 'REQUESTED' | 'FOLLOWING'> {
    try {
      // Check if following
      const followRef = doc(db, 'follows', `${currentUid}_${targetUid}`);
      const followSnap = await getDoc(followRef);
      if (followSnap.exists()) return 'FOLLOWING';

      // Check if request is pending
      const q = query(
        collection(db, 'followRequests'),
        where('senderUid', '==', currentUid),
        where('receiverUid', '==', targetUid),
        where('status', '==', 'pending'),
        limit(1)
      );
      const requestSnap = await getDocs(q);
      if (!requestSnap.empty) return 'REQUESTED';

      return 'NONE';
    } catch (error) {
      console.error('Error fetching relationship status:', error);
      return 'NONE';
    }
  }

  /**
   * Follow a user or send a follow request
   */
  static async followUser(currentUid: string, targetUser: DbUserProfile): Promise<void> {
    if (currentUid === targetUser.uid) return;

    try {
      if (targetUser.accountType === 'public') {
        // Direct follow for public accounts
        await runTransaction(db, async (transaction) => {
          const followId = `${currentUid}_${targetUser.uid}`;
          const followRef = doc(db, 'follows', followId);
          const currentUserRef = doc(db, 'users', currentUid);
          const targetUserRef = doc(db, 'users', targetUser.uid);

          const followData: DbFollowRelationship = {
            id: followId,
            followerUid: currentUid,
            followingUid: targetUser.uid,
            status: 'following',
            createdAt: new Date().toISOString()
          };

          transaction.set(followRef, followData);
          transaction.update(currentUserRef, { followingCount: increment(1) });
          transaction.update(targetUserRef, { followersCount: increment(1) });
          
          // Add notification
          const notifId = 'notif_' + Date.now();
          const notifRef = doc(db, 'users', targetUser.uid, 'notifications', notifId);
          const notification: DbSocialNotification = {
            id: notifId,
            userId: targetUser.uid,
            type: 'follow_accept', // Using follow_accept for direct follows too
            fromUid: currentUid,
            relatedId: followId,
            read: false,
            createdAt: new Date().toISOString()
          };
          transaction.set(notifRef, notification);
        });
      } else {
        // Follow request for private accounts
        const requestId = `${currentUid}_${targetUser.uid}`;
        const requestRef = doc(db, 'followRequests', requestId);
        const requestData: DbFollowRequest = {
          id: requestId,
          senderUid: currentUid,
          receiverUid: targetUser.uid,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        await setDoc(requestRef, requestData);

        // Add notification
        const notifId = 'notif_' + Date.now();
        const notifRef = doc(db, 'users', targetUser.uid, 'notifications', notifId);
        const notification: DbSocialNotification = {
          id: notifId,
          userId: targetUser.uid,
          type: 'follow_request',
          fromUid: currentUid,
          relatedId: requestId,
          read: false,
          createdAt: new Date().toISOString()
        };
        await setDoc(notifRef, notification);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'follows/followRequests');
    }
  }

  /**
   * Unfollow a user
   */
  static async unfollowUser(currentUid: string, targetUid: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const followId = `${currentUid}_${targetUid}`;
        const followRef = doc(db, 'follows', followId);
        const followSnap = await transaction.get(followRef);

        if (followSnap.exists()) {
          const currentUserRef = doc(db, 'users', currentUid);
          const targetUserRef = doc(db, 'users', targetUid);

          transaction.delete(followRef);
          transaction.update(currentUserRef, { followingCount: increment(-1) });
          transaction.update(targetUserRef, { followersCount: increment(-1) });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `follows/${currentUid}_${targetUid}`);
    }
  }

  /**
   * Respond to a follow request
   */
  static async respondToFollowRequest(requestId: string, status: 'accepted' | 'rejected'): Promise<void> {
    const requestRef = doc(db, 'followRequests', requestId);
    
    try {
      const snap = await getDoc(requestRef);
      if (!snap.exists()) return;
      const requestData = snap.data() as DbFollowRequest;

      if (status === 'accepted') {
        await runTransaction(db, async (transaction) => {
          const followId = `${requestData.senderUid}_${requestData.receiverUid}`;
          const followRef = doc(db, 'follows', followId);
          const senderRef = doc(db, 'users', requestData.senderUid);
          const receiverRef = doc(db, 'users', requestData.receiverUid);

          const followData: DbFollowRelationship = {
            id: followId,
            followerUid: requestData.senderUid,
            followingUid: requestData.receiverUid,
            status: 'following',
            createdAt: new Date().toISOString()
          };

          transaction.set(followRef, followData);
          transaction.update(senderRef, { followingCount: increment(1) });
          transaction.update(receiverRef, { followersCount: increment(1) });
          transaction.delete(requestRef);

          // Add notification for sender
          const notifId = 'notif_' + Date.now();
          const notifRef = doc(db, 'users', requestData.senderUid, 'notifications', notifId);
          const notification: DbSocialNotification = {
            id: notifId,
            userId: requestData.senderUid,
            type: 'follow_accept',
            fromUid: requestData.receiverUid,
            relatedId: followId,
            read: false,
            createdAt: new Date().toISOString()
          };
          transaction.set(notifRef, notification);
        });
      } else {
        await deleteDoc(requestRef);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `followRequests/${requestId}`);
    }
  }

  /**
   * Listen to user notifications
   */
  static onNotifications(userId: string, callback: (notifs: DbSocialNotification[]) => void) {
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => d.data() as DbSocialNotification));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/notifications`);
    });
  }

  /**
   * Get list of follower UIDs for a user
   */
  static async getFollowersUids(userId: string): Promise<string[]> {
    try {
      const q = query(collection(db, 'follows'), where('followingUid', '==', userId));
      const snap = await getDocs(q);
      return snap.docs.map(d => (d.data() as DbFollowRelationship).followerUid);
    } catch (error) {
      console.error('Error fetching followers:', error);
      return [];
    }
  }

  /**
   * Get list of following UIDs for a user
   */
  static async getFollowingUids(userId: string): Promise<string[]> {
    try {
      const q = query(collection(db, 'follows'), where('followerUid', '==', userId));
      const snap = await getDocs(q);
      return snap.docs.map(d => (d.data() as DbFollowRelationship).followingUid);
    } catch (error) {
      console.error('Error fetching following:', error);
      return [];
    }
  }

  /**
   * Check if user A is following user B
   */
  static async isFollowing(followerUid: string, followingUid: string): Promise<boolean> {
    try {
      const snap = await getDoc(doc(db, 'follows', `${followerUid}_${followingUid}`));
      return snap.exists();
    } catch (error) {
      return false;
    }
  }

  /**
   * Update current user profile
   */
  static async updateProfile(userId: string, updates: Partial<DbUserProfile>): Promise<void> {
    const docRef = doc(db, 'users', userId);
    // Sanitize updates to prevent immutable fields from being changed via this method
    const { uid, publicUid, createdAt, ...allowedUpdates } = updates as any;
    try {
      await updateDoc(docRef, {
        ...allowedUpdates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  }
}
