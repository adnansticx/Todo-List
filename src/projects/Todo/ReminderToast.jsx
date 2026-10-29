import { useEffect, useRef, useSyncExternalStore } from "react";
import { MdClose, MdNotificationsActive } from "react-icons/md";
import {
  dismissReminderToast,
  getToastSnapshot,
  subscribeToasts,
} from "./reminderStore";

const TOAST_MS = 12000;

export const ReminderToast = () => {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot,
    getToastSnapshot
  );
  const timers = useRef(new Map());

  useEffect(() => {
    const active = new Set(toasts.map((toast) => toast.id));

    timers.current.forEach((timer, id) => {
      if (active.has(id)) return;
      clearTimeout(timer);
      timers.current.delete(id);
    });

    toasts.forEach((toast) => {
      if (timers.current.has(toast.id)) return;
      timers.current.set(
        toast.id,
        setTimeout(() => {
          timers.current.delete(toast.id);
          dismissReminderToast(toast.id);
        }, TOAST_MS)
      );
    });
  }, [toasts]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <article key={toast.id} className="reminder-toast">
          <span className="toast-badge">
            <MdNotificationsActive />
          </span>
          <div className="toast-copy">
            <p className="toast-title">{toast.title}</p>
            <p className="toast-body">{toast.body}</p>
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss reminder"
            onClick={() => dismissReminderToast(toast.id)}
          >
            <MdClose />
          </button>
        </article>
      ))}
    </div>
  );
};
