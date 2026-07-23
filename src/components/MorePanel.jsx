import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export default function MorePanel({
  preferences,
  onChangePreferences,
  onNavigate,
  onSignOut,
  onDeleteAccount,
}) {
  const [password, setPassword] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');
  const [deleting, setDeleting] = useState(false);
  async function changeDesktopNotifications(enabled) {
    if (enabled && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      onChangePreferences({
        ...preferences,
        desktopNotifications: permission === 'granted',
      });
      return;
    }
    onChangePreferences({ ...preferences, desktopNotifications: false });
  }

  return (
    <section className="content-panel more-panel" aria-labelledby="more-title">
      <span className="eyebrow">ChatClub</span>
      <h1 id="more-title">More</h1>
      <p className="content-panel__intro">
        Updates, safety and preferences for this device.
      </p>

      <div className="more-links">
        <button type="button" onClick={() => onNavigate('announcements')}>
          <span aria-hidden="true">◁</span>
          <span><strong>Updates</strong><small>News from classroom moderators</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={() => onNavigate('safety')}>
          <span aria-hidden="true">◇</span>
          <span><strong>Safety</strong><small>Rules, reporting and privacy help</small></span>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <section className="preference-card" aria-labelledby="preferences-title">
        <div>
          <h2 id="preferences-title">Call alerts</h2>
          <p>Choose how incoming calls notify you on this device.</p>
        </div>
        <label>
          <span><strong>Call sound</strong><small>Play a short ringtone for incoming calls</small></span>
          <input
            type="checkbox"
            checked={preferences.callSound}
            onChange={(event) => onChangePreferences({
              ...preferences,
              callSound: event.target.checked,
            })}
          />
        </label>
        <label>
          <span><strong>Desktop notifications</strong><small>Show an alert when ChatClub is in the background</small></span>
          <input
            type="checkbox"
            checked={preferences.desktopNotifications}
            disabled={!('Notification' in window)}
            onChange={(event) => void changeDesktopNotifications(event.target.checked)}
          />
        </label>
      </section>

      {onSignOut && onDeleteAccount && (
        <section className="preference-card privacy-card" aria-labelledby="privacy-title">
          <div>
            <h2 id="privacy-title">Privacy and account</h2>
            <p>Control your session and understand what ChatClub keeps.</p>
          </div>
          <dl className="privacy-summary">
            <div><dt>Messages</dt><dd>Kept for up to 180 days</dd></div>
            <div><dt>Calls</dt><dd>Call details only; audio and video are not recorded</dd></div>
            <div><dt>Visibility</dt><dd>Limited to authorized classroom participants</dd></div>
          </dl>
          <button className="settings-action" type="button" onClick={onSignOut}>
            Sign out on all devices
          </button>
          <Dialog.Root onOpenChange={(open) => {
            if (!open) {
              setPassword('');
              setDeleteStatus('');
            }
          }}>
            <Dialog.Trigger asChild>
              <button className="settings-action settings-action--danger" type="button">
                Delete account
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="account-delete-dialog">
                <Dialog.Title>Delete your account?</Dialog.Title>
                <Dialog.Description>
                  This permanently removes your account, memberships, messages, reactions,
                  call history and reports linked to you. This cannot be undone.
                </Dialog.Description>
                <label htmlFor="delete-account-password">Confirm your password</label>
                <input
                  id="delete-account-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {deleteStatus && <p className="form-status form-status--error" role="alert">{deleteStatus}</p>}
                <div className="dialog-actions">
                  <Dialog.Close asChild>
                    <button className="button button--secondary" type="button">Cancel</button>
                  </Dialog.Close>
                  <button
                    className="button button--danger"
                    type="button"
                    disabled={!password || deleting}
                    onClick={async () => {
                      setDeleting(true);
                      setDeleteStatus('');
                      try {
                        await onDeleteAccount(password);
                      } catch (error) {
                        setDeleteStatus(error.message);
                        setDeleting(false);
                      }
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Permanently delete'}
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </section>
      )}
    </section>
  );
}
