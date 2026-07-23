import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const liveKit = vi.hoisted(() => {
  const rooms = [];
  const events = {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    ParticipantDisconnected: 'participantDisconnected',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Connected: 'connected',
    Disconnected: 'disconnected',
    AudioPlaybackStatusChanged: 'audioPlaybackStatusChanged',
    ActiveDeviceChanged: 'activeDeviceChanged',
    MediaDevicesChanged: 'mediaDevicesChanged',
  };

  function makeRoom() {
    const handlers = new Map();
    const room = {
      handlers,
      remoteParticipants: new Map(),
      canPlaybackAudio: true,
      activeDevices: {
        audioinput: 'mic-1',
        videoinput: 'camera-1',
        audiooutput: 'speaker-1',
      },
      localParticipant: {
        trackPublications: new Map(),
        setMicrophoneEnabled: vi.fn(async () => {}),
        setCameraEnabled: vi.fn(async () => {}),
      },
      on: vi.fn((event, handler) => {
        handlers.set(event, handler);
        return room;
      }),
      connect: vi.fn(async () => {
        handlers.get(events.Connected)?.();
      }),
      disconnect: vi.fn(async () => {}),
      startAudio: vi.fn(async () => {}),
      getActiveDevice: vi.fn((kind) => room.activeDevices[kind]),
      switchActiveDevice: vi.fn(async (kind, deviceId) => {
        room.activeDevices[kind] = deviceId;
        handlers.get(events.ActiveDeviceChanged)?.(kind, deviceId);
        return true;
      }),
    };
    rooms.push(room);
    return room;
  }

  return { rooms, events, makeRoom };
});

const api = vi.hoisted(() => ({
  getLiveKitCallToken: vi.fn(),
}));

vi.mock('livekit-client', () => ({
  Room: Object.assign(
    vi.fn(function Room() {
      return liveKit.makeRoom();
    }),
    {
      getLocalDevices: vi.fn(async (kind) => {
        const devices = {
          audioinput: [
            { deviceId: 'mic-1', kind, label: 'Built-in microphone' },
            { deviceId: 'mic-2', kind, label: 'USB microphone' },
          ],
          videoinput: [
            { deviceId: 'camera-1', kind, label: 'FaceTime camera' },
          ],
          audiooutput: [
            { deviceId: 'speaker-1', kind, label: 'Built-in output' },
          ],
        };
        return devices[kind];
      }),
    },
  ),
  RoomEvent: liveKit.events,
  Track: {},
}));
vi.mock('../services/chatclubApi', () => api);

import usePeerCall from './usePeerCall';

const hookProps = {
  peerName: 'Arjun Rao',
  classroomId: 'classroom-id',
  peerUserId: 'peer-id',
};

describe('reliable LiveKit call lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveKit.rooms.length = 0;
    api.getLiveKitCallToken.mockResolvedValue({
      token: 'short-lived-token',
      url: 'wss://chatclub.livekit.cloud',
    });
    globalThis.MediaStream = class MediaStream {
      constructor(tracks = []) {
        this.tracks = tracks;
      }
    };
  });

  test('joins an authorized room before accepting an incoming call', async () => {
    const sendSignal = vi.fn(async () => 'ok');
    const { result } = renderHook(() =>
      usePeerCall({ ...hookProps, sendSignal }),
    );

    await act(() => result.current.handleSignal('call-invite', {
      callId: 'call-12345',
    }));
    expect(result.current.status).toBe('incoming');

    await act(() => result.current.acceptCall());

    expect(api.getLiveKitCallToken).toHaveBeenCalledWith({
      classroomId: 'classroom-id',
      peerUserId: 'peer-id',
      callId: 'call-12345',
    });
    expect(liveKit.rooms[0].connect).toHaveBeenCalledWith(
      'wss://chatclub.livekit.cloud',
      'short-lived-token',
    );
    expect(liveKit.rooms[0].localParticipant.setMicrophoneEnabled)
      .toHaveBeenCalledWith(true);
    expect(sendSignal).toHaveBeenCalledWith('call-accept', {
      callId: 'call-12345',
    });
    expect(result.current.status).toBe('connected');
  });

  test('caller joins the same room after the invitation is accepted', async () => {
    const sendSignal = vi.fn(async () => 'ok');
    const { result } = renderHook(() =>
      usePeerCall({ ...hookProps, sendSignal }),
    );

    await act(() => result.current.startCall());
    const callId = result.current.callId;
    expect(liveKit.rooms[0].connect).toHaveBeenCalledOnce();
    expect(sendSignal).toHaveBeenCalledWith('call-invite', { callId });
    await act(() => result.current.handleSignal('call-accept', { callId }));

    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(liveKit.rooms).toHaveLength(1);

    await act(() => result.current.handleSignal('call-answer', {
      callId,
      description: { type: 'answer', sdp: 'old-client-answer' },
    }));
    expect(result.current.status).toBe('connected');
  });

  test('shows the peer authorization failure on the caller', async () => {
    const { result } = renderHook(() =>
      usePeerCall({ ...hookProps, sendSignal: vi.fn(async () => 'ok') }),
    );

    await act(() => result.current.startCall());
    const callId = result.current.callId;
    await act(() => result.current.handleSignal('call-failed', {
      callId,
      message: 'Calling service is not configured',
    }));

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Calling service is not configured');
  });

  test('surfaces a reconnecting state and recovers cleanly', async () => {
    const { result } = renderHook(() =>
      usePeerCall({ ...hookProps, sendSignal: vi.fn(async () => 'ok') }),
    );

    await act(() => result.current.startCall());
    const callId = result.current.callId;
    await act(() => result.current.handleSignal('call-accept', { callId }));
    const room = liveKit.rooms[0];

    act(() => room.handlers.get(liveKit.events.Reconnecting)?.());
    expect(result.current.status).toBe('reconnecting');
    act(() => room.handlers.get(liveKit.events.Reconnected)?.());
    expect(result.current.status).toBe('connected');
  });

  test('lists and switches call devices without reconnecting', async () => {
    const { result } = renderHook(() =>
      usePeerCall({ ...hookProps, sendSignal: vi.fn(async () => 'ok') }),
    );
    await act(() => result.current.startCall());

    await act(() => result.current.refreshDevices());
    expect(result.current.devices.audioinput).toHaveLength(2);
    expect(result.current.selectedDevices.audioinput).toBe('mic-1');

    await act(() => result.current.switchDevice('audioinput', 'mic-2'));
    expect(liveKit.rooms[0].switchActiveDevice)
      .toHaveBeenCalledWith('audioinput', 'mic-2');
    expect(result.current.selectedDevices.audioinput).toBe('mic-2');
  });
});
