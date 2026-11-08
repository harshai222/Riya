import { base64ToPcm16, pcm16ToFloat32, computeRmsVolume } from '../utils/audioMath';

export class AudioStreamer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private analyser: AnalyserNode | null = null;
  private volumeCheckInterval: number | null = null;
  private onVolumeChange?: (volume: number) => void;
  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private isSpeaking: boolean = false;
  private speakingTimeout: any = null;

  constructor(callbacks?: {
    onVolumeChange?: (volume: number) => void;
    onSpeakingChange?: (isSpeaking: boolean) => void;
  }) {
    this.onVolumeChange = callbacks?.onVolumeChange;
    this.onSpeakingChange = callbacks?.onSpeakingChange;
  }

  public resume() {
    this.initContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch((err) => {
        console.warn('[AudioStreamer] Resume error:', err);
      });
    }
  }

  private initContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      // Output sample rate 24kHz matching Gemini Live
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      this.analyser.connect(this.audioCtx.destination);
      this.nextStartTime = this.audioCtx.currentTime;
      this.startVolumeMonitoring();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private startVolumeMonitoring() {
    if (this.volumeCheckInterval) return;
    const buffer = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 128);

    this.volumeCheckInterval = window.setInterval(() => {
      if (!this.analyser || this.activeSources.size === 0) {
        if (this.onVolumeChange) this.onVolumeChange(0);
        return;
      }
      this.analyser.getByteFrequencyData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
      }
      const avg = sum / buffer.length / 255;
      if (this.onVolumeChange) {
        this.onVolumeChange(Math.min(1, avg * 2.2));
      }
    }, 40);
  }

  private stopVolumeMonitoring() {
    if (this.volumeCheckInterval) {
      clearInterval(this.volumeCheckInterval);
      this.volumeCheckInterval = null;
    }
    if (this.onVolumeChange) this.onVolumeChange(0);
  }

  public playAudioChunk(base64Pcm: string) {
    this.initContext();
    if (!this.audioCtx || !this.analyser) return;

    try {
      const int16Samples = base64ToPcm16(base64Pcm);
      if (int16Samples.length === 0) return;

      const float32Samples = pcm16ToFloat32(int16Samples);
      const audioBuffer = this.audioCtx.createBuffer(1, float32Samples.length, 24000);
      audioBuffer.getChannelData(0).set(float32Samples);

      const sourceNode = this.audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.analyser);

      const currentTime = this.audioCtx.currentTime;
      // Schedule gapless playback
      const scheduledTime = Math.max(currentTime, this.nextStartTime);
      sourceNode.start(scheduledTime);
      this.nextStartTime = scheduledTime + audioBuffer.duration;

      this.activeSources.add(sourceNode);
      this.updateSpeakingState(true);

      sourceNode.onended = () => {
        this.activeSources.delete(sourceNode);
        if (this.activeSources.size === 0) {
          // Add a brief cushion before marking speaking as false
          clearTimeout(this.speakingTimeout);
          this.speakingTimeout = setTimeout(() => {
            if (this.activeSources.size === 0) {
              this.updateSpeakingState(false);
            }
          }, 100);
        }
      };
    } catch (err) {
      console.error('Failed to play audio chunk:', err);
    }
  }

  private updateSpeakingState(speaking: boolean) {
    if (this.isSpeaking !== speaking) {
      this.isSpeaking = speaking;
      if (this.onSpeakingChange) {
        this.onSpeakingChange(speaking);
      }
    }
  }

  public getIsPlaying(): boolean {
    return this.activeSources.size > 0 || this.isSpeaking;
  }

  /**
   * Immediately interrupts and flushes queued audio
   */
  public interrupt() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already have ended
      }
    }
    this.activeSources.clear();
    clearTimeout(this.speakingTimeout);
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
    this.updateSpeakingState(false);
    if (this.onVolumeChange) this.onVolumeChange(0);
  }

  public stop() {
    this.interrupt();
    this.stopVolumeMonitoring();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
      this.analyser = null;
    }
  }
}
