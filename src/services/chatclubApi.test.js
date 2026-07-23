import { beforeEach, describe, expect, test, vi } from 'vitest';

const { channel, client } = vi.hoisted(() => {
  const directChannel = {
    on: vi.fn(),
    subscribe: vi.fn(),
    track: vi.fn(),
    presenceState: vi.fn(() => ({})),
    send: vi.fn(),
  };
  const supabaseClient = {
    channel: vi.fn(() => directChannel),
    removeChannel: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  };
  return { channel: directChannel, client: supabaseClient };
});

vi.mock('../lib/supabase', () => ({ supabase: client }));

import {
  connectDirectConversation,
  deleteAccount,
  getLiveKitCallToken,
} from './chatclubApi';

describe('private direct Realtime connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
  });

  test('uses a stable private topic and enables acknowledged broadcasts', () => {
    connectDirectConversation({
      classroomId: 'classroom-id',
      currentUserId: 'user-z',
      peerUserId: 'user-a',
    });

    expect(client.channel).toHaveBeenCalledWith(
      'direct:classroom-id:user-a:user-z',
      {
        config: {
          private: true,
          broadcast: { ack: true, self: false },
          presence: { key: 'user-z' },
        },
      },
    );
  });

  test('delivers only events addressed by the selected classmate', () => {
    const onBroadcast = vi.fn();
    connectDirectConversation({
      classroomId: 'classroom-id',
      currentUserId: 'user-z',
      peerUserId: 'user-a',
      onBroadcast,
    });
    const broadcastHandler = channel.on.mock.calls.find(
      ([type]) => type === 'broadcast',
    )[2];

    broadcastHandler({
      event: 'call-answer',
      payload: { from: 'user-z', to: 'user-a' },
    });
    expect(onBroadcast).not.toHaveBeenCalled();

    broadcastHandler({
      event: 'call-answer',
      payload: { from: 'user-a', to: 'user-z' },
    });
    expect(onBroadcast).toHaveBeenCalledWith('call-answer', {
      from: 'user-a',
      to: 'user-z',
    });
  });

  test('addresses every signal to the selected classmate', async () => {
    const connection = connectDirectConversation({
      classroomId: 'classroom-id',
      currentUserId: 'user-z',
      peerUserId: 'user-a',
    });

    await connection.send('typing', { active: true });
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'typing',
      payload: {
        active: true,
        from: 'user-z',
        to: 'user-a',
      },
    });
  });

  test('requests a short-lived call token from the Edge Function', async () => {
    client.functions.invoke.mockResolvedValue({
      data: {
        token: 'short-lived-token',
        url: 'wss://chatclub.livekit.cloud',
      },
      error: null,
    });

    await expect(getLiveKitCallToken({
      classroomId: 'classroom-id',
      peerUserId: 'peer-id',
      callId: 'call-id',
    })).resolves.toEqual({
      token: 'short-lived-token',
      url: 'wss://chatclub.livekit.cloud',
    });
    expect(client.functions.invoke).toHaveBeenCalledWith('livekit-token', {
      body: {
        classroomId: 'classroom-id',
        peerUserId: 'peer-id',
        callId: 'call-id',
      },
    });
  });

  test('surfaces the Edge Function response instead of a generic HTTP error', async () => {
    client.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: vi.fn(async () => ({
            error: 'LIVEKIT_URL must begin with wss://',
          })),
        },
      },
    });

    await expect(getLiveKitCallToken({
      classroomId: 'classroom-id',
      peerUserId: 'peer-id',
      callId: 'call-id',
    })).rejects.toThrow('LIVEKIT_URL must begin with wss://');
  });

  test('sends password confirmation only to the account deletion Edge Function', async () => {
    client.functions.invoke.mockResolvedValue({
      data: { message: 'Account deleted' },
      error: null,
    });

    await expect(deleteAccount('correct horse battery staple')).resolves.toEqual({
      message: 'Account deleted',
    });
    expect(client.functions.invoke).toHaveBeenCalledWith('delete-account', {
      body: { password: 'correct horse battery staple' },
    });
  });

  test('shows the specific account deletion error returned by the server', async () => {
    client.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: vi.fn(async () => ({ error: 'Password is incorrect' })),
        },
      },
    });

    await expect(deleteAccount('wrong password')).rejects.toThrow('Password is incorrect');
  });
});
