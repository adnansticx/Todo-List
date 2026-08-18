import { useState } from "react";
import { MdAdd, MdOutlineEditNote } from "react-icons/md";

export const TodoForm = ({ onAddTodo }) => {
  const [inputValue, setInputValue] = useState({
    id: "",
    content: "",
    checked: false,
  });

  const handleInputChange = (value) => {
    setInputValue({ id: value, content: value, checked: false });
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    onAddTodo(inputValue);
    setInputValue({ id: "", content: "", checked: false });
  };

  return (
    <form className="todo-form" onSubmit={handleFormSubmit}>
      <div className="todo-input-wrap">
        <MdOutlineEditNote className="input-icon" />
        <input
          type="text"
          className="todo-input"
          autoComplete="off"
          placeholder="What needs to be done?"
          aria-label="New task"
          value={inputValue.content ?? ""}
          onChange={(event) => handleInputChange(event.target.value)}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!inputValue.content.trim()}
      >
        <MdAdd />
        Add Task
      </button>
    </form>
  );
};
