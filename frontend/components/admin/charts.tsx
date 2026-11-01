'use client';
import { useState } from 'react';
import { CHART, type StatusMeta } from '@/lib/constants';
import { formatMonth, formatNumber } from '@/lib/format';
import { Icon } from '../icon';

type Point = { month: string; total: number };

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
}

/** Single-series area chart with crosshair tooltip. */
export function AreaChart({
  data,
  color = CHART.primary,
  label,
  height = 220,
}: {
  data: Point[];
  color?: string;
  label: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const width = 600;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.total), 0));
  const x = (i: number) =>
    pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.total)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const gradientId = `area-${label.replace(/\W/g, '')}`;
  const last = data.length - 1;

  return (
    <div className="chart" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke={CHART.grid}
              strokeWidth="1"
            />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={d.month} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis">
            {formatMonth(d.month)}
          </text>
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke={CHART.grid}
            strokeWidth="1.5"
          />
        )}
        {data.map((d, i) =>
          i === active || i === last ? (
            <circle
              key={d.month}
              cx={x(i)}
              cy={y(d.total)}
              r="5"
              fill={color}
              stroke="#fff"
              strokeWidth="2"
            />
          ) : null,
        )}
        {data.map((d, i) => (
          <rect
            key={`hit-${d.month}`}
            x={x(i) - innerW / Math.max(1, data.length - 1) / 2}
            y={pad.top}
            width={innerW / Math.max(1, data.length - 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>
      {active !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(x(active) / width) * 100}%`,
            top: `${(y(data[active].total) / height) * 100}%`,
          }}
        >
          <span>{formatMonth(data[active].month)}</span>
          <strong>{formatNumber(data[active].total)}</strong>
        </div>
      )}
    </div>
  );
}

/** Donut for part-to-whole. Identity always comes from the legend (icon + label + value), never colour alone. */
export function DonutChart({
  items,
  centerLabel,
}: {
  items: { key: string; meta: StatusMeta; value: number }[];
  centerLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  const radius = 70;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;
  const gap = total && items.filter((i) => i.value).length > 1 ? 3 : 0;
  let offset = 0;
  const focus = items.find((i) => i.key === active);

  return (
    <div className="donut">
      <div className="donut-figure">
        <svg viewBox="0 0 180 180" role="img" aria-label={centerLabel}>
          <circle cx="90" cy="90" r={radius} fill="none" stroke={CHART.grid} strokeWidth={stroke} />
          {total > 0 &&
            items.map((item) => {
              const length = (item.value / total) * circumference;
              const segment = (
                <circle
                  key={item.key}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={CHART.tone[item.meta.tone]}
                  strokeWidth={active === item.key ? stroke + 4 : stroke}
                  strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 90 90)"
                  onMouseEnter={() => setActive(item.key)}
                  onMouseLeave={() => setActive(null)}
                  style={{ transition: 'stroke-width .15s' }}
                />
              );
              offset += length;
              return item.value ? segment : null;
            })}
        </svg>
        <div className="donut-center">
          <strong>{formatNumber(focus ? focus.value : total)}</strong>
          <span>{focus ? focus.meta.label : centerLabel}</span>
        </div>
      </div>
      <ul className="legend">
        {items.map((item) => (
          <li
            key={item.key}
            onMouseEnter={() => setActive(item.key)}
            onMouseLeave={() => setActive(null)}
            className={active === item.key ? 'is-active' : ''}
          >
            <span className="legend-swatch" style={{ background: CHART.tone[item.meta.tone] }} />
            <Icon name={item.meta.icon} />
            <span>{item.meta.label}</span>
            <strong>{formatNumber(item.value)}</strong>
            <small>{total ? Math.round((item.value / total) * 100) : 0}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars with the value at the tip. */
export function BarList({
  items,
  color = CHART.primary,
  empty = 'Sem dados.',
}: {
  items: { label: string; value: number; href?: string }[];
  color?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="muted-text">{empty}</p>;
  return (
    <ol className="bar-list">
      {items.map((item) => (
        <li key={item.label}>
          <div className="bar-list-row">
            <span>{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
          <div className="bar-track">
            <span style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
