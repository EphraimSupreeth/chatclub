import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

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

export default function CallExperience({ peerName, call, canCall }) {
  const active = ['connecting', 'connected', 'reconnecting'].includes(call.status);
  const incoming = call.status === 'incoming';
  const failed = call.status === 'failed';

  return (
    <>
      <button
        className="call-button"
        type="button"
        onClick={call.startCall}
        disabled={!canCall || call.status !== 'idle'}
        aria-label={`Start an audio or video call with ${peerName}`}
      >
        Call
      </button>

      {['preparing', 'inviting'].includes(call.status) && (
        <div className="call-status" role="status">
          {call.status === 'preparing'
            ? 'Preparing secure call…'
            : `Calling ${peerName}…`}
          <button type="button" onClick={() => call.endCall('cancelled')}>Cancel</button>
        </div>
      )}

      <Dialog.Root
        open={incoming}
        onOpenChange={(open) => {
          if (!open && incoming) call.declineCall();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>Incoming call</Dialog.Title>
            <Dialog.Description>
              {peerName} wants to start a private one-to-one call. Your camera will
              stay off when you join.
            </Dialog.Description>
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" onClick={call.declineCall}>
                Decline
              </button>
              <button className="button button--primary" type="button" onClick={call.acceptCall}>
                Join with camera off
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
                    <div className="device-fields">
                      <DeviceSelect
                        label="Microphone"
                        kind="audioinput"
                        devices={call.devices.audioinput}
                        selected={call.selectedDevices.audioinput}
                        onChange={call.switchDevice}
                      />
                      <DeviceSelect
                        label="Camera"
                        kind="videoinput"
                        devices={call.devices.videoinput}
                        selected={call.selectedDevices.videoinput}
                        onChange={call.switchDevice}
                      />
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
                          Speaker selection is controlled by this browser or your
                          system sound settings.
                        </p>
                      )}
                    </div>
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
