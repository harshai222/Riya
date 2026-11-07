import {
  float32ToPcm16,
  resampleAudioBuffer,
  arrayBufferToBase64,
  computeRmsVolume,
} from '../utils/audioMath';

export class AudioRecorder {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isMuted: boolean = false;
  private isRecording: boolean = false;
  private onAudioChunk?: (base64Pcm: string) => void;
  private onVolumeChange?: (volume: number) => void;

  constructor(callbacks?: {
    onAudioChunk?: (base64Pcm: string) => void;
    onVolumeChange?: (volume: number) => void;
  }) {
    this.onAudioChunk = callbacks?.onAudioChunk;
    this.onVolumeChange = callbacks?.onVolumeChange;
  }

  public async start(): Promise<void> {
    if (this.isRecording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Audio capture is not supported in this browser or context. Please use a modern browser with HTTPS.'
      );
    }

    try {
      // First attempt with optimal audio processing constraints
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (firstErr: any) {
        // If not allowed, re-throw immediately so caller gets the permission error
        if (
          firstErr.name === 'NotAllowedError' ||
          firstErr.name === 'PermissionDeniedError' ||
          firstErr.message?.toLowerCase().includes('permission')
        ) {
          throw firstErr;
        }

        console.warn('Advanced audio constraints failed, retrying with fallback audio:true', firstErr);
        // Fallback to basic audio constraint for hardware that rejects specific parameters
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      // ScriptProcessor with 4096 buffer size
      this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);

      const sourceSampleRate = this.audioCtx.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);

        // Volume calculation for visualizer
        const rms = computeRmsVolume(inputChannelData);
        if (this.onVolumeChange) {
          this.onVolumeChange(this.isMuted ? 0 : rms);
        }

        if (this.isMuted) return;

        // Resample from current device sampleRate (e.g. 48000 / 44100) down to 16000
        const resampled = resampleAudioBuffer(inputChannelData, sourceSampleRate, 16000);
        const pcm16 = float32ToPcm16(resampled);
        const base64 = arrayBufferToBase64(pcm16);

        if (this.onAudioChunk) {
          this.onAudioChunk(base64);
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioCtx.destination);
      this.isRecording = true;
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      this.stop();
      throw err;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public stop() {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }

    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }
}
