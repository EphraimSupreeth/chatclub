import { describe, expect, test, vi } from 'vitest';
import { getIceServers, stopMedia } from './webrtc';

describe('WebRTC configuration', () => {
  test('uses a development STUN server when no configuration is supplied', () => {
    expect(getIceServers('')).toEqual([
      { urls: 'stun:stun.l.google.com:19302' },
    ]);
  });

  test('accepts a configured STUN and TURN array', () => {
    const servers = [
      { urls: 'stun:stun.example.test:3478' },
      {
        urls: 'turn:turn.example.test:3478',
        username: 'temporary',
        credential: 'temporary',
      },
    ];

    expect(getIceServers(JSON.stringify(servers))).toEqual(servers);
  });

  test('rejects malformed ICE configuration', () => {
    expect(() => getIceServers('{bad json')).toThrow(
      'VITE_WEBRTC_ICE_SERVERS must be a JSON array.',
    );
  });

  test('stops every local media track', () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    stopMedia({ getTracks: () => tracks });

    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce());
  });
});
