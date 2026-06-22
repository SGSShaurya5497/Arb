// Pure SVG sparkline — no Recharts dependency.
// 80×24px, no axes, no grid, just a clean polyline + a dot at the latest value.

interface SparklineProps {
  points: number[];          // rolling spread_bps values, oldest first
  currentValue: number | null;
}

export function Sparkline({ points, currentValue }: SparklineProps) {
  const W = 80;
  const H = 24;
  const PAD = 2; // internal padding so the line doesn't clip at edges

  // Color: tinted green/red based on sign of current value, at 65% opacity
  // so it reads as a subtle accent, not a dominant element in the row.
  const stroke =
    currentValue === null    ? '#3a3a42'
    : currentValue > 0       ? 'rgba(34, 197, 94,  0.65)'  // flux-pos
    : currentValue < 0       ? 'rgba(239, 68,  68, 0.65)'  // flux-neg
    :                          '#5A5A65';                    // muted zero

  // Not enough data — render a dim horizontal hairline as a placeholder
  if (points.length < 2) {
    return (
      <svg width={W} height={H} style={{ display: 'block' }}>
        <line
          x1={PAD} y1={H / 2}
          x2={W - PAD} y2={H / 2}
          stroke="#252529"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const min   = Math.min(...points);
  const max   = Math.max(...points);
  const range = max - min || 1; // guard against flat line (all same value)

  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const xStep  = innerW / (points.length - 1);

  // Map each value to an (x, y) SVG coordinate
  const polyCoords = points
    .map((v, i) => {
      const x = PAD + i * xStep;
      const y = PAD + innerH - ((v - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Last point — where the terminal dot sits
  const lastX = PAD + (points.length - 1) * xStep;
  const lastY = PAD + innerH - ((points[points.length - 1] - min) / range) * innerH;

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={polyCoords}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Terminal dot at current value */}
      <circle
        cx={lastX}
        cy={lastY}
        r={1.5}
        fill={stroke}
      />
    </svg>
  );
}
