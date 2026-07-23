const defaultIceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export function getIceServers(rawConfig = import.meta.env.VITE_WEBRTC_ICE_SERVERS) {
  if (!rawConfig) return defaultIceServers;

  try {
    const parsed = JSON.parse(rawConfig);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error();
    return parsed;
  } catch {
    throw new Error('VITE_WEBRTC_ICE_SERVERS must be a JSON array.');
  }
}

export function createPeerConnection() {
  if (!globalThis.RTCPeerConnection) {
    throw new Error('Video calling is not supported by this browser.');
  }

  return new RTCPeerConnection({ iceServers: getIceServers() });
}

export async function getCallMedia({ video = false } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone access is not supported by this browser.');
  }

  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: video ? { facingMode: 'user' } : false,
  });
}

export function stopMedia(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
