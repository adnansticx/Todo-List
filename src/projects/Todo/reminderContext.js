import { createContext, useContext } from "react";

export const ReminderContext = createContext(null);

export const useReminders = () => {
  const value = useContext(ReminderContext);
  if (!value) {
    throw new Error("useReminders must be used within ReminderProvider");
  }
  return value;
};
