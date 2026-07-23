import { useCallback, useEffect, useRef, useState } from 'react';
import { getLiveKitCallToken } from '../services/chatclubApi';

const loadLiveKit = () => import('livekit-client');

const initialCall = {
  status: 'idle',
  callId: null,
  incomingFrom: '',
  error: '',
};
const emptyDevices = {
  audioinput: [],
  videoinput: [],
  audiooutput: [],
};

function newCallId() {
  return globalThis.crypto?.randomUUID?.() ??
    `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function streamFromPublications(publications) {
  const tracks = [...publications.values()]
    .map((publication) => publication.track?.mediaStreamTrack)
    .filter(Boolean);
  return tracks.length ? new MediaStream(tracks) : null;
}

export default function usePeerCall({
  sendSignal,
  peerName,
  classroomId,
  peerUserId,
}) {
  const [call, setCall] = useState(initialCall);
  const [localStream, setLocalStream] = useState(null);
  const [previewStream, setPreviewStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [devices, setDevices] = useState(emptyDevices);
  const [selectedDevices, setSelectedDevices] = useState({});
  const [deviceStatus, setDeviceStatus] = useState('');
  const [joinWithMicrophone, setJoinWithMicrophone] = useState(false);
  const [joinWithCamera, setJoinWithCamera] = useState(false);
  const roomRef = useRef(null);
  const previewStreamRef = useRef(null);
  const roomPromiseRef = useRef(null);
  const lifecycleRef = useRef(0);
  const callRef = useRef(call);
  const selectedDevicesRef = useRef(selectedDevices);
  const mediaPreferencesRef = useRef({
    microphone: joinWithMicrophone,
    camera: joinWithCamera,
  });

  callRef.current = call;
  selectedDevicesRef.current = selectedDevices;
  mediaPreferencesRef.current = {
    microphone: joinWithMicrophone,
    camera: joinWithCamera,
  };

  const stopPreview = useCallback(() => {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    setPreviewStream(null);
  }, []);

  const cleanup = useCallback(async () => {
    lifecycleRef.current += 1;
    stopPreview();
    const room = roomRef.current;
    roomRef.current = null;
    roomPromiseRef.current = null;
    if (room) await room.disconnect();
    setLocalStream(null);
    setRemoteStream(null);
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    setAudioBlocked(false);
    setDeviceStatus('');
  }, [stopPreview]);

  useEffect(() => () => {
    void cleanup();
  }, [cleanup]);

  const connectRoom = useCallback(async (callId) => {
    if (roomRef.current) return roomRef.current;
    if (roomPromiseRef.current) return roomPromiseRef.current;

    stopPreview();
    const lifecycle = lifecycleRef.current;
    roomPromiseRef.current = (async () => {
      const { token, url } = await getLiveKitCallToken({
        classroomId,
        peerUserId,
        callId,
      });
      if (lifecycle !== lifecycleRef.current) {
        throw new DOMException('The call ended while connecting.', 'AbortError');
      }

      const { Room, RoomEvent } = await loadLiveKit();
      const preferredDevices = selectedDevicesRef.current;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: true,
        audioCaptureDefaults: preferredDevices.audioinput
          ? { deviceId: preferredDevices.audioinput }
          : undefined,
        videoCaptureDefaults: preferredDevices.videoinput
          ? { deviceId: preferredDevices.videoinput }
          : undefined,
      });

      const refreshRemoteStream = () => {
        if (lifecycle !== lifecycleRef.current) return;
        const participant = [...room.remoteParticipants.values()][0];
        setRemoteStream(
          participant
            ? streamFromPublications(participant.trackPublications)
            : null,
        );
      };
      const refreshLocalStream = () => {
        if (lifecycle !== lifecycleRef.current) return;
        setLocalStream(streamFromPublications(room.localParticipant.trackPublications));
      };

      room
        .on(RoomEvent.TrackSubscribed, refreshRemoteStream)
        .on(RoomEvent.TrackUnsubscribed, refreshRemoteStream)
        .on(RoomEvent.ParticipantDisconnected, () => {
          refreshRemoteStream();
          if (lifecycle !== lifecycleRef.current) return;
          void cleanup().then(() => {
            setCall((current) => ({
              ...current,
              status: 'failed',
              error: `${peerName} left the call.`,
            }));
          });
        })
        .on(RoomEvent.LocalTrackPublished, refreshLocalStream)
        .on(RoomEvent.LocalTrackUnpublished, refreshLocalStream)
        .on(RoomEvent.Reconnecting, () => {
          setCall((current) => ({ ...current, status: 'reconnecting' }));
        })
        .on(RoomEvent.Reconnected, () => {
          setCall((current) => ({ ...current, status: 'connected', error: '' }));
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioBlocked(!room.canPlaybackAudio);
        })
        .on(RoomEvent.ActiveDeviceChanged, (kind, deviceId) => {
          setSelectedDevices((current) => ({ ...current, [kind]: deviceId }));
        })
        .on(RoomEvent.MediaDevicesChanged, () => {
          setDeviceStatus('Device list changed. Reopen settings to refresh it.');
        })
        .on(RoomEvent.Connected, () => {
          setCall((current) =>
            current.status === 'connecting'
              ? { ...current, status: 'connected', error: '' }
              : current,
          );
        })
        .on(RoomEvent.Disconnected, () => {
          if (lifecycle !== lifecycleRef.current || roomRef.current !== room) return;
          roomRef.current = null;
          setLocalStream(null);
          setRemoteStream(null);
          setCall((current) => ({
            ...current,
            status: 'failed',
            error: 'The call disconnected. Check your network and try again.',
          }));
        });

      await room.connect(url, token);
      if (lifecycle !== lifecycleRef.current) {
        await room.disconnect();
        throw new DOMException('The call ended while connecting.', 'AbortError');
      }

      roomRef.current = room;
      const preferences = mediaPreferencesRef.current;
      await room.localParticipant.setMicrophoneEnabled(preferences.microphone);
      await room.localParticipant.setCameraEnabled(preferences.camera);
      setAudioBlocked(!room.canPlaybackAudio);
      refreshLocalStream();
      setMicrophoneEnabled(preferences.microphone);
      setCameraEnabled(preferences.camera);
      return room;
    })();

    try {
      return await roomPromiseRef.current;
    } finally {
      roomPromiseRef.current = null;
    }
  }, [classroomId, cleanup, peerName, peerUserId, stopPreview]);

  const startCall = useCallback(async () => {
    if (!classroomId || !peerUserId) return;
    const callId = newCallId();
    setCall({ status: 'preparing', callId, incomingFrom: '', error: '' });
    try {
      await connectRoom(callId);
      setCall({ status: 'inviting', callId, incomingFrom: '', error: '' });
      await sendSignal('call-invite', { callId });
    } catch (error) {
      await cleanup();
      setCall({ ...initialCall, status: 'failed', error: error.message });
    }
  }, [classroomId, cleanup, connectRoom, peerUserId, sendSignal]);

  const acceptCall = useCallback(async () => {
    const { callId } = callRef.current;
    if (!callId) return;
    setCall((current) => ({ ...current, status: 'connecting', error: '' }));
    try {
      await connectRoom(callId);
      await sendSignal('call-accept', { callId });
    } catch (error) {
      await cleanup();
      setCall({ ...initialCall, status: 'failed', error: error.message });
      try {
        await sendSignal('call-failed', {
          callId,
          message: error.message,
        });
      } catch {
        // The recipient still receives their local authorization error.
      }
    }
  }, [cleanup, connectRoom, sendSignal]);

  const endCall = useCallback(async (reason = 'ended') => {
    const { callId } = callRef.current;
    if (callId) {
      try {
        await sendSignal('call-end', { callId, reason });
      } catch {
        // Local media and the LiveKit room must still close if signaling is down.
      }
    }
    await cleanup();
    setCall(initialCall);
  }, [cleanup, sendSignal]);

  useEffect(() => {
    if (call.status !== 'inviting') return undefined;
    const timeout = window.setTimeout(() => {
      void endCall('unanswered').then(() => {
        setCall({
          ...initialCall,
          status: 'failed',
          error: `${peerName} did not answer.`,
        });
      });
    }, 30000);
    return () => window.clearTimeout(timeout);
  }, [call.status, endCall, peerName]);

  const handleSignal = useCallback(async (event, payload) => {
    if (!payload?.callId) return;
    const current = callRef.current;

    if (event === 'call-invite' && current.status === 'idle') {
      setCall({
        status: 'incoming',
        callId: payload.callId,
        incomingFrom: peerName,
        error: '',
      });
      return;
    }
    if (payload.callId !== current.callId) return;

    try {
      if (event === 'call-accept' && current.status === 'inviting') {
        setCall((value) => ({ ...value, status: 'connecting' }));
        await connectRoom(payload.callId);
        setCall((value) => ({ ...value, status: 'connected', error: '' }));
      } else if (event === 'call-failed') {
        await cleanup();
        setCall({
          ...initialCall,
          status: 'failed',
          error: payload.message || `${peerName} could not join the call.`,
        });
      } else if (event === 'call-end') {
        await cleanup();
        setCall(initialCall);
      }
      // SDP and ICE events from older clients are intentionally ignored.
    } catch (error) {
      await cleanup();
      setCall({ ...initialCall, status: 'failed', error: error.message });
      try {
        await sendSignal('call-failed', {
          callId: payload.callId,
          message: error.message,
        });
      } catch {
        // The local failure remains visible even if the peer is already offline.
      }
    }
  }, [cleanup, connectRoom, peerName, sendSignal]);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const nextEnabled = !microphoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(nextEnabled);
    setMicrophoneEnabled(nextEnabled);
    setLocalStream(streamFromPublications(room.localParticipant.trackPublications));
  }, [microphoneEnabled]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const nextEnabled = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(nextEnabled);
      setCameraEnabled(nextEnabled);
      setLocalStream(streamFromPublications(room.localParticipant.trackPublications));
    } catch (error) {
      setCall((current) => ({ ...current, error: error.message }));
    }
  }, [cameraEnabled]);

  const resumeAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setAudioBlocked(!room.canPlaybackAudio);
    } catch (error) {
      setCall((current) => ({ ...current, error: error.message }));
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    const room = roomRef.current;
    setDeviceStatus('Loading devices…');
    try {
      const { Room } = await loadLiveKit();
      const kinds = ['audioinput', 'videoinput', 'audiooutput'];
      const results = await Promise.all(
        kinds.map((kind) => Room.getLocalDevices(kind, false)),
      );
      setDevices(Object.fromEntries(
        kinds.map((kind, index) => [kind, results[index]]),
      ));
      setSelectedDevices(Object.fromEntries(
        kinds.map((kind, index) => [
          kind,
          room?.getActiveDevice(kind) ??
            selectedDevicesRef.current[kind] ??
            results[index][0]?.deviceId ??
            '',
        ]),
      ));
      setDeviceStatus('');
    } catch (error) {
      setDeviceStatus(error.message);
    }
  }, []);

  const openPreview = useCallback(async (
    preferred = selectedDevicesRef.current,
    initializePreferences = false,
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera and microphone access is not supported by this browser.');
    }

    const constraints = {
      audio: preferred.audioinput
        ? { deviceId: { exact: preferred.audioinput } }
        : true,
      video: preferred.videoinput
        ? { deviceId: { exact: preferred.videoinput } }
        : { facingMode: 'user' },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const oldStream = previewStreamRef.current;
    previewStreamRef.current = stream;
    setPreviewStream(stream);
    oldStream?.getTracks().forEach((track) => track.stop());

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];
    const microphone = initializePreferences
      ? Boolean(audioTrack)
      : mediaPreferencesRef.current.microphone;
    const camera = initializePreferences
      ? Boolean(videoTrack)
      : mediaPreferencesRef.current.camera;
    setJoinWithMicrophone(microphone);
    setJoinWithCamera(camera);
    if (audioTrack) audioTrack.enabled = microphone;
    if (videoTrack) videoTrack.enabled = camera;
    const nextSelectedDevices = {
      ...selectedDevicesRef.current,
      audioinput:
        audioTrack?.getSettings().deviceId ||
        selectedDevicesRef.current.audioinput ||
        '',
      videoinput:
        videoTrack?.getSettings().deviceId ||
        selectedDevicesRef.current.videoinput ||
        '',
    };
    selectedDevicesRef.current = nextSelectedDevices;
    setSelectedDevices(nextSelectedDevices);
    return stream;
  }, []);

  const prepareLobby = useCallback(async () => {
    setDeviceStatus('Allow camera and microphone access to review your devices.');
    try {
      await openPreview(selectedDevicesRef.current, true);
      await refreshDevices();
      setDeviceStatus('');
    } catch (error) {
      stopPreview();
      setJoinWithMicrophone(false);
      setJoinWithCamera(false);
      if (error.name === 'NotAllowedError') {
        setDeviceStatus(
          'Camera and microphone access was blocked. Allow access in your browser, then try again.',
        );
      } else if (error.name === 'NotFoundError') {
        setDeviceStatus('No camera or microphone was found.');
      } else {
        setDeviceStatus(error.message);
      }
      await refreshDevices();
    }
  }, [openPreview, refreshDevices, stopPreview]);

  const switchDevice = useCallback(async (kind, deviceId) => {
    const room = roomRef.current;
    if (!deviceId) return;
    if (!room) {
      setSelectedDevices((current) => ({ ...current, [kind]: deviceId }));
      if (previewStreamRef.current && kind !== 'audiooutput') {
        setDeviceStatus('Switching device…');
        try {
          await openPreview(
            {
              ...selectedDevicesRef.current,
              [kind]: deviceId,
            },
            false,
          );
          setDeviceStatus('');
        } catch (error) {
          setDeviceStatus(`Could not switch device: ${error.message}`);
        }
      }
      return;
    }
    setDeviceStatus('Switching device…');
    try {
      await room.switchActiveDevice(kind, deviceId);
      setSelectedDevices((current) => ({ ...current, [kind]: deviceId }));
      setDeviceStatus('');
    } catch (error) {
      setDeviceStatus(error.message);
    }
  }, [openPreview]);

  const setJoinPreference = useCallback((kind, enabled) => {
    if (kind === 'microphone') {
      setJoinWithMicrophone(enabled);
      const track = previewStreamRef.current?.getAudioTracks()[0];
      if (track) track.enabled = enabled;
    }
    if (kind === 'camera') {
      setJoinWithCamera(enabled);
      const track = previewStreamRef.current?.getVideoTracks()[0];
      if (track) track.enabled = enabled;
    }
  }, []);

  return {
    ...call,
    localStream,
    previewStream,
    remoteStream,
    cameraEnabled,
    microphoneEnabled,
    audioBlocked,
    mediaReady: Boolean(roomRef.current),
    devices,
    selectedDevices,
    deviceStatus,
    speakerSelectionSupported: Boolean(
      globalThis.HTMLMediaElement?.prototype &&
      'setSinkId' in globalThis.HTMLMediaElement.prototype
    ),
    joinWithMicrophone,
    joinWithCamera,
    startCall,
    acceptCall,
    declineCall: () => endCall('declined'),
    endCall,
    handleSignal,
    toggleCamera,
    toggleMicrophone,
    resumeAudio,
    refreshDevices,
    prepareLobby,
    cancelLobby: stopPreview,
    switchDevice,
    setJoinPreference,
  };
}
