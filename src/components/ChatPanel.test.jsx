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

  test('keeps reactions contextual and renders the selected reaction below the message', async () => {
    const onReact = vi.fn().mockResolvedValue();
    const message = {
      id: 'message-1',
      authorId: 'peer-1',
      author: 'Classmate',
      initials: 'CL',
      text: 'Hello',
      time: '1:07 PM',
      reactions: [],
    };
    const props = {
      classroom,
      currentUser: { id: 'current-user' },
      conversations: [conversation],
      activeConversation: conversation,
      onSelectConversation: vi.fn(),
      onReact,
      onReport: vi.fn().mockResolvedValue(),
    };
    const { rerender } = render(<ChatPanel {...props} messages={[message]} />);

    fireEvent.click(screen.getByLabelText('Add reaction'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'React 👍' }));
    expect(onReact).toHaveBeenCalledWith('message-1', '👍', true);

    rerender(
      <ChatPanel
        {...props}
        messages={[{
          ...message,
          reactions: [{ emoji: '👍', count: 1, mine: true }],
        }]}
      />,
    );
    expect(screen.getByRole('button', { name: '👍 1' })).toBeVisible();
    expect(screen.getByLabelText('More message options')).toBeVisible();
    fireEvent.click(screen.getByLabelText('More message options'));
    expect(screen.getByRole('menuitem', { name: /report message/i })).toBeVisible();
  });
});
