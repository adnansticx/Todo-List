import { Routes, Route, Navigate } from "react-router-dom";
import { Todo } from "./projects/Todo/Todo";
import { Home } from "./projects/Todo/Home";

export const App = () => {
  return (
    <section>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/list/:listId" element={<Todo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </section>
  );
};
