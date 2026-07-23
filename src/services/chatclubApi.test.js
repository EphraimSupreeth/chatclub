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
  };
  return { channel: directChannel, client: supabaseClient };
});

vi.mock('../lib/supabase', () => ({ supabase: client }));

import { connectDirectConversation } from './chatclubApi';

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
          broadcast: { ack: true, self: true },
          presence: { key: 'user-z' },
        },
      },
    );
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
});
