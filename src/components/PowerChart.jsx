import { getPowerBands } from "../utils/powerBands.js";

function scale(value, min, max, height, padding) {
  if (max === min) return height / 2;
  return height - padding - ((value - min) / (max - min)) * (height - padding * 2);
}

function linePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export default function PowerChart({ spellLevel, spellPower }) {
  const level = Math.max(0, Number(spellLevel) || 0);
  const maxLevel = Math.max(9, level + 1);
  const levels = Array.from({ length: maxLevel + 1 }, (_, index) => index);
  const bands = levels.map((lvl) => ({ level: lvl, ...getPowerBands(lvl) }));
  const values = bands.flatMap((band) => [band.minPower, band.avgDown, band.avgUp, band.maxPower, Number(spellPower) || 0]);
  const minY = Math.min(0, ...values);
  const maxY = Math.max(...values) + 10;
  const width = 720;
  const height = 320;
  const padding = 38;
  const xFor = (lvl) => padding + (lvl / maxLevel) * (width - padding * 2);
  const yFor = (value) => scale(value, minY, maxY, height, padding);
  const series = [
    { key: "minPower", label: "Minimum", className: "chart-line chart-line-min" },
    { key: "avgDown", label: "Avg Low", className: "chart-line chart-line-low" },
    { key: "avgUp", label: "Avg High", className: "chart-line chart-line-high" },
    { key: "maxPower", label: "Maximum", className: "chart-line chart-line-max" },
  ];
  const dotX = xFor(level);
  const dotY = yFor(Number(spellPower) || 0);

  return (
    <div className="chart-card" aria-label="Spell power chart">
      <div className="chart-legend" aria-hidden="true">
        {series.map((entry) => (
          <span key={entry.key} className="legend-item">
            <i className={entry.className} /> {entry.label}
          </span>
        ))}
        <span className="legend-item"><i className="chart-dot-legend" /> This spell</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="power-chart-title power-chart-desc">
        <title id="power-chart-title">Level versus spell power</title>
        <desc id="power-chart-desc">Shows expected power bands by level and the current spell power position.</desc>
        <line className="chart-axis" x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line className="chart-axis" x1={padding} y1={padding} x2={padding} y2={height - padding} />
        {[0, 3, 6, 9].map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={xFor(tick)} y1={padding} x2={xFor(tick)} y2={height - padding} />
            <text className="chart-label" x={xFor(tick)} y={height - 12} textAnchor="middle">{tick}</text>
          </g>
        ))}
        {[minY, Math.round(maxY / 2), maxY].map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={padding} y1={yFor(tick)} x2={width - padding} y2={yFor(tick)} />
            <text className="chart-label" x={padding - 10} y={yFor(tick) + 4} textAnchor="end">{Math.round(tick)}</text>
          </g>
        ))}
        {series.map((entry) => {
          const points = bands.map((band) => ({ x: xFor(band.level), y: yFor(band[entry.key]) }));
          return <path key={entry.key} className={entry.className} d={linePath(points)} />;
        })}
        <line className="chart-current-guide" x1={dotX} y1={padding} x2={dotX} y2={height - padding} />
        <circle className="chart-current-dot" cx={dotX} cy={dotY} r="7" />
        <text className="chart-current-label" x={Math.min(width - 112, dotX + 12)} y={Math.max(30, dotY - 10)}>
          {Number(spellPower) || 0} power
        </text>
      </svg>
    </div>
  );
}
