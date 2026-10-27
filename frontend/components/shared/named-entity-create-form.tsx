"use client";

import { useState, type FormEvent } from "react";

type NamedEntityCreateFormProps = {
  label: string;
  buttonLabel: string;
  placeholder: string;
  onCreate: (name: string) => Promise<void>;
};

export function NamedEntityCreateForm({ label, buttonLabel, placeholder, onCreate }: NamedEntityCreateFormProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onCreate(trimmedName);
      setName("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `Could not create ${label.toLowerCase()}.`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="entity-create-form" onSubmit={(event) => void submit(event)}>
      <label>
        <span className="sr-only">{label}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={placeholder}
          maxLength={255}
          required
          aria-invalid={error ? true : undefined}
        />
      </label>
      <button className="button primary" type="submit" disabled={!name.trim() || isSaving}>
        {isSaving ? "Saving…" : buttonLabel}
      </button>
      {error && <p role="alert" className="entity-create-error">{error}</p>}
    </form>
  );
}
