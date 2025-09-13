/**
 * User-Friendly Error Communication - Phase 2 UX Enhancement
 * Progressive disclosure of technical details with recovery guidance
 */

import { errorRecovery, type ErrorCategory, type RecoveryGuidance } from '../monitoring/errorRecovery';

export interface UserErrorConfig {
  showTechnicalDetails: boolean;
  enableProgressiveDisclosure: boolean;
  showRecoveryActions: boolean;
  trackErrorInteractions: boolean;
}

export interface ErrorDisplayOptions {
  type: 'inline' | 'modal' | 'toast' | 'banner';
  dismissible: boolean;
  autoHide?: number;
  showIcon?: boolean;
  showActions?: boolean;
}

class UserErrorCommunicationSystem {
  private config: UserErrorConfig = {
    showTechnicalDetails: false,
    enableProgressiveDisclosure: true,
    showRecoveryActions: true,
    trackErrorInteractions: true
  };

  private activeErrors = new Map<string, ErrorDisplay>();

  constructor() {
    this.injectStyles();
    this.initializeErrorTracking();
  }

  // Main error display methods
  showUserFriendlyError(
    error: Error,
    container: HTMLElement,
    options: Partial<ErrorDisplayOptions> = {}
  ): string {
    const category = errorRecovery.categorizeError(error);
    const userMessage = errorRecovery.getUserFriendlyMessage(error);
    const guidance = errorRecovery.getRecoveryGuidance(error);
    
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const displayOptions: ErrorDisplayOptions = {
      type: 'inline',
      dismissible: true,
      showIcon: true,
      showActions: true,
      ...options
    };

    const errorDisplay = this.createErrorDisplay(
      errorId,
      category,
      userMessage,
      error.message,
      guidance,
      displayOptions
    );

    this.renderErrorDisplay(container, errorDisplay, displayOptions);
    this.activeErrors.set(errorId, errorDisplay);

    if (this.config.trackErrorInteractions) {
      this.trackErrorShown(category, userMessage);
    }

    return errorId;
  }

  showCartError(error: Error, cartContainer: HTMLElement): string {
    return this.showUserFriendlyError(error, cartContainer, {
      type: 'inline',
      dismissible: true,
      showActions: true,
      autoHide: 5000
    });
  }

  showInventoryError(error: Error, productContainer: HTMLElement): string {
    return this.showUserFriendlyError(error, productContainer, {
      type: 'banner',
      dismissible: true,
      showActions: true
    });
  }

  showPaymentError(error: Error): string {
    const modalContainer = this.createModalContainer();
    return this.showUserFriendlyError(error, modalContainer, {
      type: 'modal',
      dismissible: false,
      showActions: true
    });
  }

  showNetworkError(error: Error): string {
    const toastContainer = this.getOrCreateToastContainer();
    return this.showUserFriendlyError(error, toastContainer, {
      type: 'toast',
      dismissible: true,
      autoHide: 8000,
      showActions: true
    });
  }

  // Error display creation and management
  private createErrorDisplay(
    errorId: string,
    category: ErrorCategory,
    userMessage: string,
    technicalMessage: string,
    guidance: RecoveryGuidance,
    options: ErrorDisplayOptions
  ): ErrorDisplay {
    return {
      id: errorId,
      category,
      userMessage,
      technicalMessage,
      guidance,
      options,
      element: null,
      isExpanded: false,
      createdAt: Date.now()
    };
  }

