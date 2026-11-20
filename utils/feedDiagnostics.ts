/**
 * Feed observability breadcrumbs (plan O7).
 *
 * One plain console.log per feed lifecycle event, prefixed `[feed]` so Metro
 * logs can be grepped for the whole feed story: skip loops, sentinel arms,
 * probe verdicts, cycle restarts. Deliberately dependency-free and
 * side-effect-free — detail payloads are plain objects/strings, no awaits,
 * no state. These two events alone (broken-batch-skip/terminal + probe-verdict)
 * would have made the 2026-11-17 dead-row incidents diagnosable from Metro
 * logs alone.
 *
 * @param {FeedEventName} event - One of the instrumented dotted kebab event
 *   names (compile-time typo safety; e.g. 'broken-batch-skip').
 * @param {Record<string, unknown>|string|number|boolean|null} [detail] - Plain
 *   context payload (cursors, counts, statuses).
 */
export type FeedEventName =
  | 'sentinel-armed'
  | 'played-skip'
  | 'broken-batch-skip'
  | 'played-out-bound'
  | 'played-out-reclassified'
  | 'broken-batch-terminal'
  | 'deck-trim-to-zero'
  | 'sentinel-short-circuit'
  | 'probe-verdict'
  | 'cycle-restart'
  | 'probe-error-degraded'
  | 'mount-sentinel-arm';

type FeedEventDetail = Record<string, unknown> | string | number | boolean | null;

export function logFeedEvent(event: FeedEventName, detail?: FeedEventDetail): void {
  console.log('[feed]', event, detail ?? '');
}
