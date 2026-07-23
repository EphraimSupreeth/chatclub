import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Avatar from './Avatar';

function initialsFor(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function MorePanel({
  preferences,
  onChangePreferences,
  onNavigate,
  onSignOut,
  onDeleteAccount,
  currentUser,
  onUpdateProfile,
}) {
  const [password, setPassword] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.name ?? '');
  const [avatarTone, setAvatarTone] = useState(currentUser?.avatarTone ?? 'blue');
  const [profileStatus, setProfileStatus] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeSettings, setActiveSettings] = useState(
    currentUser && onUpdateProfile ? 'profile' : 'notifications',
  );

  useEffect(() => {
    setDisplayName(currentUser?.name ?? '');
    setAvatarTone(currentUser?.avatarTone ?? 'blue');
  }, [currentUser?.avatarTone, currentUser?.name]);

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
        Make ChatClub feel right for you.
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

      <nav className="settings-tabs" aria-label="Settings categories">
        {currentUser && onUpdateProfile && (
          <button
            type="button"
            className={activeSettings === 'profile' ? 'settings-tab settings-tab--active' : 'settings-tab'}
            onClick={() => setActiveSettings('profile')}
          >
            <span aria-hidden="true">☺</span> Profile
          </button>
        )}
        <button
          type="button"
          className={activeSettings === 'notifications' ? 'settings-tab settings-tab--active' : 'settings-tab'}
          onClick={() => setActiveSettings('notifications')}
        >
          <span aria-hidden="true">♬</span> Alerts
        </button>
        <button
          type="button"
          className={activeSettings === 'appearance' ? 'settings-tab settings-tab--active' : 'settings-tab'}
          onClick={() => setActiveSettings('appearance')}
        >
          <span aria-hidden="true">✦</span> Look
        </button>
        {onSignOut && onDeleteAccount && (
          <button
            type="button"
            className={activeSettings === 'privacy' ? 'settings-tab settings-tab--active' : 'settings-tab'}
            onClick={() => setActiveSettings('privacy')}
          >
            <span aria-hidden="true">⌾</span> Account
          </button>
        )}
      </nav>

      {activeSettings === 'notifications' && (
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
          <span><strong>Desktop notifications</strong><small>Show a generic, preview-free background alert</small></span>
          <input
            type="checkbox"
            checked={preferences.desktopNotifications}
            disabled={!('Notification' in window)}
            onChange={(event) => void changeDesktopNotifications(event.target.checked)}
          />
        </label>
      </section>
      )}

      {activeSettings === 'profile' && currentUser && onUpdateProfile && (
        <section className="preference-card profile-settings" aria-labelledby="profile-title">
          <div>
            <h2 id="profile-title">Your profile</h2>
            <p>Use a real display name and a generated, upload-free avatar.</p>
          </div>
          <div className="profile-settings__preview">
            <Avatar initials={initialsFor(displayName) || currentUser.initials} tone={avatarTone} />
            <label>
              <span>Display name</span>
              <input
                type="text"
                value={displayName}
                minLength={2}
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          </div>
          <fieldset className="avatar-tone-picker">
            <legend>Avatar color</legend>
            {['blue', 'violet', 'mint', 'peach'].map((tone) => (
              <label key={tone}>
                <input
                  type="radio"
                  name="avatar-tone"
                  value={tone}
                  checked={avatarTone === tone}
                  onChange={() => setAvatarTone(tone)}
                />
                <span className={`tone-swatch tone-swatch--${tone}`} aria-hidden="true" />
                <span className="sr-only">{tone}</span>
              </label>
            ))}
          </fieldset>
          {profileStatus && (
            <p className={profileStatus === 'Saved'
              ? 'form-status form-status--success'
              : 'form-status form-status--error'} role="status">
              {profileStatus}
            </p>
          )}
          <button
            className="button button--primary"
            type="button"
            disabled={
              savingProfile ||
              displayName.trim().length < 2 ||
              (displayName.trim() === currentUser.name && avatarTone === currentUser.avatarTone)
            }
            onClick={async () => {
              setSavingProfile(true);
              setProfileStatus('');
              try {
                await onUpdateProfile({ displayName, avatarTone });
                setProfileStatus('Saved');
              } catch (error) {
                setProfileStatus(error.message);
              } finally {
                setSavingProfile(false);
              }
            }}
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
          <small>Profile changes are limited to once every 10 minutes.</small>
        </section>
      )}

      {activeSettings === 'appearance' && (
      <section className="preference-card appearance-settings" aria-labelledby="appearance-title">
        <div>
          <h2 id="appearance-title">Appearance</h2>
          <p>These accessibility preferences stay on this device.</p>
        </div>
        <label>
          <span><strong>Theme</strong><small>Follow your device or choose a theme</small></span>
          <select
            value={preferences.theme}
            onChange={(event) => onChangePreferences({
              ...preferences,
              theme: event.target.value,
            })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          <span><strong>Text size</strong><small>Adjust ChatClub without browser zoom</small></span>
          <select
            value={preferences.textSize}
            onChange={(event) => onChangePreferences({
              ...preferences,
              textSize: event.target.value,
            })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label>
          <span><strong>Reduce motion</strong><small>Limit decorative movement and transitions</small></span>
          <input
            type="checkbox"
            checked={preferences.reducedMotion}
            onChange={(event) => onChangePreferences({
              ...preferences,
              reducedMotion: event.target.checked,
            })}
          />
        </label>
      </section>
      )}

      {activeSettings === 'privacy' && onSignOut && onDeleteAccount && (
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
