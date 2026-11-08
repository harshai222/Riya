import { 
  storage, 
  ref, 
  uploadBytesResumable, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from '../lib/firebase';

export interface UploadResult {
  url: string;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export const storageService = {
  /**
   * Uploads a file directly to Firebase Storage using uploadBytesResumable
   */
  async uploadFile(
    file: File | Blob, 
    path: string, 
    onProgress?: (progressPercent: number) => void
  ): Promise<UploadResult> {
    const fileName = file instanceof File ? file.name : 'media_file';
    const mimeType = file.type || 'application/octet-stream';
    const fileSize = file.size || 0;

    const fileRef = ref(storage, path);
    const metadata = { contentType: mimeType };

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, file, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            if (onProgress) onProgress(percent);
          }
        },
        (error) => {
          console.error('[Firebase Storage Upload Error]', error);
          reject(error);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadUrl,
              storagePath: uploadTask.snapshot.ref.fullPath,
              fileName,
              mimeType,
              fileSize,
            });
          } catch (urlErr) {
            console.error('[Firebase Storage getDownloadURL Error]', urlErr);
            reject(urlErr);
          }
        }
      );
    });
  },

  /**
   * Specifically for chat media
   */
  async uploadChatMessageMedia(
    conversationId: string,
    file: File | Blob,
    fileName: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `chats/${conversationId}/${timestamp}_${sanitizedName}`;

    return this.uploadFile(file, path, onProgress);
  },

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(userId: string, file: File | Blob): Promise<UploadResult> {
    const extension = file instanceof File ? file.name.split('.').pop() : 'jpg';
    const path = `profiles/${userId}/avatar.${extension}`;
    return this.uploadFile(file, path);
  },

  /**
   * Delete a file from storage
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const fileRef = ref(storage, path);
      await deleteObject(fileRef);
    } catch (e) {
      console.warn('[StorageService] Delete notice:', e);
    }
  },
};
