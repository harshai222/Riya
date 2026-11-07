import { AudioRecorder } from './AudioRecorder';
import { AudioStreamer } from './AudioStreamer';
import { LiveSessionStatus, ToolCallExecution, LiveTranscriptItem } from '../utils/sessionTypes';

export interface LiveClientCallbacks {
  onStatusChange: (status: LiveSessionStatus) => void;
  onUserVolume: (volume: number) => void;
  onRiyaVolume: (volume: number) => void;
  onTranscript: (item: LiveTranscriptItem) => void;
  onToolExecute: (tool: ToolCallExecution) => void;
  onError: (errorMsg: string) => void;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private streamer: AudioStreamer | null = null;
  private status: LiveSessionStatus = 'disconnected';
  private callbacks: LiveClientCallbacks;
  private isConnecting: boolean = false;
  private intentionalDisconnect: boolean = false;

  constructor(callbacks: LiveClientCallbacks) {
    this.callbacks = callbacks;
  }

  public getStatus(): LiveSessionStatus {
    return this.status;
  }

  private setStatus(newStatus: LiveSessionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.callbacks.onStatusChange(newStatus);
    }
  }

  public async connect(memoryContext?: any): Promise<void> {
    if (this.status !== 'disconnected') return;

    this.intentionalDisconnect = false;
    this.isConnecting = true;
    this.setStatus('connecting');

    try {
      // 1. Initialize streamer
      this.streamer = new AudioStreamer({
        onVolumeChange: (vol) => {
          this.callbacks.onRiyaVolume(vol);
        },
        onSpeakingChange: (isSpeaking) => {
          if (this.status === 'executing_tool') return;
          if (this.status !== 'disconnected' && this.status !== 'connecting') {
            this.setStatus(isSpeaking ? 'speaking' : 'listening');
          }
        },
      });

      // 2. Initialize recorder
      this.recorder = new AudioRecorder({
        onAudioChunk: (base64Pcm) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ audio: base64Pcm }));
          }
        },
        onVolumeChange: (vol) => {
          this.callbacks.onUserVolume(vol);
        },
      });

      // Start microphone recording
      await this.recorder.start();

      // 3. Connect WebSocket to server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LiveClient] Connected to server bridge');
        // Transmit initial user memory and context to server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'init', memoryContext }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.status === 'connected') {
            this.isConnecting = false;
            this.setStatus('listening');
          }

          if (msg.audio && this.streamer) {
            this.streamer.playAudioChunk(msg.audio);
          }

          if (msg.interrupted && this.streamer) {
            this.streamer.interrupt();
            this.setStatus('listening');
          }

          if (msg.inputTranscript) {
            this.callbacks.onTranscript({
              id: 'u-' + Date.now() + Math.random().toString(36).substring(2, 5),
              speaker: 'user',
              text: msg.inputTranscript,
              timestamp: Date.now(),
            });
          }

          if (msg.outputTranscript) {
            this.callbacks.onTranscript({
              id: 'r-' + Date.now() + Math.random().toString(36).substring(2, 5),
              speaker: 'riya',
              text: msg.outputTranscript,
              timestamp: Date.now(),
            });
          }

          if (msg.toolExecute) {
            const tool = msg.toolExecute;
            this.setStatus('executing_tool');
            this.callbacks.onToolExecute({
              id: tool.id,
              toolName: tool.name,
              args: tool.args,
              timestamp: Date.now(),
            });

            // Return to listening/speaking shortly after UI animation
            setTimeout(() => {
              if (this.status === 'executing_tool') {
                this.setStatus('listening');
              }
            }, 1800);
          }

          if (msg.error) {
            console.error('[LiveClient Server Error]', msg.error);
            this.callbacks.onError(msg.error);
            this.disconnect();
          }
        } catch (e) {
          console.error('[LiveClient] Parse error', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[LiveClient] WebSocket error', err);
        if (!this.intentionalDisconnect) {
          this.callbacks.onError('Connection to voice server failed. Check your network or server status.');
        }
      };

      this.ws.onclose = () => {
        console.log('[LiveClient] WebSocket closed');
        if (!this.intentionalDisconnect) {
          this.disconnect();
        }
      };
    } catch (err: any) {
      console.error('[LiveClient] Setup failed', err);
      const isPermissionDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.toLowerCase().includes('permission') ||
        err.message?.toLowerCase().includes('denied');

      this.callbacks.onError(
        isPermissionDenied
          ? 'Microphone access was denied. Please allow microphone permission in your browser URL bar or open the app in a dedicated tab to talk with Riya.'
          : `Failed to start session: ${err.message || err}`
      );
      this.disconnect();
    }
  }

  public setMuted(muted: boolean) {
    if (this.recorder) {
      this.recorder.setMuted(muted);
    }
  }

  public isMuted(): boolean {
    return this.recorder ? this.recorder.getIsMuted() : false;
  }

  public interrupt() {
    if (this.streamer) {
      this.streamer.interrupt();
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'interrupt' }));
    }
    this.setStatus('listening');
  }

  public disconnect() {
    this.intentionalDisconnect = true;
    this.isConnecting = false;

    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }

    if (this.streamer) {
      this.streamer.stop();
      this.streamer = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.setStatus('disconnected');
    this.callbacks.onUserVolume(0);
    this.callbacks.onRiyaVolume(0);
  }
}
