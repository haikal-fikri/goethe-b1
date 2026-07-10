"use client";
import { useState } from "react";
import { IconPlus } from "@/components/icons";
import { NeueKlasseModal } from "./NeueKlasseModal";

// Client-Insel für die Klassen-Liste: der „Neue Klasse"-Button öffnet das
// Anlege-Modal. Die Server-Seite lädt die Daten; hier lebt nur die Interaktion.
export function NeueKlasseButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 44,
          padding: "0 17px",
          borderRadius: 12,
          border: "none",
          background: "var(--primary-btn-bg)",
          color: "var(--primary-btn-fg)",
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        <IconPlus size={17} />
        Neue Klasse
      </button>
      {open ? <NeueKlasseModal userId={userId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
