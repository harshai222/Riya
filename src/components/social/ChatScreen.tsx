import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  MoreVertical, 
  User as UserIcon,
  Check,
  CheckCheck,
  X,
  Plus
} from 'lucide-react';
import { ChatService } from '../../services/chatService';
import { storageService } from '../../services/storageService';
import { PresenceService } from '../../services/presenceService';
import { DbChatMessage, DbUserProfile, User } from '../../lib/firebase';

interface ChatScreenProps {
  currentUser: User;
  targetUser: DbUserProfile;
  onBack: () => void;
}

// Date & Time Utility Functions
const parseMessageDate = (raw: any): Date => {
  if (!raw) return new Date();
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  if (typeof raw === 'number') return new Date(raw);
  if (raw && typeof raw.toDate === 'function') return raw.toDate();
  if (raw && typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
  return new Date();
};

const formatMessageTime = (rawDate: any): string => {
  const d = parseMessageDate(rawDate);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getMessageDateKey = (rawDate: any): string => {
  const d = parseMessageDate(rawDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateSeparator = (rawDate: any): string => {
  const d = parseMessageDate(rawDate);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return 'Today';
  } else if (msgDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
};

export const ChatScreen: React.FC<ChatScreenProps> = ({ 
  currentUser, 
  targetUser, 
  onBack 
}) => {
  const [messages, setMessages] = useState<DbChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isTargetOnline, setIsTargetOnline] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to target user presence
  useEffect(() => {
    const unsub = PresenceService.subscribeUserPresence(targetUser.uid, (isOnline) => {
      setIsTargetOnline(isOnline);
    });
    return () => unsub();
  }, [targetUser.uid]);

  useEffect(() => {
    const initChat = async () => {
      const id = await ChatService.getOrCreateConversation(currentUser.uid, targetUser.uid);
      setConversationId(id);
    };
    initChat();
  }, [currentUser.uid, targetUser.uid]);

  useEffect(() => {
    if (!conversationId) return;

    const unsub = ChatService.onMessages(conversationId, (msgs) => {
      setMessages(msgs);
    });

    return () => unsub();
  }, [conversationId]);

  // Mark conversation as read whenever active in ChatScreen and when new messages arrive
  useEffect(() => {
    if (conversationId && currentUser.uid) {
      ChatService.markAsRead(conversationId, currentUser.uid);
    }
  }, [conversationId, currentUser.uid, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !conversationId) return;

    const text = newMessage;
    setNewMessage('');
    
    try {
      await ChatService.sendMessage(conversationId, currentUser.uid, targetUser.uid, text);
    } catch (error) {
      console.error('Send message error:', error);
      setNewMessage(text); // Restore on error
    }
  };

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setUploadError('Only image and video files are supported.');
      setTimeout(() => setUploadError(null), 4000);
      return;
    }

    // Limit check (e.g. 50MB max for video)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File exceeds 50MB limit.');
      setTimeout(() => setUploadError(null), 4000);
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setUploadError(null);

    try {
      const result = await storageService.uploadChatMessageMedia(
        conversationId,
        file,
        file.name,
        (progress) => setUploadProgress(progress)
      );
      
      setUploadProgress(90);
      
      await ChatService.sendMediaMessage(
        conversationId,
        currentUser.uid,
        targetUser.uid,
        isImage ? 'image' : 'video',
        result.url,
        result.storagePath,
        {
          fileName: result.fileName || file.name,
          mimeType: result.mimeType || file.type,
          fileSize: result.fileSize || file.size,
        }
      );
      setUploadProgress(100);
    } catch (error: any) {
      console.error('Media upload error:', error);
      setUploadError(error.message || 'Media upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            {targetUser.photoURL ? (
              <img
                src={targetUser.photoURL}
                alt={targetUser.username}
                className="w-10 h-10 rounded-full border border-cyan-500/30 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-cyan-900/30 flex items-center justify-center border border-cyan-500/30">
                <UserIcon className="w-5 h-5 text-cyan-500" />
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
              isTargetOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'
            }`} />
          </div>
          
          <div>
            <div className="font-bold text-cyan-50">@{targetUser.username}</div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${isTargetOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
              <span className={isTargetOnline ? 'text-emerald-400 font-semibold uppercase tracking-wider' : 'text-zinc-400 font-medium'}>
                {isTargetOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-white/5 text-cyan-500/50">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-fixed"
      >
        <div className="text-center py-6">
          <div className="inline-block px-4 py-1.5 rounded-full bg-black/40 border border-white/5 text-[10px] text-cyan-500/40 uppercase tracking-widest backdrop-blur-sm">
            End-to-end encrypted connection established
          </div>
        </div>

        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUser.uid;
          const showAvatar = !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId);
          
          // Check if date separator should be shown
          const currentDateKey = getMessageDateKey(msg.createdAt);
          const prevDateKey = i > 0 ? getMessageDateKey(messages[i-1].createdAt) : null;
          const showDateSeparator = i === 0 || currentDateKey !== prevDateKey;
          const dateSeparatorText = showDateSeparator ? formatDateSeparator(msg.createdAt) : '';

          return (
            <React.Fragment key={msg.id}>
              {/* Instagram-style Centered Date Separator */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-black/60 border border-cyan-500/20 text-[11px] font-medium text-cyan-400/80 tracking-wide backdrop-blur-md shadow-sm">
                    {dateSeparatorText}
                  </span>
                </div>
              )}

              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                <div className={`flex max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                  {!isMe && (
                    <div className="w-8 h-8 flex-shrink-0">
                      {showAvatar && (
                        targetUser.photoURL ? (
                          <img src={targetUser.photoURL} className="w-8 h-8 rounded-full border border-white/10 object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-cyan-900/20 flex items-center justify-center border border-white/10">
                            <UserIcon className="w-4 h-4 text-cyan-500" />
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div 
                      className={`px-4 py-2.5 rounded-2xl text-sm relative transition-all ${
                        isMe 
                          ? 'bg-cyan-500 text-black font-medium rounded-br-none shadow-lg shadow-cyan-500/10' 
                          : 'bg-white/10 text-cyan-50 rounded-bl-none border border-white/10 backdrop-blur-md'
                      }`}
                    >
                      {msg.type === 'text' && <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                      
                      {msg.type === 'image' && msg.mediaUrl && (
                        <div className="rounded-lg overflow-hidden border border-black/20 my-1 bg-black/40">
                          <img 
                            src={msg.mediaUrl} 
                            alt={msg.fileName || "Shared photo"} 
                            className="max-w-full max-h-96 rounded-lg object-contain block" 
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="p-4 text-xs text-rose-400 flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span>Photo failed to load</span></div>';
                              }
                            }}
                          />
                        </div>
                      )}
                      
                      {msg.type === 'video' && msg.mediaUrl && (
                        <div className="rounded-lg overflow-hidden border border-black/20 bg-black my-1">
                          <video 
                            src={msg.mediaUrl} 
                            controls 
                            playsInline 
                            preload="metadata"
                            className="max-w-full max-h-96 rounded-lg block" 
                            onError={(e) => {
                              console.warn('Video failed to load:', msg.mediaUrl);
                            }}
                          />
                        </div>
                      )}

                      {/* Instagram-style Message Timestamp (12-hour format) */}
                      <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 font-sans ${isMe ? 'text-black/60' : 'text-cyan-500/50'}`}>
                        <span>{formatMessageTime(msg.createdAt)}</span>
                        {isMe && (msg.read ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        
        {isUploading && (
          <div className="flex justify-end">
            <div className="bg-cyan-500/10 border border-cyan-500/30 p-3.5 rounded-2xl rounded-br-none w-56 space-y-2">
              <div className="flex items-center justify-between text-cyan-400 text-xs font-bold">
                <div className="flex items-center gap-1.5 animate-pulse">
                  <Plus className="w-3.5 h-3.5" />
                  <span>UPLOADING MEDIA...</span>
                </div>
                <span className="font-mono text-[11px]">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(uploadProgress, 8)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="flex justify-end">
            <div className="bg-rose-950/80 border border-rose-800/80 p-3 rounded-2xl rounded-br-none max-w-xs text-xs text-rose-200 flex items-start gap-2 shadow-lg">
              <span className="text-rose-400 font-bold shrink-0">✕</span>
              <div className="flex-1">
                <p className="font-semibold text-[11px]">Upload Failed</p>
                <p className="text-[10px] text-rose-300 mt-0.5">{uploadError}</p>
              </div>
              <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-white p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSendMessage}
        className="p-4 bg-white/5 border-t border-white/5 backdrop-blur-md"
      >
        <div className="flex items-end gap-2 bg-black/40 p-2 rounded-2xl border border-white/10 focus-within:border-cyan-500/50 transition-all">
          <input 
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,video/*"
            onChange={handleFileUpload}
          />

          <textarea 
            className="flex-1 bg-transparent border-none focus:ring-0 text-cyan-50 placeholder-cyan-500/30 py-2 max-h-32 min-h-[40px] resize-none text-sm custom-scrollbar"
            placeholder="Type your message..."
            rows={1}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className={`p-2.5 rounded-xl transition-all ${
              newMessage.trim() 
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 active:scale-95' 
                : 'bg-white/5 text-cyan-500/30'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

