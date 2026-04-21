import './styles/OverviewSummary.scss';

type OverviewStat = {
  label: string;
  value: string;
};

type OverviewSummaryProps = {
  allergy: string;
  nursingLevel: string;
  stats: OverviewStat[];
};

export function OverviewSummary({ allergy, nursingLevel, stats }: OverviewSummaryProps) {
  return (
    <section className="summary-grid" aria-label="病历概览">
      {stats.map((item) => (
        <article className="summary-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>
            {nursingLevel} · 过敏史：{allergy}
          </p>
        </article>
      ))}
    </section>
  );
}
