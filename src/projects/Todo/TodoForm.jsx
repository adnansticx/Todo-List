import { useState } from "react";
import { MdAdd, MdOutlineEditNote } from "react-icons/md";
import { RemindPicker } from "./RemindPicker";

const emptyInput = { content: "", remindAt: "" };

export const TodoForm = ({ onAddTodo }) => {
  const [inputValue, setInputValue] = useState(emptyInput);
  const [timeError, setTimeError] = useState(null);

  const handleFormSubmit = (event) => {
    event.preventDefault();
    const content = inputValue.content.trim();
    if (!content) return;

    let remindAt = null;
    if (inputValue.remindAt) {
      const when = new Date(inputValue.remindAt);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        setTimeError("Choose a future time.");
        return;
      }
      remindAt = when.toISOString();
    }

    setTimeError(null);
    onAddTodo({ content, remindAt });
    setInputValue(emptyInput);
  };

  return (
    <form className="todo-form" noValidate onSubmit={handleFormSubmit}>
      <div className="todo-input-wrap">
        <MdOutlineEditNote className="input-icon" />
        <input
          type="text"
          className="todo-input"
          autoComplete="off"
          placeholder="What needs to be done?"
          aria-label="New task"
          value={inputValue.content}
          onChange={(event) => {
            setTimeError(null);
            setInputValue((current) => ({
              ...current,
              content: event.target.value,
            }));
          }}
        />
      </div>
      <RemindPicker
        value={inputValue.remindAt}
        onChange={(remindAt) => {
          setTimeError(null);
          setInputValue((current) => ({ ...current, remindAt }));
        }}
      />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!inputValue.content.trim()}
      >
        <MdAdd />
        Add Task
      </button>
      {timeError && <p className="field-error">{timeError}</p>}
    </form>
  );
};
