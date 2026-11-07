/**
 * Audio processing utilities for Gemini Live API
 * Input: PCM16 16kHz
 * Output: PCM16 24kHz
 */

/**
 * Converts Float32Array from Web Audio API [-1.0, 1.0] to 16-bit PCM ArrayBuffer (Little Endian)
 */
export function float32ToPcm16(float32Array: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to [-1, 1]
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // Convert to 16-bit signed int
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

/**
 * Converts 16-bit PCM Int16Array to Float32Array [-1.0, 1.0] for Web Audio playback
 */
export function pcm16ToFloat32(pcm16Array: Int16Array): Float32Array {
  const float32 = new Float32Array(pcm16Array.length);
  for (let i = 0; i < pcm16Array.length; i++) {
    const s = pcm16Array[i];
    float32[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
  }
  return float32;
}

/**
 * Resamples Float32 audio buffer from native source sample rate to target sample rate (e.g. 48kHz/44.1kHz -> 16kHz)
 */
export function resampleAudioBuffer(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number = 16000
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return input;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.round(input.length / ratio);
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = i * ratio;
    const indexFloor = Math.floor(sourceIndex);
    const indexCeil = Math.min(input.length - 1, Math.ceil(sourceIndex));
    const fraction = sourceIndex - indexFloor;

    // Linear interpolation
    result[i] = input[indexFloor] * (1 - fraction) + input[indexCeil] * fraction;
  }

  return result;
}

/**
 * Converts ArrayBuffer / TypedArray to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  let bytes: Uint8Array;
  if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    bytes = new Uint8Array(buffer);
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Works in browser (btoa) and Node (Buffer)
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Converts Base64 string to Int16Array (PCM16 Little Endian)
 */
export function base64ToPcm16(base64: string): Int16Array {
  let binaryString: string;
  if (typeof atob === 'function') {
    binaryString = atob(base64);
  } else {
    binaryString = Buffer.from(base64, 'base64').toString('binary');
  }

  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Ensure byte length is even for 16-bit samples
  const sampleCount = Math.floor(len / 2);
  const int16 = new Int16Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let i = 0; i < sampleCount; i++) {
    int16[i] = view.getInt16(i * 2, true); // Little endian
  }

  return int16;
}

/**
 * Computes root-mean-square (RMS) energy level between 0 and 1
 */
export function computeRmsVolume(buffer: Float32Array | Int16Array): number {
  if (buffer.length === 0) return 0;
  let sum = 0;

  if (buffer instanceof Float32Array) {
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.min(1, Math.sqrt(sum / buffer.length) * 3); // scaled for UI responsiveness
  } else {
    for (let i = 0; i < buffer.length; i++) {
      const normalized = buffer[i] / 32768;
      sum += normalized * normalized;
    }
    return Math.min(1, Math.sqrt(sum / buffer.length) * 3);
  }
}
