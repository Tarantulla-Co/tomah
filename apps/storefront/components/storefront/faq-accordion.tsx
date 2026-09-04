'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';

export function FaqAccordion({ items }: { items: { id: string; question: string; answer: string }[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="faq-list">
      {items.map((f) => {
        const expanded = open === f.id;
        return (
          <div className={`faq-item ${expanded ? 'open' : ''}`} key={f.id}>
            <button
              type="button"
              className="faq-question"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : f.id)}
            >
              <span>{f.question}</span>
              <Plus size={18} className="faq-icon" aria-hidden />
            </button>
            {expanded && <p className="faq-answer">{f.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
