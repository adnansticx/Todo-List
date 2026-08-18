import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { isValidListId } from "../../lib/listId";

const mapTodoFromDb = (row) => ({
  id: row.id,
  content: row.task,
  checked: Boolean(row.completed),
});

const CONFIG_ERROR =
  "This app is not connected to Supabase yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.";

export const useSharedTodos = (listId) => {
  const [task, setTask] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listStatus, setListStatus] = useState("loading");
  const [connected, setConnected] = useState(false);
  const taskRef = useRef(task);

  taskRef.current = task;

  useEffect(() => {
    let cancelled = false;
    let channel = null;

    const loadAndSubscribe = async () => {
      setLoading(true);
      setError(null);
      setTask([]);
      setListStatus("loading");
      setConnected(false);

      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) {
          setListStatus("error");
          setError(CONFIG_ERROR);
          setLoading(false);
        }
        return;
      }

      if (!isValidListId(listId)) {
        if (!cancelled) {
          setListStatus("invalid");
          setError("This list link is not valid.");
          setLoading(false);
        }
        return;
      }

      const { data: listRow, error: listError } = await supabase
        .from("lists")
        .select("id")
        .eq("id", listId)
        .maybeSingle();

      if (cancelled) return;

      if (listError) {
        setListStatus("error");
        setError("Could not load this Todo list. Please try again.");
        setLoading(false);
        return;
      }

      if (!listRow) {
        setListStatus("not_found");
        setError("This shared list was not found. Create a new list to get a link.");
        setLoading(false);
        return;
      }

      const { data: todos, error: todosError } = await supabase
        .from("todos")
        .select("id, list_id, task, completed, created_at")
        .eq("list_id", listId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (todosError) {
        setListStatus("error");
        setError("Could not load tasks for this list. Please try again.");
        setLoading(false);
        return;
      }

      if (cancelled) return;

      setTask((todos ?? []).map(mapTodoFromDb));
      setListStatus("ready");
      setLoading(false);

      channel = supabase
        .channel(`todos-list-${listId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "todos",
            filter: `list_id=eq.${listId}`,
          },
          (payload) => {
            const eventType = payload.eventType;

            if (eventType === "INSERT" && payload.new) {
              const incoming = mapTodoFromDb(payload.new);
              setTask((prev) => {
                if (prev.some((item) => item.id === incoming.id)) {
                  return prev;
                }

                const optimisticIndex = prev.findIndex(
                  (item) =>
                    String(item.id).startsWith("temp-") &&
                    item.content === incoming.content
                );

                if (optimisticIndex !== -1) {
                  const next = [...prev];
                  next[optimisticIndex] = incoming;
                  return next;
                }

                return [...prev, incoming];
              });
              return;
            }

            if (eventType === "UPDATE" && payload.new) {
              const incoming = mapTodoFromDb(payload.new);
              setTask((prev) => {
                const exists = prev.some((item) => item.id === incoming.id);
                if (!exists) return [...prev, incoming];
                return prev.map((item) =>
                  item.id === incoming.id ? incoming : item
                );
              });
              return;
            }

            if (eventType === "DELETE" && payload.old?.id) {
              setTask((prev) =>
                prev.filter((item) => item.id !== payload.old.id)
              );
            }
          }
        )
        // Unless todos has REPLICA IDENTITY FULL, a DELETE payload carries only
        // the primary key, so the list_id filter above never matches it. This
        // unfiltered binding still removes by id, which only affects rows this
        // client already has loaded.
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "todos" },
          (payload) => {
            const deletedId = payload.old?.id;
            if (!deletedId) return;
            setTask((prev) => prev.filter((item) => item.id !== deletedId));
          }
        )
        .subscribe((status) => {
          if (cancelled) return;
          setConnected(status === "SUBSCRIBED");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setError("Live updates disconnected. Refresh the page to reconnect.");
          }
        });

      if (cancelled && channel) {
        supabase.removeChannel(channel);
      }
    };

    loadAndSubscribe();

    return () => {
      cancelled = true;
      setConnected(false);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [listId]);

  const addTodo = useCallback(
    async (inputValue) => {
      const content = inputValue?.content?.trim?.() ?? "";
      if (!content || !supabase) return;

      if (taskRef.current.some((item) => item.content === content)) return;

      const optimisticId = `temp-${crypto.randomUUID()}`;
      const optimisticTodo = { id: optimisticId, content, checked: false };

      setTask((prev) => {
        if (
          prev.some(
            (item) => item.id === optimisticId || item.content === content
          )
        ) {
          return prev;
        }
        return [...prev, optimisticTodo];
      });
      setError(null);

      const { data, error: insertError } = await supabase
        .from("todos")
        .insert({ list_id: listId, task: content, completed: false })
        .select("id, list_id, task, completed, created_at")
        .single();

      if (insertError) {
        setTask((prev) => prev.filter((item) => item.id !== optimisticId));
        setError("Could not add the task. Please try again.");
        return;
      }

      const saved = mapTodoFromDb(data);
      setTask((prev) => {
        const withoutOptimistic = prev.filter((item) => item.id !== optimisticId);
        if (withoutOptimistic.some((item) => item.id === saved.id)) {
          return withoutOptimistic;
        }
        return [...withoutOptimistic, saved];
      });
    },
    [listId]
  );

  const toggleTodo = useCallback(async (id) => {
    if (!supabase || String(id).startsWith("temp-")) return;

    const current = taskRef.current.find((item) => item.id === id);
    if (!current) return;

    const nextChecked = !current.checked;
    setTask((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: nextChecked } : item
      )
    );
    setError(null);

    const { error: updateError } = await supabase
      .from("todos")
      .update({ completed: nextChecked })
      .eq("id", id)
      .eq("list_id", listId);

    if (updateError) {
      setTask((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, checked: current.checked } : item
        )
      );
      setError("Could not update the task. Please try again.");
    }
  }, [listId]);

  const deleteTodo = useCallback(async (id) => {
    if (!supabase || String(id).startsWith("temp-")) return;

    const previous = taskRef.current;
    setTask((prev) => prev.filter((item) => item.id !== id));
    setError(null);

    const { error: deleteError } = await supabase
      .from("todos")
      .delete()
      .eq("id", id)
      .eq("list_id", listId);

    if (deleteError) {
      setTask(previous);
      setError("Could not delete the task. Please try again.");
    }
  }, [listId]);

  const clearTodos = useCallback(async () => {
    if (!supabase) return;

    const previous = taskRef.current;
    setTask([]);
    setError(null);

    const { error: clearError } = await supabase
      .from("todos")
      .delete()
      .eq("list_id", listId);

    if (clearError) {
      setTask(previous);
      setError("Could not clear tasks. Please try again.");
    }
  }, [listId]);

  return {
    task,
    loading,
    error,
    listStatus,
    connected,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearTodos,
  };
};
