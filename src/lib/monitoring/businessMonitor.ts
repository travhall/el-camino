/**
 * Performance Monitoring Integration - Phase 1 Critical Foundation
 * Connects existing PerformanceManager to business metrics and alerting
 */

import PerformanceManager, { type PerformanceData } from '../performance/PerformanceManager';
import { errorRecovery, type ErrorCategory } from './errorRecovery';

export interface BusinessMetrics {
  conversionRate: number;
  cartAbandonmentRate: number;
  avgTimeToAddCart: number;
  checkoutCompletionRate: number;
  errorRate: number;
  apiResponseTimes: Record<string, number>;
}

export interface PerformanceBudget {
  lcp: number;      // Largest Contentful Paint
  fcp: number;      // First Contentful Paint  
  cls: number;      // Cumulative Layout Shift
  inp: number;      // Interaction to Next Paint
  ttfb: number;     // Time to First Byte
}

class BusinessPerformanceMonitor {
  private performanceManager: PerformanceManager;
  private businessMetrics: BusinessMetrics;
  private budgets: PerformanceBudget = {
    lcp: 2500,   // 2.5s
    fcp: 1800,   // 1.8s  
    cls: 0.1,    // 0.1
    inp: 200,    // 200ms
    ttfb: 800    // 800ms
  };

  constructor() {
    this.performanceManager = new PerformanceManager();
    this.businessMetrics = this.initializeBusinessMetrics();
    this.initializeMonitoring();
  }

  private initializeBusinessMetrics(): BusinessMetrics {
    return {
      conversionRate: 0,
      cartAbandonmentRate: 0,
      avgTimeToAddCart: 0,
      checkoutCompletionRate: 0,
      errorRate: 0,
      apiResponseTimes: {}
    };
  }

  private initializeMonitoring() {
    if (typeof window === 'undefined') return;

    // Track business events
    this.trackConversionEvents();
    this.trackAPIPerformance();
    this.performBudgetValidation();
    
    // Send metrics periodically
    setInterval(() => this.reportMetrics(), 30000);
  }

  trackConversionEvents() {
    // Add to cart tracking
    window.addEventListener('cart:item:added', (event: any) => {
      const addTime = event.detail?.addTime || performance.now();
      this.updateAvgTimeToAddCart(addTime);
    });

    // Checkout tracking
    window.addEventListener('checkout:started', () => {
      this.trackCheckoutFunnel('started');
    });

    window.addEventListener('checkout:completed', () => {
      this.trackCheckoutFunnel('completed');
      this.updateConversionRate();
    });

    // Cart abandonment
    window.addEventListener('beforeunload', () => {
      if (this.hasItemsInCart() && !this.hasStartedCheckout()) {
        this.trackCartAbandonment();
      }
    });
  }

