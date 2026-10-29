import { useEffect, useId, useRef, useState } from "react";
import { MdChevronLeft, MdChevronRight, MdSchedule } from "react-icons/md";
import { formatRemindAt } from "./reminderStore";

const WEEKDAYS = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(
    new Date(2024, 0, 7 + index)
  )
);

const pad = (value) => String(value).padStart(2, "0");

const toLocalValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseLocal = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const nextMinute = (date) => {
  const next = new Date(date.getTime() + 60_000);
  next.setSeconds(0, 0);
  return next;
};

const sameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const monthCells = (cursor) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from(
      { length: count },
      (_, index) => new Date(year, month, index + 1)
    ),
  ];
};

export const RemindPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => nextMinute(new Date()));
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [pickerError, setPickerError] = useState(null);
  const rootRef = useRef(null);
  const panelId = useId();
  const now = new Date();
  const today = startOfDay(now);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const canGoPrev = cursor > thisMonth;
  const hour24 = draft.getHours();
  const hour12 = hour24 % 12 || 12;
  const isPm = hour24 >= 12;
  const future = draft.getTime() > Date.now();

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openPicker = () => {
    const initial = parseLocal(value) ?? nextMinute(new Date());
    setDraft(initial);
    setCursor(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setPickerError(null);
    setOpen(true);
  };

  const selectDay = (day) => {
    const next = new Date(draft);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setDraft(next);
    setPickerError(null);
  };

  const shiftDraft = (unit, amount) => {
    const next = new Date(draft);
    if (unit === "hours") next.setHours(next.getHours() + amount);
    if (unit === "minutes") next.setMinutes(next.getMinutes() + amount);
    setDraft(next);
    setPickerError(null);
  };

  const setPeriod = (pm) => {
    const next = new Date(draft);
    const hours = next.getHours();
    if (pm && hours < 12) next.setHours(hours + 12);
    if (!pm && hours >= 12) next.setHours(hours - 12);
    setDraft(next);
    setPickerError(null);
  };

  const goToday = () => {
    const soon = nextMinute(new Date());
    const candidate = new Date(draft);
    candidate.setFullYear(soon.getFullYear(), soon.getMonth(), soon.getDate());
    const chosen = candidate.getTime() > Date.now() ? candidate : soon;
    setDraft(chosen);
    setCursor(new Date(chosen.getFullYear(), chosen.getMonth(), 1));
    setPickerError(null);
  };

  const confirm = () => {
    if (draft.getTime() <= Date.now()) {
      setPickerError("Choose a future time.");
      return;
    }
    onChange(toLocalValue(draft));
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div className="todo-time-field" ref={rootRef}>
      <button
        type="button"
        className={`todo-time-wrap${open ? " is-open" : ""}${value ? " is-set" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span className="todo-time-caption">
          <MdSchedule />
          Remind
        </span>
        <span className={`todo-time-value${value ? "" : " is-empty"}`}>
          {value ? formatRemindAt(value) : "Add a time"}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="picker-backdrop"
            aria-label="Close calendar"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            className="picker-panel"
            role="dialog"
            aria-label="Choose reminder time"
          >
            <div className="picker-month">
              <button
                type="button"
                className="picker-icon-btn"
                aria-label="Previous month"
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
                  )
                }
                disabled={!canGoPrev}
              >
                <MdChevronLeft />
              </button>
              <h3>
                {new Intl.DateTimeFormat(undefined, {
                  month: "long",
                  year: "numeric",
                }).format(cursor)}
              </h3>
              <button
                type="button"
                className="picker-icon-btn"
                aria-label="Next month"
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
                  )
                }
              >
                <MdChevronRight />
              </button>
            </div>

            <div className="picker-weekdays">
              {WEEKDAYS.map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>

            <div className="picker-days">
              {monthCells(cursor).map((day, index) =>
                day ? (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={`picker-day${sameDay(day, today) ? " is-today" : ""}${sameDay(day, draft) ? " is-selected" : ""}`}
                    disabled={startOfDay(day) < today}
                    onClick={() => selectDay(day)}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span key={`empty-${index}`} />
                )
              )}
            </div>

            <div className="picker-time">
              <div className="picker-clock">
                <div className="picker-spinner">
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Hour down"
                    onClick={() => shiftDraft("hours", -1)}
                  >
                    <MdChevronLeft />
                  </button>
                  <span className="picker-spin-value">{pad(hour12)}</span>
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Hour up"
                    onClick={() => shiftDraft("hours", 1)}
                  >
                    <MdChevronRight />
                  </button>
                </div>
                <span className="picker-colon">:</span>
                <div className="picker-spinner">
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Minute down"
                    onClick={() => shiftDraft("minutes", -1)}
                  >
                    <MdChevronLeft />
                  </button>
                  <span className="picker-spin-value">
                    {pad(draft.getMinutes())}
                  </span>
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Minute up"
                    onClick={() => shiftDraft("minutes", 1)}
                  >
                    <MdChevronRight />
                  </button>
                </div>
              </div>

              <div className="picker-period" role="group" aria-label="AM or PM">
                <button
                  type="button"
                  className={isPm ? "" : "is-active"}
                  onClick={() => setPeriod(false)}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={isPm ? "is-active" : ""}
                  onClick={() => setPeriod(true)}
                >
                  PM
                </button>
              </div>
            </div>

            {pickerError && <p className="picker-note">{pickerError}</p>}
            {!pickerError && !future && (
              <p className="picker-note">Choose a future time.</p>
            )}

            <div className="picker-footer">
              <button type="button" className="btn btn-ghost picker-btn" onClick={clear}>
                Clear
              </button>
              <button
                type="button"
                className="btn btn-ghost picker-btn"
                onClick={goToday}
              >
                Today
              </button>
              <button
                type="button"
                className="btn btn-primary picker-btn"
                onClick={confirm}
                disabled={!future}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
