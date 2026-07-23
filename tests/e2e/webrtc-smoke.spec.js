import { expect, test } from '@playwright/test';

test('negotiates audio and video between two browser peers', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone'], {
    origin: 'http://127.0.0.1:4173',
  });
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const first = new RTCPeerConnection();
    const second = new RTCPeerConnection();
    const receivedKinds = new Set();
    const pendingForFirst = [];
    const pendingForSecond = [];

    first.onicecandidate = async ({ candidate }) => {
      if (!candidate) return;
      if (second.remoteDescription) await second.addIceCandidate(candidate);
      else pendingForSecond.push(candidate);
    };
    second.onicecandidate = async ({ candidate }) => {
      if (!candidate) return;
      if (first.remoteDescription) await first.addIceCandidate(candidate);
      else pendingForFirst.push(candidate);
    };
    second.ontrack = ({ track }) => receivedKinds.add(track.kind);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    stream.getTracks().forEach((track) => first.addTrack(track, stream));

    const offer = await first.createOffer();
    await first.setLocalDescription(offer);
    await second.setRemoteDescription(offer);
    for (const candidate of pendingForSecond) {
      await second.addIceCandidate(candidate);
    }

    const answer = await second.createAnswer();
    await second.setLocalDescription(answer);
    await first.setRemoteDescription(answer);
    for (const candidate of pendingForFirst) {
      await first.addIceCandidate(candidate);
    }

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`WebRTC timed out in ${first.connectionState}`)),
        8000,
      );
      const checkConnected = () => {
        if (first.connectionState === 'connected') {
          clearTimeout(timeout);
          resolve();
        }
      };
      first.addEventListener('connectionstatechange', checkConnected);
      checkConnected();
    });

    const response = {
      connectionState: first.connectionState,
      receivedKinds: [...receivedKinds].sort(),
    };
    stream.getTracks().forEach((track) => track.stop());
    first.close();
    second.close();
    return response;
  });

  expect(result.connectionState).toBe('connected');
  expect(result.receivedKinds).toEqual(['audio', 'video']);
});
