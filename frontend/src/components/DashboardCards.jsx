import React from "react";

/**
 * DashboardCards — mobile-optimised stat card grid.
 *
 * Props:
 *   cards: Array<{ label: string, value: string|number, icon: LucideIcon,
 *                  colorClass: string, bgClass: string }>
 *   cols: 2 | 3 | 4   (default 2)
 */
export default function DashboardCards({ cards = [], cols = 2 }) {
  const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  }[cols] || "grid-cols-2";

  return (
    <div className={`grid ${colClass} gap-2 sm:gap-3`}>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={card.label || card.type || i}
            className={`rounded-xl p-3 sm:p-4 text-center flex flex-col items-center gap-1 overflow-hidden ${card.bgClass || "bg-blue-50 dark:bg-blue-950"}`}
            data-testid={`dash-card-${card.label?.toLowerCase().replace(/\s+/g, "-")}`}>
            {Icon && <Icon className={`w-5 h-5 mb-0.5 flex-shrink-0 ${card.colorClass || "text-[#0000FF]"}`} />}
            <div className={`text-xl sm:text-2xl font-extrabold ${card.colorClass || "text-[#0000FF]"}`}>
              {card.value ?? "—"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate w-full text-center">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
