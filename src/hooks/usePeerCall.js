import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPeerConnection,
  getCallMedia,
  stopMedia,
} from '../lib/webrtc';

const initialCall = {
  status: 'idle',
  callId: null,
  incomingFrom: '',
  error: '',
};

function newCallId() {
  return globalThis.crypto?.randomUUID?.() ??
    `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function usePeerCall({ sendSignal, peerName }) {
  const [call, setCall] = useState(initialCall);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const peerRef = useRef(null);
  const peerPromiseRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const candidateKeysRef = useRef(new Set());
  const descriptionKeysRef = useRef(new Set());
  const lifecycleRef = useRef(0);
  const callRef = useRef(call);

  callRef.current = call;

  const cleanup = useCallback(() => {
    lifecycleRef.current += 1;
    peerRef.current?.close();
    peerRef.current = null;
    peerPromiseRef.current = null;
    stopMedia(localStreamRef.current);
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    candidateKeysRef.current.clear();
    descriptionKeysRef.current.clear();
    setLocalStream(null);
    setRemoteStream(null);
    setCameraEnabled(false);
    setMicrophoneEnabled(true);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const preparePeer = useCallback(async (callId) => {
    if (peerRef.current) return peerRef.current;
    if (peerPromiseRef.current) return peerPromiseRef.current;

    const lifecycle = lifecycleRef.current;
    peerPromiseRef.current = (async () => {
      const stream = await getCallMedia({ video: false });
      if (lifecycle !== lifecycleRef.current) {
        stopMedia(stream);
        throw new DOMException('The call ended while requesting media.', 'AbortError');
      }

      const peer = createPeerConnection();
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.addTransceiver('video', { direction: 'sendrecv' });
      peer.ontrack = ({ track, streams }) => {
        if (lifecycle !== lifecycleRef.current) return;
        setRemoteStream((currentStream) => {
          if (streams[0]) return streams[0];
          const nextStream = currentStream ?? new MediaStream();
          if (!nextStream.getTracks().some(({ id }) => id === track.id)) {
            nextStream.addTrack(track);
          }
          return nextStream;
        });
      };
      peer.onicecandidate = ({ candidate }) => {
        if (candidate && lifecycle === lifecycleRef.current) {
          void sendSignal('call-ice', {
            callId,
            candidate: candidate.toJSON(),
          });
        }
      };
      peer.onconnectionstatechange = () => {
        if (lifecycle !== lifecycleRef.current) return;
        if (peer.connectionState === 'connected') {
          setCall((current) => ({ ...current, status: 'connected', error: '' }));
        } else if (peer.connectionState === 'failed') {
          cleanup();
          setCall((current) => ({
            ...current,
            status: 'failed',
            error: 'The call connection failed. A TURN server may be required.',
          }));
        }
      };

      localStreamRef.current = stream;
      peerRef.current = peer;
      setLocalStream(stream);
      return peer;
    })();

    try {
      return await peerPromiseRef.current;
    } finally {
      peerPromiseRef.current = null;
    }
  }, [cleanup, sendSignal]);

  const startCall = useCallback(async () => {
    const callId = newCallId();
    setCall({ status: 'inviting', callId, incomingFrom: '', error: '' });
    try {
      await sendSignal('call-invite', { callId });
    } catch (error) {
      setCall({ ...initialCall, status: 'failed', error: error.message });
    }
  }, [sendSignal]);

  const acceptCall = useCallback(async () => {
    const { callId } = callRef.current;
    if (!callId) return;
    setCall((current) => ({ ...current, status: 'connecting', error: '' }));
    try {
      await preparePeer(callId);
      await sendSignal('call-accept', { callId });
    } catch (error) {
      cleanup();
      setCall({ ...initialCall, status: 'failed', error: error.message });
      await sendSignal('call-end', { callId, reason: 'media-error' });
    }
  }, [cleanup, preparePeer, sendSignal]);

  const endCall = useCallback(async (reason = 'ended') => {
    const { callId } = callRef.current;
    if (callId) {
      try {
        await sendSignal('call-end', { callId, reason });
      } catch {
        // Local media must still stop when signaling is unavailable.
      }
    }
    cleanup();
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

    try {
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

      if (event === 'call-accept' && current.status === 'inviting') {
        setCall((value) => ({ ...value, status: 'connecting' }));
        const peer = await preparePeer(payload.callId);
        if (peer.signalingState !== 'stable') return;
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await sendSignal('call-offer', {
          callId: payload.callId,
          description: peer.localDescription,
        });
      } else if (event === 'call-offer' && current.status === 'connecting') {
        const peer = await preparePeer(payload.callId);
        const descriptionKey = `${payload.description?.type}:${payload.description?.sdp}`;
        if (
          descriptionKeysRef.current.has(descriptionKey) ||
          peer.signalingState !== 'stable'
        ) return;
        descriptionKeysRef.current.add(descriptionKey);
        await peer.setRemoteDescription(payload.description);
        for (const candidate of pendingCandidatesRef.current) {
          await peer.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal('call-answer', {
          callId: payload.callId,
          description: peer.localDescription,
        });
      } else if (event === 'call-answer' && peerRef.current) {
        const descriptionKey = `${payload.description?.type}:${payload.description?.sdp}`;
        if (
          descriptionKeysRef.current.has(descriptionKey) ||
          peerRef.current.signalingState !== 'have-local-offer'
        ) return;
        descriptionKeysRef.current.add(descriptionKey);
        await peerRef.current.setRemoteDescription(payload.description);
        for (const candidate of pendingCandidatesRef.current) {
          await peerRef.current.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
      } else if (event === 'call-ice' && payload.candidate) {
        const candidateKey = JSON.stringify(payload.candidate);
        if (candidateKeysRef.current.has(candidateKey)) return;
        candidateKeysRef.current.add(candidateKey);
        if (peerRef.current?.remoteDescription) {
          await peerRef.current.addIceCandidate(payload.candidate);
        } else {
          pendingCandidatesRef.current.push(payload.candidate);
        }
      } else if (event === 'call-end') {
        cleanup();
        setCall(initialCall);
      }
    } catch (error) {
      cleanup();
      setCall({ ...initialCall, status: 'failed', error: error.message });
    }
  }, [cleanup, peerName, preparePeer, sendSignal]);

  const toggleMicrophone = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicrophoneEnabled(audioTrack.enabled);
  }, []);

  const toggleCamera = useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    const activePeer = peerRef.current;
    const activeStream = localStreamRef.current;
    if (!activePeer || !activeStream) {
      setCall((current) => ({
        ...current,
        error: 'The call is no longer active.',
      }));
      return;
    }

    const existingTrack = localStreamRef.current?.getVideoTracks()[0];
    if (existingTrack) {
      const videoSender = activePeer.getTransceivers()
        .find((transceiver) => transceiver.receiver.track.kind === 'video')
        ?.sender;
      await videoSender?.replaceTrack(null);
      activeStream.removeTrack(existingTrack);
      existingTrack.stop();
      setLocalStream(new MediaStream(activeStream.getTracks()));
      setCameraEnabled(false);
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      if (
        lifecycle !== lifecycleRef.current ||
        activePeer !== peerRef.current ||
        activeStream !== localStreamRef.current
      ) {
        cameraTrack?.stop();
        return;
      }
      if (!cameraTrack) throw new Error('No camera track was available.');

      activeStream.addTrack(cameraTrack);
      const videoSender = activePeer.getTransceivers()
        .find((transceiver) => transceiver.receiver.track.kind === 'video')
        ?.sender;
      if (!videoSender) throw new Error('The video connection is not ready.');
      await videoSender.replaceTrack(cameraTrack);
      setLocalStream(new MediaStream(activeStream.getTracks()));
      setCameraEnabled(true);
    } catch (error) {
      setCall((current) => ({ ...current, error: error.message }));
    }
  }, []);

  return {
    ...call,
    localStream,
    remoteStream,
    cameraEnabled,
    microphoneEnabled,
    mediaReady: Boolean(localStream && peerRef.current),
    startCall,
    acceptCall,
    declineCall: () => endCall('declined'),
    endCall,
    handleSignal,
    toggleCamera,
    toggleMicrophone,
  };
}
