import { MdCheck, MdDeleteOutline } from "react-icons/md";

export const TodoList = ({
  id,
  data,
  checked,
  onHandleDeleteTodo,
  onHandleCheckedTodo,
}) => {
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
      <span className="todo-text">{data}</span>
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
