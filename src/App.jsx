import { Routes, Route, Navigate } from "react-router-dom";
import { Todo } from "./projects/Todo/Todo";
import { Home } from "./projects/Todo/Home";
import { ReminderProvider } from "./projects/Todo/ReminderProvider";

export const App = () => {
  return (
    <ReminderProvider>
      <section>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/list/:listId" element={<Todo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
    </ReminderProvider>
  );
};
