import { useEffect, useRef } from "react";
import { MdNotificationsActive } from "react-icons/md";

export const ReminderPrompt = ({ open, busy, onAllow, onClose }) => {
  const allowRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };

    document.addEventListener("keydown", onKey);
    allowRef.current?.focus();

    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="prompt-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="prompt-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-prompt-title"
        aria-describedby="reminder-prompt-text"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="brand-badge prompt-badge">
          <MdNotificationsActive />
        </span>
        <h2 id="reminder-prompt-title">Get reminders?</h2>
        <p id="reminder-prompt-text">
          Allow notifications and this device will remind you at the time you
          set on a task.
        </p>
        <div className="prompt-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Not now
          </button>
          <button
            ref={allowRef}
            type="button"
            className="btn btn-primary"
            onClick={onAllow}
            disabled={busy}
          >
            {busy ? "Waiting..." : "Allow"}
          </button>
        </div>
      </div>
    </div>
  );
};
