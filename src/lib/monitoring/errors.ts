/**
 * Error tracking and monitoring for Phase 1 infrastructure
 */

interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  line?: number;
  column?: number;
  timestamp: number;
  userAgent: string;
  userId?: string;
}

class ErrorMonitor {
  private errorQueue: ErrorReport[] = [];
  private rateLimitCount = 0;
  private rateLimitWindow = 60000; // 1 minute

  init() {
    if (typeof window === 'undefined') return;

    // Global error handler
    window.addEventListener('error', this.handleError.bind(this));
    window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));

    // Periodic flush
    setInterval(() => this.flush(), 30000);
  }

  private handleError(event: ErrorEvent) {
    if (this.shouldIgnoreError(event.message)) return;

    const report: ErrorReport = {
      message: event.message,
      stack: event.error?.stack,
      url: event.filename || window.location.href,
      line: event.lineno,
      column: event.colno,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    this.reportError(report);
  }

  private handlePromiseRejection(event: PromiseRejectionEvent) {
    const report: ErrorReport = {
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    this.reportError(report);
  }

  private shouldIgnoreError(message: string): boolean {
    const ignorePatterns = [
      'Script error',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured'
    ];
    return ignorePatterns.some(pattern => message.includes(pattern));
  }

  private reportError(report: ErrorReport) {
    if (this.rateLimitCount > 10) return;
    this.rateLimitCount++;
    
    this.errorQueue.push(report);
    
    // Critical errors send immediately
    if (report.message.includes('CRITICAL') || this.errorQueue.length > 5) {
      this.flush();
    }
  }

  private flush() {
    if (this.errorQueue.length === 0) return;

    const payload = JSON.stringify({
      errors: this.errorQueue.splice(0, 10),
      page: window.location.pathname
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/errors', payload);
    }

    // Reset rate limit
    setTimeout(() => { this.rateLimitCount = 0; }, this.rateLimitWindow);
  }

  // Manual error reporting
  reportCustomError(message: string, context?: any) {
    const report: ErrorReport = {
      message: `CUSTOM: ${message}`,
      stack: new Error().stack,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    if (context) {
      (report as any).context = context;
    }

    this.reportError(report);
  }
}

export const errorMonitor = new ErrorMonitor();

if (typeof window !== 'undefined') {
  errorMonitor.init();
}
