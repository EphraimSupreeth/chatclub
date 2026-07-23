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

export default function CallExperience({ peerName, call, canCall }) {
  const active = ['connecting', 'connected', 'failed'].includes(call.status);
  const incoming = call.status === 'incoming';

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

      {call.status === 'inviting' && (
        <div className="call-status" role="status">
          Calling {peerName}…
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
                  : 'Connecting securely…')}
            </p>
            <div className="call-controls">
              <button type="button" onClick={call.toggleMicrophone}>
                {call.microphoneEnabled ? 'Mute' : 'Unmute'}
              </button>
              <button type="button" onClick={call.toggleCamera}>
                {call.cameraEnabled ? 'Camera off' : 'Camera on'}
              </button>
              <button className="call-controls__end" type="button" onClick={() => call.endCall()}>
                End call
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
