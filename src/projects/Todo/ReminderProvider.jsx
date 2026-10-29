import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearNotified,
  getReminderSnapshot,
  isPendingReminder,
  markNotified,
  showTodoNotification,
  subscribeReminders,
} from "./reminderStore";
import { ReminderContext } from "./reminderContext";
import { ReminderToast } from "./ReminderToast";

const CATCH_UP_MS = 12 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_000_000;

const readPermission = () => {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
};

export const ReminderProvider = ({ children }) => {
  const [permission, setPermission] = useState(readPermission);
  const [tasks, setTasks] = useState(getReminderSnapshot);

  useEffect(() => subscribeReminders(() => setTasks(getReminderSnapshot())), []);

  useEffect(() => {
    if (permission !== "granted" || typeof Notification === "undefined") return undefined;

    let cancelled = false;
    const timeoutIds = [];
    const intervalIds = [];
    const claimed = new Set();

    const claim = (todo) => {
      const key = `${todo.id}:${todo.remindAt}`;
      if (claimed.has(key) || !isPendingReminder(todo)) return false;
      claimed.add(key);
      markNotified(todo);
      return true;
    };

    const show = async (todo) => {
      if (cancelled || !claim(todo)) return;
      try {
        await showTodoNotification(todo);
      } catch {
        claimed.delete(`${todo.id}:${todo.remindAt}`);
        clearNotified(todo);
      }
    };

    const sweep = () => {
      const now = Date.now();
      tasks.forEach((todo) => {
        const when = Date.parse(todo.remindAt);
        if (Number.isNaN(when)) return;
        const delay = when - now;
        if (delay <= 0 && now - when <= CATCH_UP_MS) {
          void show(todo);
        }
      });
    };

    const arm = async () => {
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js");
        } catch {
          // A page notification still works when the service worker cannot register.
        }
      }
      if (cancelled) return;

      const now = Date.now();
      tasks.forEach((todo) => {
        if (!isPendingReminder(todo)) return;
        const when = Date.parse(todo.remindAt);
        if (Number.isNaN(when)) return;
        const delay = when - now;
        if (delay <= 0 || delay > MAX_TIMEOUT_MS) return;
        timeoutIds.push(setTimeout(() => void show(todo), delay));
      });

      timeoutIds.push(setTimeout(sweep, 2000));
      intervalIds.push(setInterval(sweep, 15000));
    };

    void arm();

    const onVisible = () => {
      if (document.visibilityState === "visible") sweep();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      timeoutIds.forEach((id) => clearTimeout(id));
      intervalIds.forEach((id) => clearInterval(id));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [permission, tasks]);

  const enableReminders = useCallback(async () => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return "unsupported";
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const value = useMemo(
    () => ({ permission, enableReminders }),
    [permission, enableReminders]
  );

  return (
    <ReminderContext.Provider value={value}>
      {children}
      <ReminderToast />
    </ReminderContext.Provider>
  );
};
