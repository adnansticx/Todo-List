import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MdAdd,
  MdCheck,
  MdChecklist,
  MdContentCopy,
  MdDeleteOutline,
  MdErrorOutline,
  MdOutlineInbox,
} from "react-icons/md";
import "./Todo.css";
import { TodoForm } from "./TodoForm";
import { TodoList } from "./TodoList";
import { TodoDate } from "./TodoDate";
import { useSharedTodos } from "./useSharedTodos";

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
  const [copied, setCopied] = useState(false);

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
            Create New Shared List
          </Link>
        )}

        {isReady && (
          <>
            <TodoForm onAddTodo={addTodo} />

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
    </main>
  );
};
