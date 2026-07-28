"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMetrics = exports.observeMetric = exports.incrementMetric = void 0;
const counters = new Map();
const histograms = new Map();
const startedAt = Date.now();
const normalizeLabelValue = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const labelSuffix = (labels) => {
    const entries = Object.entries(labels || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length)
        return '';
    return `{${entries.map(([key, value]) => `${key}="${normalizeLabelValue(value)}"`).join(',')}}`;
};
const keyFor = (name, labels) => `${name}${labelSuffix(labels)}`;
const incrementMetric = (name, labels, amount = 1) => {
    const key = keyFor(name, labels);
    counters.set(key, (counters.get(key) || 0) + amount);
};
exports.incrementMetric = incrementMetric;
const observeMetric = (name, value, labels) => {
    const key = keyFor(name, labels);
    const values = histograms.get(key) || [];
    values.push(value);
    if (values.length > 1000)
        values.splice(0, values.length - 1000);
    histograms.set(key, values);
};
exports.observeMetric = observeMetric;
const percentile = (values, percentage) => {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1);
    return sorted[index] || 0;
};
const renderMetrics = () => {
    const lines = [
        '# HELP padi_process_uptime_seconds Process uptime in seconds.',
        '# TYPE padi_process_uptime_seconds gauge',
        `padi_process_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
    ];
    for (const [key, value] of counters.entries()) {
        lines.push(`${key} ${value}`);
    }
    for (const [key, values] of histograms.entries()) {
        const sum = values.reduce((total, value) => total + value, 0);
        lines.push(`${key}_count ${values.length}`);
        lines.push(`${key}_sum ${Math.round(sum)}`);
        lines.push(`${key}_p50 ${Math.round(percentile(values, 50))}`);
        lines.push(`${key}_p95 ${Math.round(percentile(values, 95))}`);
        lines.push(`${key}_p99 ${Math.round(percentile(values, 99))}`);
    }
    return `${lines.join('\n')}\n`;
};
exports.renderMetrics = renderMetrics;
//# sourceMappingURL=metrics.service.js.map