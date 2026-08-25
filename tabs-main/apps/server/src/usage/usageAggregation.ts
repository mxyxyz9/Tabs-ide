import type { UsageBucket } from "@tabs/contracts";
import { type RateTable } from "./usagePricing.ts";
import { type UsageRecord } from "./usageTranscripts.ts";

export function makeDayFormatter(timeZone: string): (timestampMs: number) => string {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  return (timestampMs) => format.format(new Date(timestampMs));
}

interface MutableBucket {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  estimatedCostUsd: number;
  pricedTokens: number;
  unpricedTokens: number;
  hasCustomPrice: boolean;
  sessions: Set<string>;
  turnCount: number;
}

export interface AggregateOptions {
  readonly timeZone: string;
  readonly sinceDay: string;
  readonly untilDay: string;
  readonly rates: RateTable;
  readonly sinceTimeMs?: number;
  readonly untilTimeMs?: number;
}

export interface AggregateResult {
  readonly buckets: readonly UsageBucket[];
}

export class UsageAggregator {
  private readonly formatDay: (timestampMs: number) => string;
  private readonly sinceDay: string;
  private readonly untilDay: string;
  private readonly rates: RateTable;
  private readonly buckets = new Map<string, MutableBucket>();

  constructor(options: AggregateOptions) {
    this.formatDay = makeDayFormatter(options.timeZone);
    this.sinceDay = options.sinceDay;
    this.untilDay = options.untilDay;
    this.rates = options.rates;
  }

  add(record: UsageRecord): boolean {
    const day = this.formatDay(record.timestampMs);
    if (day < this.sinceDay || day > this.untilDay) {
      return false;
    }

    const key = `${day}:${record.provider}:${record.model}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        estimatedCostUsd: 0,
        pricedTokens: 0,
        unpricedTokens: 0,
        hasCustomPrice: false,
        sessions: new Set<string>(),
        turnCount: 0,
      };
      this.buckets.set(key, bucket);
    }

    const inputTokens = record.totals.uncachedInputTokens + record.totals.cachedInputTokens;
    const outputTokens = record.totals.outputTokens;
    const reasoningTokens = record.totals.reasoningTokens;
    const cachedInputTokens = record.totals.cachedInputTokens;

    bucket.inputTokens += inputTokens;
    bucket.outputTokens += outputTokens;
    bucket.reasoningTokens += reasoningTokens;
    bucket.cachedInputTokens += cachedInputTokens;
    bucket.turnCount += 1;
    if (record.sessionId) {
      bucket.sessions.add(record.sessionId);
    }

    // Rate calculation
    const rate = this.rates.get(record.model) ?? this.rates.get(record.model.toLowerCase());
    if (rate) {
      const inputCost = (inputTokens / 1_000_000) * rate.inputCostPerMillion;
      const outputCost = (outputTokens / 1_000_000) * rate.outputCostPerMillion;
      bucket.estimatedCostUsd += inputCost + outputCost;
      bucket.pricedTokens += inputTokens + outputTokens;
    } else {
      // Default fallback estimate ($3/M input, $15/M output)
      const inputCost = (inputTokens / 1_000_000) * 3.0;
      const outputCost = (outputTokens / 1_000_000) * 15.0;
      bucket.estimatedCostUsd += inputCost + outputCost;
      bucket.unpricedTokens += inputTokens + outputTokens;
    }

    return true;
  }

  finish(): AggregateResult {
    const buckets: UsageBucket[] = [];
    for (const [key, data] of this.buckets.entries()) {
      const [day, provider, ...modelParts] = key.split(":");
      const model = modelParts.join(":");
      buckets.push({
        day: day!,
        provider: provider!,
        model: model!,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        reasoningTokens: data.reasoningTokens,
        cachedInputTokens: data.cachedInputTokens,
        estimatedCostUsd: Number(data.estimatedCostUsd.toFixed(4)),
        pricedTokens: data.pricedTokens,
        unpricedTokens: data.unpricedTokens,
        hasCustomPrice: data.hasCustomPrice,
        sessionCount: data.sessions.size,
        turnCount: data.turnCount,
      });
    }

    return {
      buckets,
    };
  }
}
