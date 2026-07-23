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
    expect(screen.getByText(/run migrations/i)).toHaveTextContent('007');
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

    expect(screen.getByRole('heading', { name: 'Updates' })).toBeInTheDocument();
    expect(screen.getByText('Science project teams')).toBeInTheDocument();
  });

  test('opens the call history from primary navigation', () => {
    render(<App />);
    openDemo();

    fireEvent.change(screen.getByLabelText(/class code/i), {
      target: { value: 'DEMO-10A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enter class demo/i }));
    fireEvent.click(screen.getByRole('button', { name: /^calls$/i }));

    expect(screen.getByRole('heading', { name: 'Calls' })).toBeInTheDocument();
    expect(screen.getByText('No calls yet')).toBeInTheDocument();
  });

  test('opens the privacy-preserving activity inbox', () => {
    render(<App />);
    openDemo();

    fireEvent.change(screen.getByLabelText(/class code/i), {
      target: { value: 'DEMO-10A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enter class demo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText(/message text is not repeated here/i)).toBeInTheDocument();
  });

  test('opens profile settings from the sidebar avatar', () => {
    render(<App />);
    openDemo();

    fireEvent.change(screen.getByLabelText(/class code/i), {
      target: { value: 'DEMO-10A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enter class demo/i }));
    fireEvent.click(screen.getByRole('button', { name: /open profile for/i }));

    expect(screen.getByRole('heading', { name: 'More' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument();
  });

  test('finds a person and opens their direct chat', () => {
    render(<App />);
    openDemo();

    fireEvent.change(screen.getByLabelText(/class code/i), {
      target: { value: 'DEMO-10A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enter class demo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'People' }));
    fireEvent.change(screen.getByLabelText('Search people'), {
      target: { value: 'Arjun' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));

    expect(screen.getByRole('heading', { name: 'Arjun Rao' })).toBeInTheDocument();
  });
});
