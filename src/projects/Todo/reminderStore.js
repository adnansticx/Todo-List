const TASKS_KEY = "todo-reminder-tasks";
const LOCAL_REMINDERS_KEY = "todo-local-reminders";
const NOTIFIED_PREFIX = "todo-notified:";

const listeners = new Set();
const toastListeners = new Set();
let toasts = [];

const readJson = (key, fallback) => {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full disk should not break adding a task.
  }
};

const flattenTasks = (byList) =>
  Object.values(byList).flatMap((items) => (Array.isArray(items) ? items : []));

let snapshot = flattenTasks(readJson(TASKS_KEY, {}));

const publish = (byList) => {
  writeJson(TASKS_KEY, byList);
  snapshot = flattenTasks(byList);
  listeners.forEach((listener) => listener());
};

export const subscribeReminders = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getReminderSnapshot = () => snapshot;

export const subscribeToasts = (listener) => {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
};

export const getToastSnapshot = () => toasts;

const publishToasts = () => {
  toastListeners.forEach((listener) => listener());
};

export const pushReminderToast = (todo) => {
  const next = {
    id: `${todo.id}:${todo.remindAt}`,
    title: "Todo reminder",
    body: todo.content,
    listId: todo.listId,
  };
  toasts = [...toasts.filter((item) => item.id !== next.id), next];
  publishToasts();
};

export const dismissReminderToast = (id) => {
  const next = toasts.filter((item) => item.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  publishToasts();
};

export const notificationKey = (todo) =>
  `${NOTIFIED_PREFIX}${todo.id}:${todo.remindAt}`;

export const wasNotified = (todo) => {
  try {
    return Boolean(localStorage.getItem(notificationKey(todo)));
  } catch {
    return false;
  }
};

export const markNotified = (todo) => {
  try {
    localStorage.setItem(notificationKey(todo), String(Date.now()));
  } catch {
    // The in-memory claim still prevents a second alert in this tab.
  }
};

export const clearNotified = (todo) => {
  try {
    localStorage.removeItem(notificationKey(todo));
  } catch {
    // Ignore storage failures and allow a later attempt.
  }
};

export const localReminderFor = (id) => {
  const extra = readJson(LOCAL_REMINDERS_KEY, {});
  return extra[id] ?? null;
};

export const rememberLocalReminder = (id, remindAt) => {
  const extra = readJson(LOCAL_REMINDERS_KEY, {});
  extra[id] = remindAt;
  writeJson(LOCAL_REMINDERS_KEY, extra);
};

export const saveListReminders = (listId, tasks) => {
  if (!listId) return;

  const byList = readJson(TASKS_KEY, {});
  const next = (tasks ?? [])
    .filter(
      (todo) =>
        todo.remindAt &&
        !todo.checked &&
        !String(todo.id).startsWith("temp-")
    )
    .map((todo) => ({
      id: todo.id,
      content: todo.content,
      remindAt: todo.remindAt,
      checked: false,
      listId,
    }));

  const previous = Array.isArray(byList[listId]) ? byList[listId] : [];
  if (JSON.stringify(previous) === JSON.stringify(next)) return;

  if (next.length === 0) {
    delete byList[listId];
  } else {
    byList[listId] = next;
  }

  publish(byList);
};

export const isPendingReminder = (todo) => {
  if (!todo?.remindAt || todo.checked) return false;
  if (String(todo.id).startsWith("temp-")) return false;
  return !wasNotified(todo);
};

export const formatRemindAt = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${time}`;
  }

  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  return `${day}, ${time}`;
};

export async function showTodoNotification(todo) {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    pushReminderToast(todo);
    return;
  }

  const title = "Todo reminder";
  const url = new URL(
    `/list/${todo.listId}`,
    window.location.origin
  ).href;
  const options = {
    body: todo.content,
    tag: `todo-${todo.id}`,
    data: { url },
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    } catch {
      // Fall back to a page notification.
    }
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
