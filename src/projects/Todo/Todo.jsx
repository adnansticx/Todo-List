import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MdAdd,
  MdCheck,
  MdChecklist,
  MdContentCopy,
  MdDeleteOutline,
  MdErrorOutline,
  MdNotificationsActive,
  MdNotificationsNone,
  MdOutlineInbox,
} from "react-icons/md";
import "./Todo.css";
import { TodoForm } from "./TodoForm";
import { TodoList } from "./TodoList";
import { TodoDate } from "./TodoDate";
import { useSharedTodos } from "./useSharedTodos";
import { useReminders } from "./reminderContext";
import { saveListReminders } from "./reminderStore";
import { ReminderPrompt } from "./ReminderPrompt";

export const Todo = () => {
  const { listId } = useParams();
  const {
    task,
    loading,
    error,
    listStatus,
    connected,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearTodos,
  } = useSharedTodos(listId);
  const { permission, enableReminders } = useReminders();
  const [copied, setCopied] = useState(false);
  const [reminderHint, setReminderHint] = useState(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);

  useEffect(() => {
    if (listStatus !== "ready") return;
    saveListReminders(listId, task);
  }, [listId, listStatus, task]);

  const handleAddTodo = async (input) => {
    const saved = await addTodo(input);
    if (!saved?.ok || !input.remindAt) return;

    if (saved.stored === "device") {
      setReminderHint(
        "Reminder saved on this browser. Add the remind_at column in Supabase so your phone can use the same time."
      );
    }

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      setPromptOpen(true);
      return;
    }

    if (
      typeof Notification !== "undefined" &&
      Notification.permission !== "granted"
    ) {
      setReminderHint(
        "Task saved. Allow reminders so this device can notify you at that time."
      );
    }
  };

  const closeReminderPrompt = useCallback(() => {
    setPromptOpen(false);
  }, []);

  const handleEnableReminders = () => {
    if (permission === "unsupported") {
      setReminderHint("This browser cannot show notifications.");
      return;
    }

    if (permission === "denied") {
      setReminderHint(
        "Notifications are blocked for this site. Allow them in the browser settings, then reload."
      );
      return;
    }

    setPromptOpen(true);
  };

  const handleConfirmReminders = async () => {
    setPromptBusy(true);
    const result = await enableReminders();
    setPromptBusy(false);
    setPromptOpen(false);

    if (result === "granted") {
      setReminderHint(null);
      return;
    }

    setReminderHint(
      result === "denied"
        ? "Notifications are blocked for this site. Allow them in the browser settings, then reload."
        : "Allow notifications in the browser prompt to get reminders."
    );
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const isReady = listStatus === "ready";
  const total = task.length;
  const completed = task.filter((curTask) => curTask.checked).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <main className="app-shell">
      <section className="todo-card">
        <header className="todo-header">
          <div className="brand">
            <span className="brand-badge">
              <MdChecklist />
            </span>
            <div>
              <h1>Todo List</h1>
              <TodoDate />
            </div>
          </div>

          {isReady && (
            <div className="header-actions">
              <button
                type="button"
                className={`btn btn-ghost${copied ? " is-copied" : ""}`}
                onClick={handleCopyLink}
              >
                {copied ? <MdCheck /> : <MdContentCopy />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              {permission === "granted" ? (
                <span className="reminder-status">
                  <MdNotificationsActive />
                  Reminders on
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleEnableReminders}
                >
                  <MdNotificationsNone />
                  Allow reminders
                </button>
              )}
              <Link to="/" className="btn btn-ghost">
                <MdAdd />
                New List
              </Link>
            </div>
          )}
        </header>

        {loading && (
          <div className="skeleton-stack">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        )}

        {!loading && error && (
          <p className="status-note is-error">
            <MdErrorOutline />
            {error}
          </p>
        )}

        {!loading && !isReady && (
          <Link to="/" className="btn btn-primary btn-lg">
            Create New List
          </Link>
        )}

        {isReady && (
          <>
            {reminderHint && (
              <p className="status-note">
                <MdNotificationsNone />
                {reminderHint}
              </p>
            )}

            <TodoForm onAddTodo={handleAddTodo} />

            {total > 0 && (
              <div className="progress">
                <div className="progress-meta">
                  <span>
                    {completed} of {total} done
                  </span>
                  <span>{percent}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            {total === 0 ? (
              <div className="empty-state">
                <MdOutlineInbox />
                <p>No tasks yet. Add your first one above.</p>
              </div>
            ) : (
              <ul className="todo-list">
                {task.map((curTask) => {
                  return (
                    <TodoList
                      key={curTask.id}
                      id={curTask.id}
                      data={curTask.content}
                      checked={curTask.checked}
                      remindAt={curTask.remindAt}
                      onHandleDeleteTodo={deleteTodo}
                      onHandleCheckedTodo={toggleTodo}
                    />
                  );
                })}
              </ul>
            )}

            <footer className="todo-footer">
              <span className={`live-badge${connected ? "" : " is-offline"}`}>
                <span className="live-dot" />
                {connected ? "Live sync on" : "Connecting..."}
              </span>

              {total > 0 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={clearTodos}
                >
                  <MdDeleteOutline />
                  Clear all
                </button>
              )}
            </footer>
          </>
        )}
      </section>

      <ReminderPrompt
        open={promptOpen}
        busy={promptBusy}
        onAllow={handleConfirmReminders}
        onClose={closeReminderPrompt}
      />
    </main>
  );
};
