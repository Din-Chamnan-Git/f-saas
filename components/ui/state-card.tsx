import type { SummaryCard } from "@/types/dahboard";

type StateCardProps = {
  card: SummaryCard;
};

export default function StateCard({ card }: StateCardProps) {
  return (
    <article className="app-card rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${card.dotColor}`} />
        <p className="app-text-soft text-sm">{card.title}</p>
      </div>
      <p className="mt-2 text-5xl leading-none text-[var(--app-text)]">{card.value}</p>
      {card.hint.trim() ? <p className="app-text-soft mt-3 text-sm">{card.hint}</p> : null}
    </article>
  );
}