  trackAPIPerformance() {
    // Override fetch to track API calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0].toString();
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        
        this.recordAPIResponse(url, endTime - startTime, response.ok);
        return response;
      } catch (error) {
        const endTime = performance.now();
        this.recordAPIResponse(url, endTime - startTime, false);
        throw error;
      }
    };
  }

  performBudgetValidation() {
    const metrics = this.performanceManager.getAllMetrics();
    const violations = this.checkBudgetViolations(metrics);
    if (violations.length > 0) {
      this.handleBudgetViolations(violations);
    }
  }

  private checkBudgetViolations(metrics: PerformanceData): string[] {
    const violations: string[] = [];
    const vitals = metrics.coreWebVitals;

    if (vitals.lcp && vitals.lcp > this.budgets.lcp) {
      violations.push(`LCP: ${vitals.lcp}ms > ${this.budgets.lcp}ms`);
    }
    if (vitals.fcp && vitals.fcp > this.budgets.fcp) {
      violations.push(`FCP: ${vitals.fcp}ms > ${this.budgets.fcp}ms`);
    }
    if (vitals.cls && vitals.cls > this.budgets.cls) {
      violations.push(`CLS: ${vitals.cls} > ${this.budgets.cls}`);
    }
    if (vitals.inp && vitals.inp > this.budgets.inp) {
      violations.push(`INP: ${vitals.inp}ms > ${this.budgets.inp}ms`);
    }
    if (vitals.ttfb && vitals.ttfb > this.budgets.ttfb) {
      violations.push(`TTFB: ${vitals.ttfb}ms > ${this.budgets.ttfb}ms`);
    }

    return violations;
  }

  private handleBudgetViolations(violations: string[]) {
    console.warn('Performance budget violations:', violations);
    
    // Report to monitoring service
    this.reportAlert('PERFORMANCE_BUDGET_VIOLATION', {
      violations,
      timestamp: Date.now(),
      url: window.location.href
    });
  }

  private updateAvgTimeToAddCart(addTime: number) {
    const currentAvg = this.businessMetrics.avgTimeToAddCart;
    const newAvg = currentAvg === 0 ? addTime : (currentAvg + addTime) / 2;
    this.businessMetrics.avgTimeToAddCart = newAvg;
  }

  private trackCheckoutFunnel(stage: 'started' | 'completed') {
    const key = `checkout_${stage}`;
    const current = parseInt(localStorage.getItem(key) || '0');
    localStorage.setItem(key, (current + 1).toString());
  }

  private updateConversionRate() {
    const checkoutStarted = parseInt(localStorage.getItem('checkout_started') || '0');
    const checkoutCompleted = parseInt(localStorage.getItem('checkout_completed') || '0');
    
    if (checkoutStarted > 0) {
      this.businessMetrics.conversionRate = checkoutCompleted / checkoutStarted;
    }
  }

  private trackCartAbandonment() {
    const abandonments = parseInt(localStorage.getItem('cart_abandonments') || '0');
    localStorage.setItem('cart_abandonments', (abandonments + 1).toString());
    
    const cartAdditions = parseInt(localStorage.getItem('cart_additions') || '0');
    if (cartAdditions > 0) {
      this.businessMetrics.cartAbandonmentRate = abandonments / cartAdditions;
    }
  }

  private hasItemsInCart(): boolean {
    const cartData = localStorage.getItem('cart');
    if (!cartData) return false;
    
    try {
      const cart = JSON.parse(cartData);
      return cart.itemCount > 0;
    } catch {
      return false;
    }
  }

  private hasStartedCheckout(): boolean {
    return sessionStorage.getItem('checkout_started') === 'true';
  }

  private recordAPIResponse(url: string, responseTime: number, success: boolean) {
    // Update API response times
    const apiKey = this.getAPIKey(url);
    this.businessMetrics.apiResponseTimes[apiKey] = responseTime;
    
    // Update error rate
    if (!success) {
      this.incrementErrorRate();
    }
  }

  private getAPIKey(url: string): string {
    if (url.includes('/catalog/')) return 'catalog';
    if (url.includes('/inventory/')) return 'inventory';
    if (url.includes('/orders/')) return 'orders';
    return 'other';
  }

  private incrementErrorRate() {
    const totalRequests = parseInt(localStorage.getItem('total_api_requests') || '0') + 1;
    const totalErrors = parseInt(localStorage.getItem('total_api_errors') || '0') + 1;
    
    localStorage.setItem('total_api_requests', totalRequests.toString());
    localStorage.setItem('total_api_errors', totalErrors.toString());
    
    this.businessMetrics.errorRate = totalErrors / totalRequests;
  }

  private async reportMetrics() {
    const performanceData = await this.performanceManager.getAllMetrics();
    
    const report = {
      timestamp: Date.now(),
      url: window.location.href,
      performance: performanceData,
      business: this.businessMetrics,
      budgetViolations: this.checkBudgetViolations(performanceData)
    };

    // Send to monitoring endpoint (placeholder)
    this.sendToMonitoring(report);
  }

  private reportAlert(type: string, data: any) {
    const alert = {
      type,
      timestamp: Date.now(),
      data,
      severity: this.getAlertSeverity(type)
    };

    // Send immediate alert
    this.sendToMonitoring(alert, true);
  }

  private getAlertSeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'PERFORMANCE_BUDGET_VIOLATION': 'medium',
      'API_ERROR_SPIKE': 'high',
      'CONVERSION_DROP': 'critical',
      'CART_ABANDONMENT_SPIKE': 'high'
    };
    
    return severityMap[type] || 'low';
  }

  private sendToMonitoring(data: any, isAlert = false) {
    // In production, this would send to a monitoring service like DataDog, New Relic, etc.
    if (process.env.NODE_ENV === 'development') {
      console.log(isAlert ? '🚨 Performance Alert:' : '📊 Performance Metrics:', data);
    } else {
      // Production monitoring endpoint
      fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(error => {
        console.error('Failed to send monitoring data:', error);
      });
    }
  }

  // Public methods for manual tracking
  trackCustomEvent(event: string, data: any) {
    this.reportAlert('CUSTOM_EVENT', { event, data });
  }

  getBusinessMetrics(): BusinessMetrics {
    return { ...this.businessMetrics };
  }

  updateBudgets(newBudgets: Partial<PerformanceBudget>) {
    this.budgets = { ...this.budgets, ...newBudgets };
  }
}

// Export singleton instance
export const businessMonitor = new BusinessPerformanceMonitor();
