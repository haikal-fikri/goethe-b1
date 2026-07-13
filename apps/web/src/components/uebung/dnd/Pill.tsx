import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";

type Variant = "bank" | "slot" | "tray";

export interface PillProps extends ComponentPropsWithoutRef<"button"> {
  label: string;
  /** Tastaturziffer (nur Wortbank-Bank) */
  index?: number;
  variant?: Variant;
  /** wird gerade gezogen → halbtransparent als Platzhalter */
  dragging?: boolean;
  /** als Ziehgriff markieren → touch-action: none, damit Finger-Ziehen nicht scrollt */
  draggable?: boolean;
  style?: CSSProperties;
}

/**
 * Rein darstellende „Pille“ (Wort-Kachel). Leitet ref + beliebige Props
 * (dnd-kit attributes/listeners) an den Button weiter, damit sie sowohl
 * ziehbar (Maus/Finger) als auch antippbar ist.
 */
export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { label, index, variant = "slot", dragging, draggable, style, className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={
        "press relative min-h-[44px] touch-manipulation select-none rounded-tile border border-line bg-surface-alt px-3.5 py-2 text-[15px] font-medium text-ink transition-colors enabled:hover:border-line-strong disabled:opacity-60" +
        (className ? ` ${className}` : "")
      }
      // `...style` MUSS zuletzt stehen: dnd-kit liefert hierüber das transform
      // während des Ziehens — es darf von nichts überschrieben werden.
      style={{
        opacity: dragging ? 0.4 : undefined,
        touchAction: draggable ? "none" : undefined,
        cursor: draggable ? "grab" : undefined,
        ...style,
      }}
      {...rest}
    >
      {label}
      {variant === "bank" && index && (
        <span className="ml-1.5 hidden font-serif text-[11px] tabular-nums text-faint sm:inline">
          {index}
        </span>
      )}
    </button>
  );
});
