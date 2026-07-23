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
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const callRef = useRef(call);

  callRef.current = call;

  const cleanup = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    stopMedia(localStreamRef.current);
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setCameraEnabled(false);
    setMicrophoneEnabled(true);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const preparePeer = useCallback(async (callId) => {
    if (peerRef.current) return peerRef.current;

    const stream = await getCallMedia({ video: false });
    const peer = createPeerConnection();
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.addTransceiver('video', { direction: 'sendrecv' });
    peer.ontrack = ({ streams }) => setRemoteStream(streams[0]);
    peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal('call-ice', { callId, candidate: candidate.toJSON() });
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setCall((current) => ({ ...current, status: 'connected', error: '' }));
      } else if (['failed', 'disconnected'].includes(peer.connectionState)) {
        setCall((current) => ({
          ...current,
          status: 'failed',
          error: 'The call connection was lost.',
        }));
      }
    };

    localStreamRef.current = stream;
    peerRef.current = peer;
    setLocalStream(stream);
    return peer;
  }, [sendSignal]);

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
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await sendSignal('call-offer', {
          callId: payload.callId,
          description: peer.localDescription,
        });
      } else if (event === 'call-offer' && current.status === 'connecting') {
        const peer = await preparePeer(payload.callId);
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
        await peerRef.current.setRemoteDescription(payload.description);
        for (const candidate of pendingCandidatesRef.current) {
          await peerRef.current.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
      } else if (event === 'call-ice' && payload.candidate) {
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
    const existingTrack = localStreamRef.current?.getVideoTracks()[0];
    if (existingTrack) {
      existingTrack.enabled = !existingTrack.enabled;
      setCameraEnabled(existingTrack.enabled);
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      localStreamRef.current.addTrack(cameraTrack);
      const videoSender = peerRef.current?.getTransceivers()
        .find((transceiver) => transceiver.receiver.track.kind === 'video')
        ?.sender;
      await videoSender?.replaceTrack(cameraTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
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
    startCall,
    acceptCall,
    declineCall: () => endCall('declined'),
    endCall,
    handleSignal,
    toggleCamera,
    toggleMicrophone,
  };
}
