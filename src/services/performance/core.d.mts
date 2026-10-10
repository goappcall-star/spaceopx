export const METRICS: Readonly<Record<string, string>>;
export const BOUNDS: readonly number[];
export const MAX_ROWS: number;
export const RETENTION: number;
export interface MetricRow {
  minute: number;
  metric: string;
  platform: string;
  mode: string;
  version: string;
  count: number;
  errors: number;
  sum: number;
  max: number;
  histogram: number[];
}
export class MetricStore {
  enabled: boolean;
  rows: Map<string, MetricRow>;
  constructor(clock?: () => number);
  record(
    metric: string,
    value: number,
    failed?: boolean,
    labels?: { platform?: string; mode?: string; version?: string },
  ): void;
  prune(): void;
  snapshot(): MetricRow[];
  clear(): void;
  restore(input: unknown): void;
}
export function percentile(histogram: number[], percent: number): number | null;
export function aggregate(rows: MetricRow[]): (Omit<
  MetricRow,
  "minute" | "platform" | "mode" | "version"
> & {
  mean: number;
  p50: number | null;
  p95: number | null;
  errorRate: number;
})[];
export class AlertEvaluator {
  recent: Map<string, number>;
  evaluate(
    rows: MetricRow[],
    limits: Record<string, number>,
    now?: number,
  ): { metric: string; p95: number | null; errorRate: number; time: number }[];
}
