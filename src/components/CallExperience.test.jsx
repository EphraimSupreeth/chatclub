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
    mediaReady: false,
    devices: {
      audioinput: [],
      videoinput: [],
      audiooutput: [],
    },
    selectedDevices: {},
    deviceStatus: '',
    speakerSelectionSupported: false,
    startCall: vi.fn(),
    acceptCall: vi.fn(),
    declineCall: vi.fn(),
    endCall: vi.fn(),
    toggleCamera: vi.fn(),
    toggleMicrophone: vi.fn(),
    refreshDevices: vi.fn(async () => {}),
    switchDevice: vi.fn(async () => {}),
    resumeAudio: vi.fn(async () => {}),
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

  test('shows a safe close-only screen after connection failure', () => {
    const call = makeCall({
      status: 'failed',
      error: 'The connection failed.',
    });
    render(<CallExperience peerName="Arjun Rao" call={call} canCall />);

    expect(screen.getByRole('dialog')).toHaveTextContent('The connection failed.');
    expect(screen.queryByRole('button', { name: 'Camera on' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(call.endCall).toHaveBeenCalledWith('dismissed');
  });

  test('opens accessible device settings during a connected call', () => {
    const call = makeCall({
      status: 'connected',
      mediaReady: true,
      devices: {
        audioinput: [
          { deviceId: 'mic-1', label: 'Built-in microphone' },
        ],
        videoinput: [
          { deviceId: 'camera-1', label: 'FaceTime camera' },
        ],
        audiooutput: [],
      },
      selectedDevices: {
        audioinput: 'mic-1',
        videoinput: 'camera-1',
      },
    });
    render(<CallExperience peerName="Arjun Rao" call={call} canCall />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(call.refreshDevices).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', {
      name: 'Audio and video settings',
    })).toBeInTheDocument();
    expect(screen.getByLabelText('Microphone')).toHaveValue('mic-1');
    expect(screen.getByText(/speaker selection is controlled/i))
      .toBeInTheDocument();
  });
});
