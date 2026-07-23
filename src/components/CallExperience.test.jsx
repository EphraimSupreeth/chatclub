import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import CallExperience from './CallExperience';

function makeCall(overrides = {}) {
  return {
    status: 'idle',
    error: '',
    localStream: null,
    remoteStream: null,
    cameraEnabled: false,
    microphoneEnabled: true,
    startCall: vi.fn(),
    acceptCall: vi.fn(),
    declineCall: vi.fn(),
    endCall: vi.fn(),
    toggleCamera: vi.fn(),
    toggleMicrophone: vi.fn(),
    ...overrides,
  };
}

describe('one-to-one call experience', () => {
  test('starts a call only when the private channel is available', () => {
    const call = makeCall();
    const { rerender } = render(
      <CallExperience peerName="Arjun Rao" call={call} canCall={false} />,
    );

    expect(screen.getByRole('button', { name: /start an audio or video call/i }))
      .toBeDisabled();

    rerender(<CallExperience peerName="Arjun Rao" call={call} canCall />);
    fireEvent.click(screen.getByRole('button', {
      name: /start an audio or video call/i,
    }));
    expect(call.startCall).toHaveBeenCalledOnce();
  });

  test('requires explicit acceptance and explains that camera starts off', () => {
    const call = makeCall({ status: 'incoming' });
    render(<CallExperience peerName="Arjun Rao" call={call} canCall />);

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Your camera will stay off when you join.',
    );
    fireEvent.click(screen.getByRole('button', { name: /join with camera off/i }));
    expect(call.acceptCall).toHaveBeenCalledOnce();
  });
});
