import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AcademyCard from './AcademyCard.jsx';

const LIGHT = {
  grid: 'rgba(45, 36, 29, 0.12)',
  axis: '#675b4f',
  line: '#1f4536',
  barStrong: '#1f4536',
  barMid: '#7a5638',
  barWarn: '#b48763',
  tooltipBackground: '#fbf6ee',
  tooltipBorder: 'rgba(45, 36, 29, 0.12)',
};

const DARK = {
  grid: 'rgba(233, 221, 200, 0.12)',
  axis: '#c3b39a',
  line: '#d6b38e',
  barStrong: '#b48763',
  barMid: '#8fa88f',
  barWarn: '#d6b38e',
  tooltipBackground: '#1b2f27',
  tooltipBorder: 'rgba(233, 221, 200, 0.12)',
};

function ChartCard({ title, children }) {
  return (
    <AcademyCard className="p-5 md:p-6">
      <h3 className="font-serif text-2xl text-[var(--academy-text)]">{title}</h3>
      <div className="mt-5 h-64">{children}</div>
    </AcademyCard>
  );
}

function ChartTooltip({ active, payload, label, palette }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-2xl border px-3 py-2 text-sm"
      style={{
        backgroundColor: palette.tooltipBackground,
        borderColor: palette.tooltipBorder,
        color: 'var(--academy-text)',
      }}
    >
      <p className="font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-1 text-[var(--academy-text-muted)]">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function ProgressCharts({ isDark, lineData, recentScores, topicData }) {
  const palette = isDark ? DARK : LIGHT;
  const hasAnyData = lineData.length > 0 || recentScores.length > 0 || topicData.length > 0;

  if (!hasAnyData) return null;

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {lineData.length > 0 ? (
          <ChartCard title="得分趋势">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 12 }} />
                <Tooltip content={<ChartTooltip palette={palette} />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="得分"
                  stroke={palette.line}
                  strokeWidth={2.5}
                  dot={{ fill: palette.line, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        {recentScores.length > 0 ? (
          <ChartCard title="近期得分">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentScores} barSize={30}>
                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 12 }} />
                <Tooltip content={<ChartTooltip palette={palette} />} />
                <Bar dataKey="score" name="得分" radius={[10, 10, 0, 0]}>
                  {recentScores.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.score >= 85
                          ? palette.barStrong
                          : entry.score >= 70
                          ? palette.barMid
                          : palette.barWarn
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}
      </div>

      {topicData.length > 0 ? (
        <ChartCard title="各主题得分分布">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topicData} layout="vertical" barSize={22}>
              <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={palette.axis} tick={{ fill: palette.axis, fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={84}
                stroke={palette.axis}
                tick={{ fill: palette.axis, fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip palette={palette} />} />
              <Bar dataKey="score" name="平均得分" radius={[0, 10, 10, 0]}>
                {topicData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.score >= 80 ? palette.barStrong : entry.score >= 65 ? palette.barMid : palette.barWarn}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </section>
  );
}
