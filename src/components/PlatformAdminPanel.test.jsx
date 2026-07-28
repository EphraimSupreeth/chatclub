import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PlatformAdminPanel from './PlatformAdminPanel';
import {
  grantPlatformModerator,
  listPlatformModerators,
  setClassroomModerator,
} from '../services/chatclubApi';

vi.mock('../services/chatclubApi', () => ({
  grantPlatformModerator: vi.fn(),
  listPlatformModerators: vi.fn(),
  revokePlatformModerator: vi.fn(),
  setClassroomModerator: vi.fn(),
}));

describe('super-admin staff access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPlatformModerators.mockResolvedValue([
      {
        user_id: 'moderator-1',
        display_name: 'Ms Fernandes',
        email: 'teacher@example.test',
        role: 'moderator',
      },
    ]);
  });

  test('grants moderator access only for the submitted confirmed account', async () => {
    grantPlatformModerator.mockResolvedValue('moderator-1');
    render(<PlatformAdminPanel />);

    await screen.findByText('Ms Fernandes');
    fireEvent.change(screen.getByLabelText(/confirmed chatclub account email/i), {
      target: { value: 'teacher@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /grant moderator access/i }));

    await waitFor(() => {
      expect(grantPlatformModerator).toHaveBeenCalledWith('teacher@example.test');
    });
  });

  test('assigns approved staff to the selected classroom', async () => {
    setClassroomModerator.mockResolvedValue();
    render(
      <PlatformAdminPanel
        classroomId="classroom-1"
        classroomModeratorIds={[]}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /assign to class/i }));

    await waitFor(() => {
      expect(setClassroomModerator).toHaveBeenCalledWith(
        'classroom-1',
        'moderator-1',
        true,
      );
    });
  });
});
