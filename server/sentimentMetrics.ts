/**
 * Volatile in-memory rolling counters for anonymous session sentiment health tracking.
 *
 * Tracks platform health over time without logging user identity, IPs, or session tokens.
 */

export type SentimentRating = 'peaceful' | 'neutral' | 'disruptive';

interface SentimentEntry {
  rating: SentimentRating;
  timestamp: number;
}

interface SentimentCounters {
  peaceful: number;
  neutral: number;
  disruptive: number;
  total: number;
  recentHistory: SentimentEntry[];
}

const MAX_HISTORY_ENTRIES = 1000;

class SentimentMetricsTracker {
  private counters: SentimentCounters = {
    peaceful: 0,
    neutral: 0,
    disruptive: 0,
    total: 0,
    recentHistory: [],
  };

  /**
   * Records an anonymous sentiment rating into rolling in-memory counters.
   * Does not store any user identifier or correlation metadata.
   */
  public recordRating(rawRating: unknown): boolean {
    if (typeof rawRating !== 'string') return false;

    const normalized = rawRating.toLowerCase().trim() as SentimentRating;
    if (normalized !== 'peaceful' && normalized !== 'neutral' && normalized !== 'disruptive') {
      return false;
    }

    this.counters[normalized]++;
    this.counters.total++;

    this.counters.recentHistory.push({
      rating: normalized,
      timestamp: Date.now(),
    });

    if (this.counters.recentHistory.length > MAX_HISTORY_ENTRIES) {
      this.counters.recentHistory.shift();
    }

    return true;
  }

  /**
   * Retrieves aggregate platform sentiment counters.
   */
  public getStats() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const past24hEntries = this.counters.recentHistory.filter((entry) => entry.timestamp >= oneDayAgo);

    const past24h = {
      peaceful: past24hEntries.filter((e) => e.rating === 'peaceful').length,
      neutral: past24hEntries.filter((e) => e.rating === 'neutral').length,
      disruptive: past24hEntries.filter((e) => e.rating === 'disruptive').length,
      total: past24hEntries.length,
    };

    return {
      allTime: {
        peaceful: this.counters.peaceful,
        neutral: this.counters.neutral,
        disruptive: this.counters.disruptive,
        total: this.counters.total,
      },
      past24h,
    };
  }
}

export const sentimentTracker = new SentimentMetricsTracker();
