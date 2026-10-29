import { MdCheck, MdDeleteOutline, MdNotificationsNone } from "react-icons/md";
import { formatRemindAt } from "./reminderStore";

export const TodoList = ({
  id,
  data,
  checked,
  remindAt,
  onHandleDeleteTodo,
  onHandleCheckedTodo,
}) => {
  const reminderLabel = remindAt ? formatRemindAt(remindAt) : "";
  const overdue =
    Boolean(reminderLabel) && !checked && Date.parse(remindAt) < Date.now();

  return (
    <li className={`todo-item${checked ? " is-done" : ""}`}>
      <button
        type="button"
        className="check-btn"
        aria-label={checked ? "Mark as not done" : "Mark as done"}
        onClick={() => onHandleCheckedTodo(id)}
      >
        <MdCheck />
      </button>
      <div className="todo-main">
        <span className="todo-text">{data}</span>
        {reminderLabel && (
          <span className={`todo-remind${overdue ? " is-overdue" : ""}`}>
            <MdNotificationsNone />
            {reminderLabel}
          </span>
        )}
      </div>
      <button
        type="button"
        className="delete-btn"
        aria-label="Delete task"
        onClick={() => onHandleDeleteTodo(id)}
      >
        <MdDeleteOutline />
      </button>
    </li>
  );
};