  private renderErrorDisplay(
    container: HTMLElement,
    errorDisplay: ErrorDisplay,
    options: ErrorDisplayOptions
  ) {
    const element = document.createElement('div');
    element.className = `error-display error-${options.type} error-${errorDisplay.category.toLowerCase()}`;
    element.setAttribute('data-error-id', errorDisplay.id);
    
    const icon = this.getErrorIcon(errorDisplay.category);
    const severity = this.getErrorSeverity(errorDisplay.category);
    
    element.innerHTML = `
      <div class="error-content">
        ${options.showIcon ? `<div class="error-icon">${icon}</div>` : ''}
        
        <div class="error-message-container">
          <div class="error-main-message">
            <span class="error-severity-badge ${severity}">${this.getSeverityLabel(severity)}</span>
            <span class="error-user-message">${errorDisplay.userMessage}</span>
          </div>
          
          ${this.config.enableProgressiveDisclosure ? this.createProgressiveDisclosure(errorDisplay) : ''}
        </div>

        <div class="error-actions">
          ${options.showActions ? this.createRecoveryActions(errorDisplay) : ''}
          ${options.dismissible ? '<button class="error-dismiss" aria-label="Dismiss error">×</button>' : ''}
        </div>
      </div>
      
      ${options.autoHide ? `<div class="error-auto-hide-progress" style="animation: countdown ${options.autoHide}ms linear forwards;"></div>` : ''}
    `;

    this.attachEventListeners(element, errorDisplay);
    errorDisplay.element = element;

    // Insert based on display type
    switch (options.type) {
      case 'modal':
        this.showAsModal(container, element);
        break;
      case 'toast':
        container.appendChild(element);
        this.animateIn(element, 'slide-in-right');
        break;
      case 'banner':
        container.insertBefore(element, container.firstChild);
        this.animateIn(element, 'slide-down');
        break;
      default: // inline
        container.appendChild(element);
        this.animateIn(element, 'fade-in');
        break;
    }

    // Auto-hide if specified
    if (options.autoHide) {
      setTimeout(() => {
        this.dismissError(errorDisplay.id);
      }, options.autoHide);
    }
  }

