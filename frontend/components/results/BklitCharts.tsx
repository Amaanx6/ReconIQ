'use client'

import { useMemo } from 'react'

import { Gauge } from '@/components/charts/gauge'
import { PieChart } from '@/components/charts/pie-chart'
import { PieSlice } from '@/components/charts/pie-slice'
import { BarChart } from '@/components/charts/bar-chart'
import { Bar } from '@/components/charts/bar'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip'

type Props = {
  result: Record<string, unknown> | null | undefined
  summary: {
    overall: number | null
    total: number | null
    outcomes: Array<{
      key: string
      label: string
      count: number
    }>
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null
}

function percent(value: unknown): number | null {
  const n = numberValue(value)
  if (n === null) return null
  return n <= 1 ? n * 100 : n
}

function asObject(value: unknown): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>
  }

  return {}
}

function overallMetrics(source: unknown): Record<string, unknown> {
  const block = asObject(source)
  return asObject(block.overall)
}

export default function BklitCharts({
  result,
  summary,
}: Props) {
  const fullOverall = overallMetrics(result?.full_pipeline_scores)
  const baselineOverall = overallMetrics(result?.baseline_scores)

  const matchRate = Math.max(
    0,
    Math.min(100, percent(summary.overall) ?? 0),
  )

  const outcomeData = useMemo(
    () =>
      summary.outcomes
        .filter((item) => item.count > 0)
        .map((item) => ({
          label: item.label,
          value: item.count,
          color:
            item.key === 'exception'
              ? 'var(--chart-4)'
              : item.key === 'agent_confirmed'
                ? 'var(--chart-3)'
                : 'var(--chart-1)',
        })),
    [summary.outcomes],
  )

  const comparisonData = useMemo(
    () =>
      (['accuracy', 'precision', 'recall'] as const).map((metric) => ({
        metric,
        baseline: percent(baselineOverall[metric]) ?? 0,
        arbiter: percent(fullOverall[metric]) ?? 0,
      })),
    [baselineOverall, fullOverall],
  )

  const performance = asObject(result?.performance)
  const fullPerformance = asObject(performance.full_pipeline_agent_stage)
  const baselinePerformance = asObject(performance.baseline_agent_stage)
  const latencyData = useMemo(
    () => [
      { metric: 'full pipeline', seconds: numberValue(fullPerformance.total_time_sec) ?? 0 },
      { metric: 'baseline', seconds: numberValue(baselinePerformance.total_time_sec) ?? 0 },
    ],
    [baselinePerformance, fullPerformance],
  )
  const patternData = useMemo(
    () => Object.entries(asObject(result?.full_pipeline_scores && asObject(result.full_pipeline_scores).by_pattern))
      .map(([pattern, score]) => ({ pattern: pattern.replaceAll('_', ' '), accuracy: percent(asObject(score).accuracy) ?? 0 })),
    [result],
  )
  const providerData = useMemo(
    () => Object.entries(asObject(fullPerformance.records_per_key)).map(([provider, records]) => ({ provider, records: numberValue(records) ?? 0 })),
    [fullPerformance],
  )

  return (
    <section
      className="charts-stack"
      aria-label="Reconciliation visualizations"
    >
      <div className="charts-hero-grid">
        <article className="chart-card glass">
          <div className="chart-header">
            <div>
              <span className="eyebrow">MATCH RATE</span>
              <h3>Overall reconciliation accuracy</h3>
            </div>

            <span className="chart-value">
              {matchRate.toFixed(1)}%
            </span>
          </div>

          <div
            className="gauge-wrap"
            role="img"
            aria-label={`Overall match rate ${matchRate.toFixed(1)} percent`}
          >
            <Gauge
              value={matchRate}
              centerValue={matchRate}
              totalNotches={48}
              spacing={18}
              inactiveFillOpacity={0.18}
              useGradient
            />
          </div>

          <p className="chart-caption">
            Percentage returned by the completed reconciliation result.
          </p>
        </article>

        <article className="chart-card glass">
          <div className="chart-header">
            <div>
              <span className="eyebrow">OUTCOME DISTRIBUTION</span>
              <h3>How the records resolved</h3>
            </div>

            <span className="chart-value">
              {summary.total ?? 0}
            </span>
          </div>

          {outcomeData.length > 0 ? (
            <div
              className="donut-wrap"
              role="img"
              aria-label="Outcome distribution chart"
            >
              <PieChart
                data={outcomeData}
                size={280}
                innerRadius={88}
                padAngle={0.02}
                cornerRadius={5}
              >
                {outcomeData.map((item, index) => (
                  <PieSlice
                    key={`${item.label}-${index}`}
                    index={index}
                  />
                ))}
              </PieChart>

              <div className="donut-legend">
                {outcomeData.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted">
              No outcome breakdown returned by the backend.
            </p>
          )}
        </article>
      </div>

      <article className="chart-card glass chart-wide">
        <div className="chart-header">
          <div>
            <span className="eyebrow">
              BASELINE / FULL PIPELINE
            </span>
            <h3>Where the full pipeline changes the picture</h3>
          </div>
        </div>

        <div
          className="bklit-chart"
          role="img"
          aria-label="Baseline versus Arbiter accuracy, precision and recall"
        >
          <BarChart
            data={comparisonData}
            xDataKey="metric"
          >
            <Grid horizontal />

            <Bar
              dataKey="baseline"
              fill="var(--chart-2)"
              lineCap="round"
              animate
              animationType="grow"
            />

            <Bar
              dataKey="arbiter"
              fill="var(--chart-1)"
              lineCap="round"
              animate
              animationType="grow"
              staggerDelay={0.08}
            />

            <BarXAxis />
            <ChartTooltip />
          </BarChart>
        </div>

        <div
          className="chart-legend"
          aria-label="Chart legend"
        >
          <span>
            <i className="legend-swatch baseline" />
            Baseline
          </span>

          <span>
            <i className="legend-swatch arbiter" />
            Arbiter full pipeline
          </span>
        </div>
      </article>

      <div className="charts-hero-grid">
        <article className="chart-card glass">
          <div className="chart-header"><div><span className="eyebrow">PATTERN ANALYSIS</span><h3>Accuracy by reconciliation pattern</h3></div></div>
          {patternData.length ? <div className="bklit-chart" role="img" aria-label="Full pipeline accuracy by reconciliation pattern"><BarChart data={patternData} xDataKey="pattern"><Grid horizontal /><Bar dataKey="accuracy" fill="var(--chart-1)" lineCap="round" animate animationType="grow" /><BarXAxis /><ChartTooltip /></BarChart></div> : <p className="muted">No pattern data returned by the backend.</p>}
        </article>
        <article className="chart-card glass">
          <div className="chart-header"><div><span className="eyebrow">PERFORMANCE / LATENCY</span><h3>Observed agent-stage wall clock</h3></div></div>
          <div className="bklit-chart" role="img" aria-label="Agent-stage wall-clock seconds for full pipeline and baseline"><BarChart data={latencyData} xDataKey="metric"><Grid horizontal /><Bar dataKey="seconds" fill="var(--chart-3)" lineCap="round" animate animationType="grow" /><BarXAxis /><ChartTooltip /></BarChart></div>
        </article>
      </div>

      {providerData.length > 0 && <article className="chart-card glass chart-wide">
        <div className="chart-header"><div><span className="eyebrow">PROVIDER DISTRIBUTION</span><h3>Agent records handled per provider key</h3></div></div>
        <div className="bklit-chart" role="img" aria-label="Agent records handled per provider key"><BarChart data={providerData} xDataKey="provider"><Grid horizontal /><Bar dataKey="records" fill="var(--chart-2)" lineCap="round" animate animationType="grow" /><BarXAxis /><ChartTooltip /></BarChart></div>
      </article>}
    </section>
  )
}
