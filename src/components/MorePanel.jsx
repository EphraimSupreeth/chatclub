export default function MorePanel({
  preferences,
  onChangePreferences,
  onNavigate,
}) {
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
    </section>
  );
}
