import { useCallback, useEffect, useRef, useState } from 'react';
import { connectDirectConversation } from '../services/chatclubApi';

export default function useDirectRealtime({
  classroomId,
  currentUserId,
  peerUserId,
  onMessageChanged,
  onSignal,
}) {
  const connectionRef = useRef(null);
  const signalHandlerRef = useRef(onSignal);
  const messageHandlerRef = useRef(onMessageChanged);
  const typingTimerRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  signalHandlerRef.current = onSignal;
  messageHandlerRef.current = onMessageChanged;

  useEffect(() => {
    setConnected(false);
    setPeerOnline(false);
    setPeerTyping(false);
    if (!classroomId || !currentUserId || !peerUserId) return undefined;

    const connection = connectDirectConversation({
      classroomId,
      currentUserId,
      peerUserId,
      onStatus: (status) => setConnected(status === 'SUBSCRIBED'),
      onPresence: setPeerOnline,
      onBroadcast: (event, payload) => {
        if (event === 'typing') {
          setPeerTyping(Boolean(payload.active));
          window.clearTimeout(typingTimerRef.current);
          if (payload.active) {
            typingTimerRef.current = window.setTimeout(
              () => setPeerTyping(false),
              3500,
            );
          }
        } else if (event === 'message-changed') {
          messageHandlerRef.current?.();
        } else if (event.startsWith('call-')) {
          signalHandlerRef.current?.(event, payload);
        }
      },
    });
    connectionRef.current = connection;

    return () => {
      window.clearTimeout(typingTimerRef.current);
      connection.disconnect();
      connectionRef.current = null;
    };
  }, [classroomId, currentUserId, peerUserId]);

  const send = useCallback((event, payload) => {
    if (!connectionRef.current) return Promise.reject(new Error('Conversation is offline.'));
    return connectionRef.current.send(event, payload);
  }, []);

  return { connected, peerOnline, peerTyping, send };
}
