import { AudioRecorder } from './AudioRecorder';
import { AudioStreamer } from './AudioStreamer';
import { LiveSessionStatus, ToolCallExecution, LiveTranscriptItem } from '../utils/sessionTypes';

export interface DiagnosticStats {
  chunksSent: number;
  chunksReceived: number;
  playbackActive: boolean;
  microphoneActive: boolean;
  configVersion?: number;
  geminiModel?: string;
  lastError?: string | null;
}

export interface LiveClientCallbacks {
  onStatusChange: (status: LiveSessionStatus) => void;
  onUserVolume: (volume: number) => void;
  onRiyaVolume: (volume: number) => void;
  onTranscript: (item: LiveTranscriptItem) => void;
  onToolExecute: (tool: ToolCallExecution) => void;
  onError: (errorMsg: string) => void;
  onDiagnosticStats?: (stats: DiagnosticStats) => void;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private streamer: AudioStreamer | null = null;
  private status: LiveSessionStatus = 'disconnected';
  private callbacks: LiveClientCallbacks;
  private isConnecting: boolean = false;
  private intentionalDisconnect: boolean = false;

  // Diagnostic Stats
  private chunksSent: number = 0;
  private chunksReceived: number = 0;
  private microphoneActive: boolean = false;
  private configVersion: number = 1;
  private geminiModel: string = 'gemini-3.1-flash-live-preview';
  private lastError: string | null = null;

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
      this.notifyDiagnosticStats();
    }
  }

  private notifyDiagnosticStats() {
    if (this.callbacks.onDiagnosticStats) {
      this.callbacks.onDiagnosticStats({
        chunksSent: this.chunksSent,
        chunksReceived: this.chunksReceived,
        playbackActive: this.streamer ? this.streamer.getIsPlaying() : false,
        microphoneActive: this.microphoneActive,
        configVersion: this.configVersion,
        geminiModel: this.geminiModel,
        lastError: this.lastError,
      });
    }
  }

  public async connect(memoryContext?: any): Promise<void> {
    if (this.status !== 'disconnected') return;

    this.intentionalDisconnect = false;
    this.isConnecting = true;
    this.chunksSent = 0;
    this.chunksReceived = 0;
    this.lastError = null;
    this.setStatus('connecting');

    try {
      // 1. Initialize streamer and unlock Web Audio API on user gesture
      this.streamer = new AudioStreamer({
        onVolumeChange: (vol) => {
          this.callbacks.onRiyaVolume(vol);
        },
        onSpeakingChange: (isSpeaking) => {
          if (this.status === 'executing_tool') return;
          if (this.status !== 'disconnected' && this.status !== 'connecting') {
            this.setStatus(isSpeaking ? 'speaking' : 'listening');
          }
          this.notifyDiagnosticStats();
        },
      });
      this.streamer.resume();

      // 2. Initialize recorder
      this.recorder = new AudioRecorder({
        onAudioChunk: (base64Pcm) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ audio: base64Pcm }));
            this.chunksSent++;
            this.notifyDiagnosticStats();
          }
        },
        onVolumeChange: (vol) => {
          this.callbacks.onUserVolume(vol);
        },
      });

      // Start microphone recording
      await this.recorder.start();
      this.microphoneActive = true;
      this.notifyDiagnosticStats();

      // 3. Connect WebSocket to server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LiveClient] Connected to server bridge');
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'init', memoryContext }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.status === 'connected') {
            this.isConnecting = false;
            if (msg.model) this.geminiModel = msg.model;
            if (msg.configVersion) this.configVersion = msg.configVersion;
            this.setStatus('listening');
            this.notifyDiagnosticStats();
          }

          if (msg.audio && this.streamer) {
            this.chunksReceived++;
            this.streamer.playAudioChunk(msg.audio);
            this.notifyDiagnosticStats();
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

            setTimeout(() => {
              if (this.status === 'executing_tool') {
                this.setStatus('listening');
              }
            }, 1800);
          }

          if (msg.error) {
            console.error('[LiveClient Server Error]', msg.error);
            this.lastError = msg.error;
            this.callbacks.onError(msg.error);
            this.notifyDiagnosticStats();
            this.disconnect();
          }
        } catch (e) {
          console.error('[LiveClient] Parse error', e);
        }
      };

      this.ws.onerror = (evt: Event) => {
        console.warn('[LiveClient] WebSocket connection event:', evt.type || 'error');
        if (!this.intentionalDisconnect && !this.lastError) {
          const errStr = 'Connection to voice server disconnected. Please check your network or API status.';
          this.lastError = errStr;
          this.callbacks.onError(errStr);
          this.notifyDiagnosticStats();
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

      const errorMsg = isPermissionDenied
        ? 'Microphone access was denied. Please allow microphone permission in your browser URL bar or open the app in a dedicated tab to talk with Riya.'
        : `Failed to start session: ${err.message || err}`;

      this.lastError = errorMsg;
      this.callbacks.onError(errorMsg);
      this.notifyDiagnosticStats();
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
    this.microphoneActive = false;

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
    this.notifyDiagnosticStats();
  }
}

