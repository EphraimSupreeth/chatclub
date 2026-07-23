import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const media = vi.hoisted(() => ({
  createPeerConnection: vi.fn(),
  getCallMedia: vi.fn(),
  stopMedia: vi.fn(),
}));

vi.mock('../lib/webrtc', () => media);

import usePeerCall from './usePeerCall';

function makePeer() {
  return {
    signalingState: 'stable',
    connectionState: 'new',
    remoteDescription: null,
    localDescription: null,
    addTrack: vi.fn(),
    addTransceiver: vi.fn(() => ({
      receiver: { track: { kind: 'video' } },
      sender: { replaceTrack: vi.fn() },
    })),
    getTransceivers: vi.fn(() => []),
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' })),
    createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' })),
    setLocalDescription: vi.fn(async function setLocal(description) {
      this.localDescription = description;
      this.signalingState = description.type === 'offer'
        ? 'have-local-offer'
        : 'stable';
    }),
    setRemoteDescription: vi.fn(async function setRemote(description) {
      this.remoteDescription = description;
      this.signalingState = description.type === 'offer'
        ? 'have-remote-offer'
        : 'stable';
    }),
    addIceCandidate: vi.fn(),
    close: vi.fn(),
  };
}

describe('WebRTC signaling state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    media.getCallMedia.mockResolvedValue({
      getTracks: () => [{ kind: 'audio' }],
      getAudioTracks: () => [{ enabled: true }],
      getVideoTracks: () => [],
    });
  });

  test('applies a remote answer only once and only while an offer is pending', async () => {
    const peer = makePeer();
    media.createPeerConnection.mockReturnValue(peer);
    const sendSignal = vi.fn(async () => 'ok');
    const { result } = renderHook(() =>
      usePeerCall({ sendSignal, peerName: 'Arjun Rao' }),
    );

    await act(() => result.current.startCall());
    const callId = result.current.callId;
    await act(() => result.current.handleSignal('call-accept', { callId }));
    await waitFor(() => expect(peer.signalingState).toBe('have-local-offer'));

    const answer = { type: 'answer', sdp: 'answer-sdp' };
    await act(() => result.current.handleSignal('call-answer', {
      callId,
      description: answer,
    }));
    await act(() => result.current.handleSignal('call-answer', {
      callId,
      description: answer,
    }));

    expect(peer.setRemoteDescription).toHaveBeenCalledOnce();
    expect(result.current.status).not.toBe('failed');
  });

  test('ignores an answer when the peer is already stable', async () => {
    const peer = makePeer();
    media.createPeerConnection.mockReturnValue(peer);
    const { result } = renderHook(() =>
      usePeerCall({ sendSignal: vi.fn(async () => 'ok'), peerName: 'Arjun Rao' }),
    );

    await act(() => result.current.startCall());
    const callId = result.current.callId;
    await act(() => result.current.handleSignal('call-accept', { callId }));
    peer.signalingState = 'stable';
    await act(() => result.current.handleSignal('call-answer', {
      callId,
      description: { type: 'answer', sdp: 'late-answer' },
    }));

    expect(peer.setRemoteDescription).not.toHaveBeenCalled();
    expect(result.current.status).not.toBe('failed');
  });
});
