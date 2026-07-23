import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

function CallIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={type === 'audio'
        ? 'M7 4l3 4-2 2c1.5 3 3 4.5 6 6l2-2 4 3-1 3c-.4 1.1-1.5 1.7-2.7 1.4C9.2 19.5 4.5 14.8 2.6 7.7 2.3 6.5 2.9 5.4 4 5z'
        : 'M4 6.5A2.5 2.5 0 0 1 6.5 4h8A2.5 2.5 0 0 1 17 6.5v11A2.5 2.5 0 0 1 14.5 20h-8A2.5 2.5 0 0 1 4 17.5z M17 9l4-2v10l-4-2z'}
      />
    </svg>
  );
}

function Video({ stream, muted, label }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div className="call-video">
      <video ref={ref} autoPlay playsInline muted={muted} />
      <span>{label}</span>
    </div>
  );
}

function LobbyPreview({ stream, cameraEnabled }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div className="lobby-preview">
      <video ref={ref} autoPlay playsInline muted />
      {!stream && (
        <div className="lobby-preview__placeholder">
          Allow camera access to see your preview
        </div>
      )}
      {stream && !cameraEnabled && (
        <div className="lobby-preview__placeholder">Camera is off</div>
      )}
      <span>You</span>
    </div>
  );
}

function DeviceSelect({ label, kind, devices, selected, onChange }) {
  return (
    <label className="device-field">
      <span>{label}</span>
      <select
        value={selected || devices[0]?.deviceId || ''}
        onChange={(event) => onChange(kind, event.target.value)}
        disabled={devices.length === 0}
      >
        {devices.length === 0 ? (
          <option value="">No device available</option>
        ) : (
          devices.map((device, index) => (
            <option value={device.deviceId} key={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </option>
          ))
        )}
      </select>
    </label>
  );
}

function DeviceSettingsFields({
  call,
  includeJoinChoices = false,
  audioOnly = false,
}) {
  return (
    <div className="device-fields">
      <DeviceSelect
        label="Microphone"
        kind="audioinput"
        devices={call.devices.audioinput}
        selected={call.selectedDevices.audioinput}
        onChange={call.switchDevice}
      />
      {!audioOnly && (
        <DeviceSelect
          label="Camera"
          kind="videoinput"
          devices={call.devices.videoinput}
          selected={call.selectedDevices.videoinput}
          onChange={call.switchDevice}
        />
      )}
      {call.speakerSelectionSupported ? (
        <DeviceSelect
          label="Speaker"
          kind="audiooutput"
          devices={call.devices.audiooutput}
          selected={call.selectedDevices.audiooutput}
          onChange={call.switchDevice}
        />
      ) : (
        <p className="device-note">
          Speaker selection is controlled by this browser or your system sound
          settings.
        </p>
      )}
      {includeJoinChoices && (
        <fieldset className="join-media-options">
          <legend>Start with</legend>
          <label>
            <input
              type="checkbox"
              checked={call.joinWithMicrophone}
              onChange={(event) =>
                call.setJoinPreference('microphone', event.target.checked)}
            />
            Microphone on
          </label>
          {!audioOnly && (
            <label>
              <input
                type="checkbox"
                checked={call.joinWithCamera}
                onChange={(event) =>
                  call.setJoinPreference('camera', event.target.checked)}
              />
              Camera on
            </label>
          )}
        </fieldset>
      )}
    </div>
  );
}

export default function CallExperience({ peerName, call, canCall }) {
  const active = ['connecting', 'connected', 'reconnecting'].includes(call.status);
  const incoming = call.status === 'incoming';
  const failed = call.status === 'failed';
  const [setupMode, setSetupMode] = useState(null);
  const [setupMediaType, setSetupMediaType] = useState('video');

  function openSetup(mode, mediaType = 'video') {
    setSetupMode(mode);
    setSetupMediaType(mediaType);
    void call.prepareLobby(mediaType);
  }

  function closeSetup() {
    call.cancelLobby();
    setSetupMode(null);
  }

  async function confirmSetup() {
    const mode = setupMode;
    setSetupMode(null);
    if (mode === 'incoming') await call.acceptCall();
    if (mode === 'outgoing') await call.startCall();
  }

  return (
    <>
      <div className="conversation-call-actions">
        <button
          className="call-button"
          type="button"
          onClick={() => openSetup('outgoing', 'audio')}
          disabled={!canCall || call.status !== 'idle'}
          aria-label={`Start an audio call with ${peerName}`}
        >
          <CallIcon type="audio" />
        </button>
        <button
          className="call-button"
          type="button"
          onClick={() => openSetup('outgoing', 'video')}
          disabled={!canCall || call.status !== 'idle'}
          aria-label={`Start a video call with ${peerName}`}
        >
          <CallIcon type="video" />
        </button>
      </div>

      {['preparing', 'inviting'].includes(call.status) && (
        <div className="call-status" role="status">
          {call.status === 'preparing'
            ? 'Preparing secure call…'
            : `Calling ${peerName}…`}
          <button type="button" onClick={() => call.endCall('cancelled')}>Cancel</button>
        </div>
      )}

      <Dialog.Root
        open={incoming && !setupMode}
        onOpenChange={(open) => {
          if (!open && incoming && !setupMode) call.declineCall();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>Incoming call</Dialog.Title>
            <Dialog.Description>
              {peerName} wants to start a private one-to-one call. Review your
              microphone and camera before joining.
            </Dialog.Description>
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" onClick={call.declineCall}>
                Decline
              </button>
              <button className="button button--primary" type="button" onClick={() => openSetup('incoming', call.mediaType)}>
                Review devices
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={active}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay dialog-overlay--call" />
          <Dialog.Content
            className="call-room"
            onEscapeKeyDown={() => call.endCall()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <Dialog.Title>Call with {peerName}</Dialog.Title>
            <Dialog.Description className="sr-only">
              Private one-to-one audio and video call
            </Dialog.Description>
            <div className="call-stage">
              <Video stream={call.remoteStream} label={peerName} />
              <Video stream={call.localStream} muted label="You" />
            </div>
            <p className="call-room__status" role="status">
              {call.error ||
                (call.status === 'connected'
                  ? 'Connected'
                  : call.status === 'reconnecting'
                    ? 'Reconnecting…'
                  : 'Connecting securely…')}
            </p>
            <div className="call-controls">
              {call.audioBlocked && (
                <button type="button" onClick={call.resumeAudio}>
                  Enable sound
                </button>
              )}
              <button type="button" onClick={call.toggleMicrophone} disabled={!call.mediaReady}>
                {call.microphoneEnabled ? 'Mute' : 'Unmute'}
              </button>
              <button type="button" onClick={call.toggleCamera} disabled={!call.mediaReady}>
                {call.cameraEnabled ? 'Camera off' : 'Camera on'}
              </button>
              <Dialog.Root
                onOpenChange={(open) => {
                  if (open) void call.refreshDevices();
                }}
              >
                <Dialog.Trigger asChild>
                  <button type="button" disabled={!call.mediaReady}>
                    Settings
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="dialog-overlay dialog-overlay--settings" />
                  <Dialog.Content className="dialog-content call-settings">
                    <Dialog.Title>Audio and video settings</Dialog.Title>
                    <Dialog.Description>
                      Choose the devices used for this call.
                    </Dialog.Description>
                    <DeviceSettingsFields call={call} />
                    {call.deviceStatus && (
                      <p className="form-status" role="status">{call.deviceStatus}</p>
                    )}
                    <div className="dialog-actions">
                      <Dialog.Close asChild>
                        <button className="button button--primary" type="button">
                          Done
                        </button>
                      </Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
              <button className="call-controls__end" type="button" onClick={() => call.endCall()}>
                End call
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={Boolean(setupMode)}
        onOpenChange={(open) => {
          if (!open) closeSetup();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay dialog-overlay--settings" />
          <Dialog.Content className="dialog-content call-settings call-settings--lobby">
            <Dialog.Title>
              {setupMode === 'incoming'
                ? `Join ${setupMediaType} call`
                : `${setupMediaType === 'audio' ? 'Audio call' : 'Video call'} with ${peerName}`}
            </Dialog.Title>
            <Dialog.Description>
              Choose your devices and what to turn on. Nothing starts until you
              confirm.
            </Dialog.Description>
            <div
              className={
                setupMediaType === 'audio'
                  ? 'lobby-layout lobby-layout--audio'
                  : 'lobby-layout'
              }
            >
              {setupMediaType === 'video' && (
                <LobbyPreview
                  stream={call.previewStream}
                  cameraEnabled={call.joinWithCamera}
                />
              )}
              <DeviceSettingsFields
                call={call}
                includeJoinChoices
                audioOnly={setupMediaType === 'audio'}
              />
            </div>
            {call.deviceStatus && (
              <p className="form-status" role="status">{call.deviceStatus}</p>
            )}
            <div className="dialog-actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={closeSetup}
              >
                Back
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={confirmSetup}
              >
                {setupMode === 'incoming' ? 'Join call' : 'Start call'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={failed}
        onOpenChange={(open) => {
          if (!open && failed) call.endCall('dismissed');
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>Call ended</Dialog.Title>
            <Dialog.Description>
              {call.error || `The call with ${peerName} could not be connected.`}
            </Dialog.Description>
            <div className="dialog-actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => call.endCall('dismissed')}
              >
                Close
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
