/**
 * Enhanced Performance Budget Manager
 * Handles performance budget monitoring and alerting
 * File: src/lib/performance/BudgetManager.ts
 */

interface CacheMetricEntry {
  type: string;
  hit: boolean;
  responseTime: number;
  timestamp: number;
  url: string;
}

export interface BudgetRule {
  id: string;
  metric: string;
  threshold: number;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  description: string;
  category: "performance" | "resource" | "business";
}

export interface BudgetViolation {
  id: string;
  ruleId: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: "info" | "warning" | "critical";
  timestamp: number;
  resolved: boolean;
  description: string;
}

export class BudgetManager {
  private rules: Map<string, BudgetRule> = new Map();
  private violations: BudgetViolation[] = [];
  private listeners: ((violation: BudgetViolation) => void)[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const defaultRules: BudgetRule[] = [
      {
        id: "lcp-critical",
        metric: "lcp",
        threshold: 2500,
        severity: "critical",
        enabled: true,
        description: "LCP exceeds 2.5 seconds",
        category: "performance",
      },
      {
        id: "inp-critical",
        metric: "inp",
        threshold: 200,
        severity: "critical",
        enabled: true,
        description: "INP exceeds 200ms",
        category: "performance",
      },
      {
        id: "cls-warning",
        metric: "cls",
        threshold: 0.1,
        severity: "warning",
        enabled: true,
        description: "CLS exceeds 0.1",
        category: "performance",
      },
      {
        id: "bundle-size-warning",
        metric: "bundleSize",
        threshold: 200000, // 200KB
        severity: "warning",
        enabled: true,
        description: "Bundle size exceeds 200KB",
        category: "resource",
      },
      {
        id: "cache-hit-rate-warning",
        metric: "cacheHitRate",
        threshold: 0.3, // 30% minimum hit rate
        severity: "warning",
        enabled: true,
        description: "Cache hit rate below 30%",
        category: "performance",
      },
      {
        id: "api-response-slow",
        metric: "apiResponseTime",
        threshold: 1000, // 1 second
        severity: "warning",
        enabled: true,
        description: "API response time exceeds 1 second",
        category: "performance",
      },
    ];

    defaultRules.forEach((rule) => this.rules.set(rule.id, rule));
  }

  public checkMetric(metric: string, value: number): BudgetViolation | null {
    for (const rule of this.rules.values()) {
      if (rule.metric === metric && rule.enabled && value > rule.threshold) {
        const violation: BudgetViolation = {
          id: `${rule.id}-${Date.now()}`,
          ruleId: rule.id,
          metric,
          currentValue: value,
          threshold: rule.threshold,
          severity: rule.severity,
          timestamp: Date.now(),
          resolved: false,
          description: rule.description,
        };

        this.violations.push(violation);
        this.notifyListeners(violation);
        return violation;
      }
    }
    return null;
  }

  public addRule(rule: BudgetRule): void {
    this.rules.set(rule.id, rule);
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  public getViolations(unresolved = true): BudgetViolation[] {
    return this.violations.filter((v) => (unresolved ? !v.resolved : true));
  }

  public resolveViolation(violationId: string): void {
    const violation = this.violations.find((v) => v.id === violationId);
    if (violation) {
      violation.resolved = true;
    }
  }

  public onViolation(callback: (violation: BudgetViolation) => void): void {
    this.listeners.push(callback);
  }

  private notifyListeners(violation: BudgetViolation): void {
    this.listeners.forEach((callback) => callback(violation));
  }

  public getHealthScore(): { score: number; issues: string[] } {
    const criticalViolations = this.getViolations().filter(
      (v) => v.severity === "critical"
    );
    const warningViolations = this.getViolations().filter(
      (v) => v.severity === "warning"
    );

    let score = 100;
    score -= criticalViolations.length * 25;
    score -= warningViolations.length * 10;

    const issues = this.getViolations().map((v) => v.description);

    return {
      score: Math.max(0, score),
      issues,
    };
  }

  /**
   * Check cache effectiveness and create violations if performance is poor
   */
  public checkCacheEffectiveness(): void {
    if (typeof window === "undefined") return;

    try {
      const metrics: CacheMetricEntry[] = JSON.parse(
        localStorage.getItem("cacheMetrics") || "[]"
      );
      const recent = metrics.filter(
        (m: CacheMetricEntry) => Date.now() - m.timestamp < 300000
      ); // Last 5 minutes

      if (recent.length > 10) {
        const hitRate =
          recent.filter((m: CacheMetricEntry) => m.hit).length / recent.length;
        const avgResponseTime =
          recent.reduce(
            (sum: number, m: CacheMetricEntry) => sum + m.responseTime,
            0
          ) / recent.length;

        // Check cache hit rate
        this.checkMetric("cacheHitRate", 1 - hitRate); // Invert so threshold works correctly

        // Check API response time
        this.checkMetric("apiResponseTime", avgResponseTime);

        // Log cache performance summary
        console.log(
          `[CacheMonitor] Hit Rate: ${(hitRate * 100).toFixed(
            1
          )}% | Avg Response: ${avgResponseTime.toFixed(0)}ms | Samples: ${
            recent.length
          }`
        );

        // Alert on concerning trends
        if (hitRate < 0.3) {
          console.warn(
            `[CacheAlert] Low cache hit rate: ${(hitRate * 100).toFixed(1)}%`
          );
        }

        if (avgResponseTime > 1000) {
          console.warn(
            `[CacheAlert] Slow API responses: ${avgResponseTime.toFixed(
              0
            )}ms average`
          );
        }
      }
    } catch (error) {
      console.warn(
        "[CacheMonitor] Failed to check cache effectiveness:",
        error
      );
    }
  }
}

export const budgetManager = new BudgetManager();
