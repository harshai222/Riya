import {
  db,
  DbChatConversation,
  DbChatMessage,
  DbUserProfile,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';

export class ChatService {
  /**
   * Get or create a 1-to-1 conversation between two users
   */
  static async getOrCreateConversation(uid1: string, uid2: string): Promise<string> {
    const participants = [uid1, uid2].sort();
    const conversationId = `chat_${participants[0]}_${participants[1]}`;
    const convRef = doc(db, 'conversations', conversationId);

    try {
      const snap = await getDoc(convRef);
      if (!snap.exists()) {
        const newConv: DbChatConversation = {
          id: conversationId,
          participantIds: participants,
          lastMessageAt: new Date().toISOString(),
          unreadCount: {
            [participants[0]]: 0,
            [participants[1]]: 0
          }
        };
        await setDoc(convRef, newConv);
      }
      return conversationId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${conversationId}`);
    }
  }

  /**
   * Send a text message with persistent unread count tracking
   */
  static async sendMessage(
    conversationId: string, 
    senderId: string, 
    receiverId: string, 
    text: string
  ): Promise<void> {
    const msgId = 'msg_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const msgRef = doc(db, 'conversations', conversationId, 'messages', msgId);
    const convRef = doc(db, 'conversations', conversationId);
    
    const message: DbChatMessage = {
      id: msgId,
      conversationId,
      senderId,
      receiverId,
      type: 'text',
      text,
      createdAt: new Date().toISOString(),
      read: false
    };

    try {
      await runTransaction(db, async (transaction) => {
        const convSnap = await transaction.get(convRef);
        const existingData = convSnap.exists() ? convSnap.data() as DbChatConversation : null;
        const currentUnreadMap = existingData?.unreadCount || {};

        const updatedUnreadMap = {
          ...currentUnreadMap,
          [senderId]: 0,
          [receiverId]: (currentUnreadMap[receiverId] || 0) + 1
        };

        transaction.set(msgRef, message);
        transaction.update(convRef, {
          lastMessage: text.slice(0, 100),
          lastMessageAt: message.createdAt,
          lastSenderId: senderId,
          unreadCount: updatedUnreadMap
        });
        
        // Notify receiver
        const notifId = 'notif_' + Date.now();
        const notifRef = doc(db, 'users', receiverId, 'notifications', notifId);
        transaction.set(notifRef, {
          id: notifId,
          userId: receiverId,
          type: 'new_message',
          fromUid: senderId,
          relatedId: conversationId,
          read: false,
          createdAt: message.createdAt
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${conversationId}/messages`);
    }
  }

  /**
   * Send a media message (image/video) with persistent unread count tracking
   */
  static async sendMediaMessage(
    conversationId: string, 
    senderId: string, 
    receiverId: string, 
    type: 'image' | 'video',
    mediaUrl: string,
    storagePath: string,
    metadata?: {
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    }
  ): Promise<void> {
    const msgId = 'msg_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const msgRef = doc(db, 'conversations', conversationId, 'messages', msgId);
    const convRef = doc(db, 'conversations', conversationId);
    
    const message: DbChatMessage = {
      id: msgId,
      conversationId,
      senderId,
      receiverId,
      type,
      mediaUrl,
      storagePath,
      ...(metadata?.fileName ? { fileName: metadata.fileName } : {}),
      ...(metadata?.mimeType ? { mimeType: metadata.mimeType } : {}),
      ...(metadata?.fileSize ? { fileSize: metadata.fileSize } : {}),
      createdAt: new Date().toISOString(),
      read: false
    };

    try {
      await runTransaction(db, async (transaction) => {
        const convSnap = await transaction.get(convRef);
        const existingData = convSnap.exists() ? convSnap.data() as DbChatConversation : null;
        const currentUnreadMap = existingData?.unreadCount || {};

        const updatedUnreadMap = {
          ...currentUnreadMap,
          [senderId]: 0,
          [receiverId]: (currentUnreadMap[receiverId] || 0) + 1
        };

        transaction.set(msgRef, message);
        transaction.update(convRef, {
          lastMessage: type === 'image' ? '📷 Photo' : '🎥 Video',
          lastMessageAt: message.createdAt,
          lastSenderId: senderId,
          unreadCount: updatedUnreadMap
        });
        
        // Notify receiver
        const notifId = 'notif_' + Date.now();
        const notifRef = doc(db, 'users', receiverId, 'notifications', notifId);
        transaction.set(notifRef, {
          id: notifId,
          userId: receiverId,
          type: 'new_message',
          fromUid: senderId,
          relatedId: conversationId,
          read: false,
          createdAt: message.createdAt
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${conversationId}/messages`);
    }
  }

  /**
   * Listen for messages in a conversation
   */
  static onMessages(conversationId: string, callback: (msgs: DbChatMessage[]) => void) {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => d.data() as DbChatMessage));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${conversationId}/messages`);
    });
  }

  /**
   * Listen for user conversations
   */
  static onConversations(userId: string, callback: (convs: DbChatConversation[]) => void) {
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc'),
      limit(30)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => d.data() as DbChatConversation));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });
  }

  /**
   * Mark conversation as read for a specific user
   */
  static async markAsRead(conversationId: string, userId: string): Promise<void> {
    if (!conversationId || !userId) return;
    const convRef = doc(db, 'conversations', conversationId);
    try {
      await updateDoc(convRef, {
        [`unreadCount.${userId}`]: 0
      });
    } catch (error) {
      console.warn('[ChatService] Error marking conversation as read:', error);
    }
  }

  /**
   * Calculate total unread messages across all conversations for current user
   */
  static getTotalUnreadCount(conversations: DbChatConversation[], userId: string): number {
    if (!conversations || !userId) return 0;
    return conversations.reduce((total, conv) => {
      const count = conv.unreadCount?.[userId] || 0;
      return total + (typeof count === 'number' && count > 0 ? count : 0);
    }, 0);
  }

  /**
   * Format numeric unread badge string (e.g., "99+" if > 99)
   */
  static formatUnreadBadge(count: number): string {
    if (count <= 0) return '';
    if (count > 99) return '99+';
    return count.toString();
  }
}
