import { useState, type KeyboardEvent } from "react";
import styles from "./TagInput.module.css";

/** Free-form tag entry (used for product certifications). Enter or comma adds. */
export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const t = raw.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={styles.wrap}>
      {value.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
            ×
          </button>
        </span>
      ))}
      <input
        className={styles.input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length ? "" : placeholder}
      />
    </div>
  );
}
