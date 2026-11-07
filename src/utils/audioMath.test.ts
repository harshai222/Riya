import test from 'node:test';
import assert from 'node:assert/strict';
import {
  float32ToPcm16,
  pcm16ToFloat32,
  resampleAudioBuffer,
  arrayBufferToBase64,
  base64ToPcm16,
  computeRmsVolume,
} from './audioMath';

test('float32ToPcm16 clamps and converts correctly', () => {
  const input = new Float32Array([0, 1, -1, 1.5, -1.5, 0.5]);
  const pcm = float32ToPcm16(input);

  assert.equal(pcm.length, 6);
  assert.equal(pcm[0], 0);
  assert.equal(pcm[1], 32767); // 0x7fff
  assert.equal(pcm[2], -32768); // -0x8000
  assert.equal(pcm[3], 32767); // clamped
  assert.equal(pcm[4], -32768); // clamped
  assert.ok(pcm[5] > 16300 && pcm[5] < 16400);
});

test('pcm16ToFloat32 roundtrips without significant loss', () => {
  const original = new Float32Array([0, 0.25, -0.5, 0.75, -0.9]);
  const pcm = float32ToPcm16(original);
  const reconstructed = pcm16ToFloat32(pcm);

  for (let i = 0; i < original.length; i++) {
    assert.ok(Math.abs(original[i] - reconstructed[i]) < 0.001);
  }
});

test('resampleAudioBuffer scales buffer length according to sample rate ratio', () => {
  const input = new Float32Array(48000); // 1 second at 48kHz
  const output = resampleAudioBuffer(input, 48000, 16000);
  assert.equal(output.length, 16000);
});

test('base64ToPcm16 and arrayBufferToBase64 encode/decode accurately', () => {
  const pcmOriginal = new Int16Array([0, 1000, -2500, 32767, -32768]);
  const b64 = arrayBufferToBase64(pcmOriginal);
  assert.ok(typeof b64 === 'string');
  assert.ok(b64.length > 0);

  const decoded = base64ToPcm16(b64);
  assert.equal(decoded.length, pcmOriginal.length);
  for (let i = 0; i < pcmOriginal.length; i++) {
    assert.equal(decoded[i], pcmOriginal[i]);
  }
});

test('computeRmsVolume calculates expected volume range', () => {
  const silent = new Float32Array([0, 0, 0, 0]);
  assert.equal(computeRmsVolume(silent), 0);

  const loud = new Float32Array([1, -1, 1, -1]);
  const vol = computeRmsVolume(loud);
  assert.equal(vol, 1); // clamped to 1
});
