import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdBolt,
  MdErrorOutline,
  MdLink,
  MdPeopleOutline,
  MdTaskAlt,
} from "react-icons/md";
import "./Todo.css";
import { TodoDate } from "./TodoDate";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { generateListId } from "../../lib/listId";

export const Home = () => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateSharedList = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError(
        "This app is not connected to Supabase yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server."
      );
      return;
    }

    setCreating(true);
    setError(null);

    try {
      let listId = generateListId();
      let { error: insertError } = await supabase
        .from("lists")
        .insert({ id: listId });

      if (insertError) {
        listId = generateListId();
        const retry = await supabase.from("lists").insert({ id: listId });
        insertError = retry.error;
      }

      if (insertError) {
        throw insertError;
      }

      navigate(`/list/${listId}`);
    } catch {
      setError("Could not create a shared list. Please try again.");
      setCreating(false);
    }
  };

  return (
    <main className="app-shell app-shell--center">
      <section className="hero">
        <h1>Todo List</h1>
        <TodoDate />

        <p className="hero-subtitle">
          Create a list, share the link, and work on the same tasks together.
          Every add, tick and delete shows up instantly for everyone.
        </p>

        {error && (
          <p className="status-note is-error">
            <MdErrorOutline />
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleCreateSharedList}
          disabled={creating}
        >
          <MdTaskAlt />
          {creating ? "Creating..." : "Create New List"}
        </button>

        <div className="feature-grid">
          <div className="feature-card">
            <MdLink />
            <p>Share one link</p>
          </div>
          <div className="feature-card">
            <MdBolt />
            <p>Instant sync</p>
          </div>
          <div className="feature-card">
            <MdPeopleOutline />
            <p>No accounts</p>
          </div>
        </div>
      </section>
    </main>
  );
};