  private createProgressiveDisclosure(errorDisplay: ErrorDisplay): string {
    return `
      <div class="error-progressive-disclosure">
        <button class="error-details-toggle" data-error-id="${errorDisplay.id}">
          <span class="toggle-text">Show details</span>
          <span class="toggle-icon">▼</span>
        </button>
        
        <div class="error-technical-details" style="display: none;">
          <div class="technical-message">
            <strong>Technical details:</strong>
            <code>${errorDisplay.technicalMessage}</code>
          </div>
          
          <div class="error-guidance">
            <strong>What you can do:</strong>
            <ol class="guidance-steps">
              <li>${errorDisplay.guidance.primaryAction}</li>
              ${errorDisplay.guidance.secondaryActions.map((action: string) => `<li>${action}</li>`).join('')}
            </ol>
          </div>
          
          ${errorDisplay.guidance.estimatedRecoveryTime > 0 ? `
            <div class="recovery-time">
              <strong>Estimated recovery time:</strong> 
              ${this.formatRecoveryTime(errorDisplay.guidance.estimatedRecoveryTime)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private createRecoveryActions(errorDisplay: ErrorDisplay): string {
    const actions = [];

    if (errorDisplay.guidance.canRetry) {
      actions.push(`
        <button class="error-action error-retry" data-error-id="${errorDisplay.id}">
          Retry
        </button>
      `);
    }

    // Category-specific actions
    switch (errorDisplay.category) {
      case 'NETWORK':
        actions.push(`
          <button class="error-action error-refresh" onclick="window.location.reload()">
            Refresh Page
          </button>
        `);
        break;
      
      case 'VALIDATION':
        actions.push(`
          <button class="error-action error-help" data-error-id="${errorDisplay.id}">
            Get Help
          </button>
        `);
        break;
      
      case 'RATE_LIMIT':
        if (errorDisplay.guidance.estimatedRecoveryTime > 0) {
          actions.push(`
            <button class="error-action error-wait" data-error-id="${errorDisplay.id}" disabled>
              Wait ${this.formatRecoveryTime(errorDisplay.guidance.estimatedRecoveryTime)}
            </button>
          `);
        }
        break;
    }

    return actions.join('');
  }

  private attachEventListeners(element: HTMLElement, errorDisplay: ErrorDisplay) {
    // Dismiss button
    const dismissBtn = element.querySelector('.error-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.dismissError(errorDisplay.id);
      });
    }

    // Progressive disclosure toggle
    const detailsToggle = element.querySelector('.error-details-toggle');
    if (detailsToggle) {
      detailsToggle.addEventListener('click', () => {
        this.toggleErrorDetails(errorDisplay.id);
      });
    }

    // Retry action
    const retryBtn = element.querySelector('.error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.handleRetryAction(errorDisplay);
      });
    }

    // Help action
    const helpBtn = element.querySelector('.error-help');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.showHelpModal(errorDisplay);
      });
    }

    // Wait action with countdown
    const waitBtn = element.querySelector('.error-wait');
    if (waitBtn && errorDisplay.guidance.estimatedRecoveryTime > 0) {
      this.startCountdown(waitBtn as HTMLButtonElement, errorDisplay.guidance.estimatedRecoveryTime);
    }
  }

  // Action handlers
  private handleRetryAction(errorDisplay: ErrorDisplay) {
    if (this.config.trackErrorInteractions) {
      this.trackErrorAction(errorDisplay.category, 'retry');
    }

    // Dispatch retry event that components can listen for
    const retryEvent = new CustomEvent('error:retry', {
      detail: {
        errorId: errorDisplay.id,
        category: errorDisplay.category,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(retryEvent);

    this.dismissError(errorDisplay.id);
  }

  private toggleErrorDetails(errorId: string) {
    const errorDisplay = this.activeErrors.get(errorId);
    if (!errorDisplay || !errorDisplay.element) return;

    const detailsContainer = errorDisplay.element.querySelector('.error-technical-details') as HTMLElement;
    const toggleButton = errorDisplay.element.querySelector('.error-details-toggle');
    const toggleText = toggleButton?.querySelector('.toggle-text');
    const toggleIcon = toggleButton?.querySelector('.toggle-icon');

    if (detailsContainer && toggleText && toggleIcon) {
      errorDisplay.isExpanded = !errorDisplay.isExpanded;

      if (errorDisplay.isExpanded) {
        detailsContainer.style.display = 'block';
        toggleText.textContent = 'Hide details';
        toggleIcon.textContent = '▲';
        
        if (this.config.trackErrorInteractions) {
          this.trackErrorAction(errorDisplay.category, 'expand_details');
        }
      } else {
        detailsContainer.style.display = 'none';
        toggleText.textContent = 'Show details';
        toggleIcon.textContent = '▼';
      }
    }
  }

  private startCountdown(button: HTMLButtonElement, ms: number) {
    const endTime = Date.now() + ms;
    
    const updateButton = () => {
      const remaining = Math.max(0, endTime - Date.now());
      if (remaining > 0) {
        button.textContent = `Wait ${this.formatRecoveryTime(remaining)}`;
        setTimeout(updateButton, 1000);
      } else {
        button.textContent = 'Retry Now';
        button.disabled = false;
        button.className = button.className.replace('error-wait', 'error-retry');
      }
    };
    
    updateButton();
  }

  private showHelpModal(errorDisplay: ErrorDisplay) {
    const modal = this.createModalContainer();
    modal.innerHTML = `
      <div class="help-modal">
        <div class="help-header">
          <h3>Need Help?</h3>
          <button class="modal-close">×</button>
        </div>
        
        <div class="help-content">
          <p><strong>What happened:</strong> ${errorDisplay.userMessage}</p>
          
          <div class="help-suggestions">
            <h4>Try these solutions:</h4>
            <ul>
              <li>${errorDisplay.guidance.primaryAction}</li>
              ${errorDisplay.guidance.secondaryActions.map((action: string) => `<li>${action}</li>`).join('')}
            </ul>
          </div>
          
          <div class="help-contact">
            <p>Still having trouble? <a href="/contact">Contact our support team</a></p>
          </div>
        </div>
      </div>
    `;

    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }

    if (this.config.trackErrorInteractions) {
      this.trackErrorAction(errorDisplay.category, 'help_requested');
    }
  }

  // Utility methods
  private getErrorIcon(category: ErrorCategory): string {
    const icons: Record<ErrorCategory, string> = {
      NETWORK: '🌐',
      TIMEOUT: '⏱️',
      AUTH: '🔒',
      RATE_LIMIT: '⏸️',
      VALIDATION: '⚠️',
      UNKNOWN: '❓'
    };
    return icons[category] || icons.UNKNOWN;
  }

  private getErrorSeverity(category: ErrorCategory): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<ErrorCategory, 'low' | 'medium' | 'high' | 'critical'> = {
      VALIDATION: 'medium',
      NETWORK: 'high',
      TIMEOUT: 'medium',
      AUTH: 'high',
      RATE_LIMIT: 'low',
      UNKNOWN: 'medium'
    } as const;
    
    return severityMap[category] || 'medium';
  }

  private getSeverityLabel(severity: string): string {
    const labels = {
      low: 'Info',
      medium: 'Warning',
      high: 'Error',
      critical: 'Critical'
    };
    return labels[severity as keyof typeof labels] || 'Warning';
  }

  private formatRecoveryTime(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  }

  // Container management
  private createModalContainer(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'error-modal-overlay';
    document.body.appendChild(modal);
    return modal;
  }

  private getOrCreateToastContainer(): HTMLElement {
    let container = document.querySelector('.error-toast-container') as HTMLElement;
    if (!container) {
      container = document.createElement('div');
      container.className = 'error-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Animation helpers
  private showAsModal(container: HTMLElement, element: HTMLElement) {
    container.className += ' modal-active';
    container.appendChild(element);
    this.animateIn(element, 'modal-in');
  }

  private animateIn(element: HTMLElement, animationClass: string) {
    element.classList.add(animationClass);
    setTimeout(() => {
      element.classList.remove(animationClass);
    }, 300);
  }

  // Tracking methods
  private trackErrorShown(category: ErrorCategory, message: string) {
    if (typeof window !== 'undefined' && 'businessMonitor' in window) {
      (window as any).businessMonitor.trackCustomEvent('error_shown', {
        category,
        message: message.substring(0, 100), // Truncate for privacy
        timestamp: Date.now()
      });
    }
  }

  private trackErrorAction(category: ErrorCategory, action: string) {
    if (typeof window !== 'undefined' && 'businessMonitor' in window) {
      (window as any).businessMonitor.trackCustomEvent('error_action', {
        category,
        action,
        timestamp: Date.now()
      });
    }
  }

  // Error management
  dismissError(errorId: string) {
    const errorDisplay = this.activeErrors.get(errorId);
    if (!errorDisplay || !errorDisplay.element) return;

    this.animateOut(errorDisplay.element, () => {
      errorDisplay.element?.remove();
      this.activeErrors.delete(errorId);
    });
  }

  private animateOut(element: HTMLElement, callback: () => void) {
    element.classList.add('fade-out');
    setTimeout(callback, 300);
  }

  dismissAllErrors() {
    this.activeErrors.forEach((_, errorId) => {
      this.dismissError(errorId);
    });
  }

  private initializeErrorTracking() {
    // Global error handler integration
    window.addEventListener('error', (event) => {
      if (event.error) {
        const container = document.body;
        this.showNetworkError(event.error);
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      const error = new Error(event.reason);
      const container = document.body;
      this.showNetworkError(error);
    });
  }

  private injectStyles() {
    if (document.querySelector('#error-communication-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'error-communication-styles';
    styles.textContent = `
      /* Base error styles */
      .error-display {
        border-radius: 8px;
        padding: 16px;
        margin: 8px 0;
        border-left: 4px solid;
        background: #fef2f2;
        color: #991b1b;
        border-left-color: #ef4444;
      }

      .error-display.error-network {
        background: #fef3c7;
        color: #92400e;
        border-left-color: #f59e0b;
      }

      .error-display.error-validation {
        background: #fef3c7;
        color: #92400e;
        border-left-color: #f59e0b;
      }

      .error-display.error-rate_limit {
        background: #f0f9ff;
        color: #1e40af;
        border-left-color: #3b82f6;
      }

      .error-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .error-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .error-message-container {
        flex: 1;
      }

      .error-main-message {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .error-severity-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .error-severity-badge.low {
        background: #dbeafe;
        color: #1e40af;
      }

      .error-severity-badge.medium {
        background: #fef3c7;
        color: #92400e;
      }

      .error-severity-badge.high {
        background: #fecaca;
        color: #991b1b;
      }

      .error-severity-badge.critical {
        background: #fce7f3;
        color: #be185d;
      }

      .error-user-message {
        font-weight: 500;
      }

      .error-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .error-action {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .error-retry {
        background: #3b82f6;
        color: white;
      }

      .error-retry:hover {
        background: #2563eb;
      }

      .error-refresh {
        background: #10b981;
        color: white;
      }

      .error-help {
        background: #6b7280;
        color: white;
      }

      .error-wait {
        background: #e5e7eb;
        color: #6b7280;
      }

      .error-dismiss {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-dismiss:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      /* Progressive disclosure */
      .error-details-toggle {
        background: none;
        border: none;
        color: inherit;
        text-decoration: underline;
        cursor: pointer;
        font-size: 14px;
        padding: 4px 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .error-technical-details {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
      }

      .technical-message code {
        background: rgba(0, 0, 0, 0.1);
        padding: 4px 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
      }

      .guidance-steps {
        margin: 8px 0;
        padding-left: 20px;
      }

      .guidance-steps li {
        margin: 4px 0;
      }

      /* Display types */
      .error-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        z-index: 1000;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }

      .error-banner {
        margin: 0;
        border-radius: 0;
        border-left: none;
        border-bottom: 4px solid;
      }

      .error-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .error-modal-overlay .error-display {
        max-width: 500px;
        margin: 20px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
      }

      /* Toast container */
      .error-toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        pointer-events: none;
      }

      .error-toast-container .error-display {
        pointer-events: all;
        margin-bottom: 12px;
      }

      /* Animations */
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes slide-in-right {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes slide-down {
        from { opacity: 0; transform: translateY(-100%); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes modal-in {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }

      .fade-in { animation: fade-in 0.3s ease; }
      .slide-in-right { animation: slide-in-right 0.3s ease; }
      .slide-down { animation: slide-down 0.3s ease; }
      .modal-in { animation: modal-in 0.3s ease; }

      .fade-out {
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
      }

      /* Auto-hide progress */
      .error-auto-hide-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: rgba(0, 0, 0, 0.2);
        width: 0%;
      }

      @keyframes countdown {
        from { width: 100%; }
        to { width: 0%; }
      }

      /* Help modal */
      .help-modal {
        background: white;
        border-radius: 8px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
      }

      .help-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
      }

      .help-content {
        padding: 20px;
      }

      .help-suggestions h4 {
        margin: 16px 0 8px 0;
      }

      .help-contact {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        .error-toast {
          right: 10px;
          left: 10px;
          max-width: none;
        }
        
        .error-content {
          flex-direction: column;
          gap: 8px;
        }
        
        .error-actions {
          flex-wrap: wrap;
        }
        
        .error-modal-overlay .error-display {
          margin: 10px;
        }
      }
    `;

    document.head.appendChild(styles);
  }
}

interface ErrorDisplay {
  id: string;
  category: ErrorCategory;
  userMessage: string;
  technicalMessage: string;
  guidance: RecoveryGuidance;
  options: ErrorDisplayOptions;
  element: HTMLElement | null;
  isExpanded: boolean;
  createdAt: number;
}

// Export singleton instance
export const userErrorCommunication = new UserErrorCommunicationSystem();

// Helper functions for common error scenarios
export function showCartError(error: Error, container: HTMLElement) {
  return userErrorCommunication.showCartError(error, container);
}

export function showInventoryError(error: Error, container: HTMLElement) {
  return userErrorCommunication.showInventoryError(error, container);
}

export function showPaymentError(error: Error) {
  return userErrorCommunication.showPaymentError(error);
}

export function showNetworkError(error: Error) {
  return userErrorCommunication.showNetworkError(error);
}

export function dismissError(errorId: string) {
  userErrorCommunication.dismissError(errorId);
}
