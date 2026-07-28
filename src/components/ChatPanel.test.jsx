import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ChatPanel from './ChatPanel';

const classroom = {
  name: 'Class 8B',
  school: 'Test School',
  announcements: [],
};

const conversation = {
  id: 'peer-1',
  name: 'Classmate',
  detail: 'Class member',
  initials: 'CL',
  unread: 0,
  mentions: 0,
  kind: 'direct',
};

describe('message composer reliability', () => {
  test('does not wait for a stalled typing broadcast after persistence succeeds', async () => {
    const onSend = vi.fn().mockResolvedValue();
    const onTyping = vi.fn(() => new Promise(() => {}));

    render(
      <ChatPanel
        classroom={classroom}
        currentUser={{ id: 'current-user' }}
        conversations={[conversation]}
        activeConversation={conversation}
        messages={[]}
        onSelectConversation={vi.fn()}
        onSend={onSend}
        onTyping={onTyping}
      />,
    );

    const composer = screen.getByRole('textbox');
    fireEvent.change(composer, { target: { value: 'Hello' } });
    fireEvent.submit(composer.closest('form'));

    await waitFor(() => expect(composer).toHaveValue(''));
    expect(onSend).toHaveBeenCalledWith('Hello');
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });
});
