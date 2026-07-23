import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import CallsPanel from './CallsPanel';

describe('call history', () => {
  test('shows participant-safe call metadata and opens the related chat', () => {
    const onOpenConversation = vi.fn();
    render(
      <CallsPanel
        currentUserId="current-user"
        onOpenConversation={onOpenConversation}
        calls={[
          {
            id: 'history-1',
            caller_id: 'peer-user',
            recipient_id: 'current-user',
            media_type: 'video',
            status: 'missed',
            started_at: '2026-07-23T13:05:18.302Z',
            caller: { display_name: 'Ephy', avatar_initials: 'E' },
            recipient: { display_name: 'MJ', avatar_initials: 'MJ' },
          },
        ]}
      />,
    );

    expect(screen.getByText('Ephy')).toBeInTheDocument();
    expect(screen.getByText('Incoming video call · missed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(onOpenConversation).toHaveBeenCalledWith('peer-user');
  });
});
