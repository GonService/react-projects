/**
 * PromQL used when VITE_PROMETHEUS_URL is set. Adjust the metric and label names to match your
 * instrumentation; the defaults follow the common http_requests_total / histogram convention with
 * a `service` label.
 */
export const OVERVIEW_QUERIES = {
  rps: "sum(rate(http_requests_total[5m]))",
  errorRate: '100 * sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
  p50: "1000 * histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
  p95: "1000 * histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
  p99: "1000 * histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
  cpu: '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))',
} as const;

export const SERVICE_LABEL = "service";

export const SERVICE_QUERIES = {
  rps: `sum by (${SERVICE_LABEL}) (rate(http_requests_total[5m]))`,
  errorRate: `100 * sum by (${SERVICE_LABEL}) (rate(http_requests_total{status=~"5.."}[5m])) / sum by (${SERVICE_LABEL}) (rate(http_requests_total[5m]))`,
  p95: `1000 * histogram_quantile(0.95, sum by (le, ${SERVICE_LABEL}) (rate(http_request_duration_seconds_bucket[5m])))`,
  cpu: `100 * sum by (${SERVICE_LABEL}) (rate(process_cpu_seconds_total[5m]))`,
} as const;
