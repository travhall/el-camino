/**
 * Error Recovery System
 * Provides error categorization, user-friendly messaging, and recovery guidance
 */

export type ErrorCategory = 
  | 'VALIDATION'
  | 'NETWORK' 
  | 'TIMEOUT'
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

export interface RecoveryGuidance {
  primaryAction: string;
  secondaryActions: string[];
  canRetry: boolean;
  estimatedRecoveryTime: number; // in milliseconds
}

class ErrorRecoverySystem {
  
  /**
   * Categorize an error based on its properties
   */
  categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Network-related errors
    if (message.includes('network') || 
        message.includes('fetch') || 
        message.includes('connection') ||
        message.includes('cors') ||
        stack.includes('networkError')) {
      return 'NETWORK';
    }
    
    // Timeout errors
    if (message.includes('timeout') || 
        message.includes('timed out') ||
        message.includes('request timeout')) {
      return 'TIMEOUT';
    }
    
    // Authentication errors
    if (message.includes('unauthorized') ||
        message.includes('authentication') ||
        message.includes('auth') ||
        message.includes('token') ||
        message.includes('login')) {
      return 'AUTH';
    }
    
    // Rate limiting
    if (message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('throttle') ||
        error.name === 'RateLimitError') {
      return 'RATE_LIMIT';
    }
    
    // Validation errors
    if (message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('required') ||
        message.includes('format') ||
        error.name === 'ValidationError') {
      return 'VALIDATION';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: Error): string {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'NETWORK':
        return 'Connection problem detected. Please check your internet connection.';
      
      case 'TIMEOUT':
        return 'The request took too long to complete. This might be a temporary issue.';
      
      case 'AUTH':
        return 'Authentication issue. You may need to sign in again.';
      
      case 'RATE_LIMIT':
        return 'Too many requests made recently. Please wait a moment before trying again.';
      
      case 'VALIDATION':
        return 'There was an issue with the information provided. Please check and try again.';
      
      case 'UNKNOWN':
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Get recovery guidance for an error
   */
  getRecoveryGuidance(error: Error): RecoveryGuidance {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'NETWORK':
        return {
          primaryAction: 'Check your internet connection and try again',
          secondaryActions: [
            'Refresh the page',
            'Try switching to a different network',
            'Disable VPN if active',
            'Clear browser cache and cookies'
          ],
          canRetry: true,
          estimatedRecoveryTime: 10000 // 10 seconds
        };
      
      case 'TIMEOUT':
        return {
          primaryAction: 'Wait a moment and try the request again',
          secondaryActions: [
            'Check if the server is responding',
            'Try breaking large requests into smaller ones',
            'Contact support if timeouts persist'
          ],
          canRetry: true,
          estimatedRecoveryTime: 5000 // 5 seconds
        };
      
      case 'AUTH':
        return {
          primaryAction: 'Sign in again to refresh your authentication',
          secondaryActions: [
            'Clear browser cookies and cache',
            'Check if your account is still active',
            'Reset your password if needed',
            'Contact support for account issues'
          ],
          canRetry: false,
          estimatedRecoveryTime: 0
        };
      
      case 'RATE_LIMIT':
        return {
          primaryAction: 'Wait before making more requests',
          secondaryActions: [
            'Reduce the frequency of your requests',
            'Batch multiple operations together',
            'Contact support for higher rate limits'
          ],
          canRetry: true,
          estimatedRecoveryTime: 60000 // 1 minute
        };
      
      case 'VALIDATION':
        return {
          primaryAction: 'Review and correct the information provided',
          secondaryActions: [
            'Check required fields are filled',
            'Verify data format matches requirements',
            'Remove special characters if needed',
            'Contact support for validation rules'
          ],
          canRetry: true,
          estimatedRecoveryTime: 0
        };
      
      case 'UNKNOWN':
      default:
        return {
          primaryAction: 'Try the operation again',
          secondaryActions: [
            'Refresh the page and retry',
            'Clear browser cache and cookies',
            'Try using a different browser',
            'Contact support with error details'
          ],
          canRetry: true,
          estimatedRecoveryTime: 5000 // 5 seconds
        };
    }
  }

  /**
   * Check if an error is recoverable
   */
  isRecoverable(error: Error): boolean {
    const category = this.categorizeError(error);
    return category !== 'AUTH'; // Most errors are recoverable except auth
  }

  /**
   * Get suggested retry delay for an error
   */
  getRetryDelay(error: Error): number {
    const guidance = this.getRecoveryGuidance(error);
    return guidance.estimatedRecoveryTime;
  }

  /**
   * Log error for monitoring
   */
  logError(error: Error, context: Record<string, any> = {}): void {
    const category = this.categorizeError(error);
    
    if (typeof window !== 'undefined' && 'businessMonitor' in window) {
      (window as any).businessMonitor?.trackCustomEvent('error_categorized', {
        category,
        message: error.message,
        stack: error.stack,
        context,
        timestamp: Date.now()
      });
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${category}] Error:`, error, context);
    }
  }
}

// Export singleton instance
export const errorRecovery = new ErrorRecoverySystem();
