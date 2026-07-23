import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

import App from './App';

describe('ChatClub classroom prototype', () => {
  function openDemo() {
    fireEvent.click(screen.getByRole('button', { name: /view interface demo/i }));
  }

  test('explains how to connect the secure backend when credentials are absent', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /connect chatclub to supabase/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/run migrations/i)).toHaveTextContent('001');
    expect(screen.getByText(/run migrations/i)).toHaveTextContent('004');
  });

  test('requires a private class code before entering', () => {
    render(<App />);
    openDemo();

    fireEvent.click(screen.getByRole('button', { name: /enter class demo/i }));

    expect(
      screen.getByText(/enter the private class code provided by your moderator/i),
    ).toBeInTheDocument();
  });

  test('opens the moderated classroom demo', () => {
    render(<App />);
    openDemo();

    fireEvent.change(screen.getByLabelText(/class code/i), {
      target: { value: 'DEMO-10A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enter class demo/i }));

    expect(screen.getByRole('heading', { name: 'Chats' })).toBeInTheDocument();
    expect(screen.getByText(/remember our class agreement/i)).toBeInTheDocument();
    expect(screen.getByText('Ms. Fernandes')).toBeInTheDocument();
  });

  test('shows announcements from classroom navigation', () => {
    render(<App />);
    openDemo();

    fireEvent.change(screen.getByLabelText(/class code/i), {
      target: { value: 'DEMO-10A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enter class demo/i }));
    fireEvent.click(screen.getByRole('button', { name: /updates/i }));

    expect(screen.getByRole('heading', { name: 'Announcements' })).toBeInTheDocument();
    expect(screen.getByText('Science project teams')).toBeInTheDocument();
  });
});
