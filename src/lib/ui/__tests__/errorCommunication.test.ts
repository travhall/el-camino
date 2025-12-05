/**
 * Error Communication System Tests
 * Tests user-friendly error display, progressive disclosure, and recovery actions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  userErrorCommunication,
  showCartError,
  showInventoryError,
  showPaymentError,
  showNetworkError,
  dismissError
} from '../errorCommunication';

// Mock errorRecovery module
vi.mock('@/lib/monitoring/errorRecovery', () => ({
  errorRecovery: {
    categorizeError: vi.fn((error: Error) => {
      if (error.message.includes('network')) return 'NETWORK';
      if (error.message.includes('timeout')) return 'TIMEOUT';
      if (error.message.includes('auth')) return 'AUTH';
      if (error.message.includes('rate')) return 'RATE_LIMIT';
      if (error.message.includes('validation')) return 'VALIDATION';
      return 'UNKNOWN';
    }),
    getUserFriendlyMessage: vi.fn((error: Error) => {
      return `User-friendly: ${error.message}`;
    }),
    getRecoveryGuidance: vi.fn(() => ({
      canRetry: true,
      primaryAction: 'Try refreshing the page',
      secondaryActions: ['Check your internet connection', 'Contact support'],
      estimatedRecoveryTime: 30000
    }))
  }
}));

describe('Error Communication System', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Clear any existing error displays
    (userErrorCommunication as any).activeErrors.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Basic Error Display', () => {
    it('should display error with user-friendly message', () => {
      const error = new Error('Test error');

      const errorId = userErrorCommunication.showUserFriendlyError(
        error,
        container
      );

      expect(errorId).toBeDefined();
      const errorElement = container.querySelector('.error-display');
      expect(errorElement).toBeDefined();
      expect(errorElement?.textContent).toContain('User-friendly: Test error');
    });

    it('should include error icon', () => {
      const error = new Error('network error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        showIcon: true
      });

      const icon = container.querySelector('.error-icon');
      expect(icon).toBeDefined();
    });

    it('should display severity badge', () => {
      const error = new Error('Test error');

      userErrorCommunication.showUserFriendlyError(error, container);

      const badge = container.querySelector('.error-severity-badge');
      expect(badge).toBeDefined();
    });

    it('should apply correct CSS class for error category', () => {
      const error = new Error('network failure');

      userErrorCommunication.showUserFriendlyError(error, container);

      const errorElement = container.querySelector('.error-display');
      expect(errorElement?.classList.contains('error-network')).toBe(true);
    });
  });

  describe('Display Types', () => {
    it('should display inline error', () => {
      const error = new Error('Inline error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true
      });

      const errorElement = container.querySelector('.error-inline');
      expect(errorElement).toBeDefined();
    });

    it('should display toast error', () => {
      const error = new Error('Toast error');

      const toastContainer = document.createElement('div');
      toastContainer.className = 'error-toast-container';
      document.body.appendChild(toastContainer);

      userErrorCommunication.showUserFriendlyError(error, toastContainer, {
        type: 'toast',
        dismissible: true
      });

      const errorElement = toastContainer.querySelector('.error-toast');
      expect(errorElement).toBeDefined();
    });

    it('should display banner error', () => {
      const error = new Error('Banner error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'banner',
        dismissible: true
      });

      const errorElement = container.querySelector('.error-banner');
      expect(errorElement).toBeDefined();
    });

    it('should display modal error', () => {
      const error = new Error('Modal error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'modal',
        dismissible: false
      });

      const modal = document.querySelector('.error-modal-overlay');
      expect(modal).toBeDefined();
    });
  });

  describe('Progressive Disclosure', () => {
    it('should show details toggle button', () => {
      const error = new Error('Test error');

      userErrorCommunication.showUserFriendlyError(error, container);

      const toggle = container.querySelector('.error-details-toggle');
      expect(toggle).toBeDefined();
      expect(toggle?.textContent).toContain('Show details');
    });

    it('should hide technical details initially', () => {
      const error = new Error('Test error');

      userErrorCommunication.showUserFriendlyError(error, container);

      const details = container.querySelector('.error-technical-details') as HTMLElement;
      expect(details?.style.display).toBe('none');
    });

    it('should toggle details on button click', () => {
      const error = new Error('Test error');

      const errorId = userErrorCommunication.showUserFriendlyError(
        error,
        container
      );

      const toggle = container.querySelector('.error-details-toggle') as HTMLElement;
      toggle?.click();

      const details = container.querySelector('.error-technical-details') as HTMLElement;
      expect(details?.style.display).toBe('block');

      const toggleText = toggle?.querySelector('.toggle-text');
      expect(toggleText?.textContent).toBe('Hide details');
    });

    it('should display technical message in details', () => {
      const error = new Error('Technical error message');

      userErrorCommunication.showUserFriendlyError(error, container);

      const toggle = container.querySelector('.error-details-toggle') as HTMLElement;
      toggle?.click();

      const technicalMessage = container.querySelector('.technical-message code');
      expect(technicalMessage?.textContent).toContain('Technical error message');
    });

    it('should display recovery guidance', () => {
      const error = new Error('Test error');

      userErrorCommunication.showUserFriendlyError(error, container);

      const toggle = container.querySelector('.error-details-toggle') as HTMLElement;
      toggle?.click();

      const guidance = container.querySelector('.guidance-steps');
      expect(guidance).toBeDefined();
      expect(guidance?.textContent).toContain('Try refreshing the page');
    });
  });

  describe('Recovery Actions', () => {
    it('should show retry button when retryable', () => {
      const error = new Error('Retryable error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        showActions: true
      });

      const retryButton = container.querySelector('.error-retry');
      expect(retryButton).toBeDefined();
      expect(retryButton?.textContent?.trim()).toBe('Retry');
    });

    it('should show category-specific actions', () => {
      const error = new Error('network failure');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        showActions: true
      });

      const refreshButton = container.querySelector('.error-refresh');
      expect(refreshButton).toBeDefined();
      expect(refreshButton?.textContent).toContain('Refresh');
    });

    it('should dispatch retry event on retry click', () => {
      const error = new Error('Test error');
      const eventHandler = vi.fn();

      document.addEventListener('error:retry', eventHandler);

      const errorId = userErrorCommunication.showUserFriendlyError(
        error,
        container,
        { type: 'inline', dismissible: true, showActions: true }
      );

      const retryButton = container.querySelector('.error-retry') as HTMLElement;
      retryButton?.click();

      expect(eventHandler).toHaveBeenCalled();

      document.removeEventListener('error:retry', eventHandler);
    });
  });

  describe('Dismissible Errors', () => {
    it('should show dismiss button when dismissible', () => {
      const error = new Error('Dismissible error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true
      });

      const dismissButton = container.querySelector('.error-dismiss');
      expect(dismissButton).toBeDefined();
    });

    it('should not show dismiss button when not dismissible', () => {
      const error = new Error('Non-dismissible error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: false
      });

      const dismissButton = container.querySelector('.error-dismiss');
      expect(dismissButton).toBeNull();
    });

    it('should remove error on dismiss click', () => {
      const error = new Error('Test error');

      const errorId = userErrorCommunication.showUserFriendlyError(
        error,
        container,
        { type: 'inline', dismissible: true }
      );

      const dismissButton = container.querySelector('.error-dismiss') as HTMLElement;
      dismissButton?.click();

      // Wait for animation
      setTimeout(() => {
        const errorElement = container.querySelector('.error-display');
        expect(errorElement).toBeNull();
      }, 400);
    });

    it('should remove error from active errors map', () => {
      const error = new Error('Test error');

      const errorId = userErrorCommunication.showUserFriendlyError(
        error,
        container,
        { type: 'inline', dismissible: true }
      );

      userErrorCommunication.dismissError(errorId);

      setTimeout(() => {
        const activeErrors = (userErrorCommunication as any).activeErrors;
        expect(activeErrors.has(errorId)).toBe(false);
      }, 400);
    });
  });

  describe('Auto-Hide', () => {
    it('should show auto-hide progress bar', () => {
      const error = new Error('Auto-hide error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        autoHide: 5000
      });

      const progress = container.querySelector('.error-auto-hide-progress');
      expect(progress).toBeDefined();
    });

    it('should auto-dismiss after specified time', async () => {
      vi.useFakeTimers();

      const error = new Error('Auto-hide error');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        autoHide: 1000
      });

      expect(container.querySelector('.error-display')).toBeDefined();

      vi.advanceTimersByTime(1500);

      setTimeout(() => {
        expect(container.querySelector('.error-display')).toBeNull();
      }, 400);

      vi.useRealTimers();
    });
  });

  describe('Helper Functions', () => {
    it('should show cart error with correct options', () => {
      const error = new Error('Cart error');

      const errorId = showCartError(error, container);

      expect(errorId).toBeDefined();
      const errorElement = container.querySelector('.error-display');
      expect(errorElement).toBeDefined();
    });

    it('should show inventory error as banner', () => {
      const error = new Error('Inventory error');

      const errorId = showInventoryError(error, container);

      expect(errorId).toBeDefined();
      const errorElement = container.querySelector('.error-banner');
      expect(errorElement).toBeDefined();
    });

    it('should show payment error as modal', () => {
      const error = new Error('Payment error');

      const errorId = showPaymentError(error);

      expect(errorId).toBeDefined();
      const modal = document.querySelector('.error-modal-overlay');
      expect(modal).toBeDefined();
    });

    it('should show network error as toast', () => {
      const error = new Error('Network error');

      const errorId = showNetworkError(error);

      expect(errorId).toBeDefined();
      const toastContainer = document.querySelector('.error-toast-container');
      expect(toastContainer).toBeDefined();
    });
  });

  describe('Multiple Errors', () => {
    it('should handle multiple simultaneous errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      userErrorCommunication.showUserFriendlyError(error1, container);
      userErrorCommunication.showUserFriendlyError(error2, container);

      const errorElements = container.querySelectorAll('.error-display');
      expect(errorElements.length).toBe(2);
    });

    it('should track active errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      userErrorCommunication.showUserFriendlyError(error1, container);
      userErrorCommunication.showUserFriendlyError(error2, container);

      const activeErrors = (userErrorCommunication as any).activeErrors;
      expect(activeErrors.size).toBe(2);
    });

    it('should dismiss all errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      userErrorCommunication.showUserFriendlyError(error1, container);
      userErrorCommunication.showUserFriendlyError(error2, container);

      userErrorCommunication.dismissAllErrors();

      setTimeout(() => {
        const activeErrors = (userErrorCommunication as any).activeErrors;
        expect(activeErrors.size).toBe(0);
      }, 400);
    });
  });

  describe('Error Severity', () => {
    it('should display correct severity for network errors', () => {
      const error = new Error('network failure');

      userErrorCommunication.showUserFriendlyError(error, container);

      const badge = container.querySelector('.error-severity-badge');
      expect(badge?.classList.contains('high')).toBe(true);
    });

    it('should display correct severity for validation errors', () => {
      const error = new Error('validation failed');

      userErrorCommunication.showUserFriendlyError(error, container);

      const badge = container.querySelector('.error-severity-badge');
      expect(badge?.classList.contains('medium')).toBe(true);
    });

    it('should display correct severity for rate limit errors', () => {
      const error = new Error('rate limit exceeded');

      userErrorCommunication.showUserFriendlyError(error, container);

      const badge = container.querySelector('.error-severity-badge');
      expect(badge?.classList.contains('low')).toBe(true);
    });
  });

  describe('Styles Injection', () => {
    it('should inject styles only once', () => {
      const error = new Error('Test 1');
      userErrorCommunication.showUserFriendlyError(error, container);

      const error2 = new Error('Test 2');
      userErrorCommunication.showUserFriendlyError(error2, container);

      const styleElements = document.querySelectorAll('#error-communication-styles');
      expect(styleElements.length).toBe(1);
    });
  });

  describe('Error Icons', () => {
    it('should show correct icon for network errors', () => {
      const error = new Error('network failure');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        showIcon: true
      });

      const icon = container.querySelector('.error-icon');
      expect(icon?.textContent).toBe('🌐');
    });

    it('should show correct icon for timeout errors', () => {
      const error = new Error('timeout occurred');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        showIcon: true
      });

      const icon = container.querySelector('.error-icon');
      expect(icon?.textContent).toBe('⏱️');
    });

    it('should show correct icon for auth errors', () => {
      const error = new Error('auth failure');

      userErrorCommunication.showUserFriendlyError(error, container, {
        type: 'inline',
        dismissible: true,
        showIcon: true
      });

      const icon = container.querySelector('.error-icon');
      expect(icon?.textContent).toBe('🔒');
    });
  });

  describe('Recovery Time Display', () => {
    it('should format recovery time in seconds', () => {
      const error = new Error('Test error');

      userErrorCommunication.showUserFriendlyError(error, container);

      const toggle = container.querySelector('.error-details-toggle') as HTMLElement;
      toggle?.click();

      const recoveryTime = container.querySelector('.recovery-time');
      expect(recoveryTime?.textContent).toContain('30s');
    });

    it('should format recovery time in minutes', async () => {
      // Mock long recovery time using vi.mock
      const { errorRecovery } = await import('@/lib/monitoring/errorRecovery');
      vi.mocked(errorRecovery.getRecoveryGuidance).mockReturnValueOnce({
        canRetry: true,
        primaryAction: 'Wait',
        secondaryActions: [],
        estimatedRecoveryTime: 120000 // 2 minutes
      });

      const error = new Error('Test error');

      userErrorCommunication.showUserFriendlyError(error, container);

      const toggle = container.querySelector('.error-details-toggle') as HTMLElement;
      toggle?.click();

      const recoveryTime = container.querySelector('.recovery-time');
      expect(recoveryTime?.textContent).toContain('2m');
    });
  });

  describe('Event Tracking', () => {
    it('should track error shown events', () => {
      const mockBusinessMonitor = {
        trackCustomEvent: vi.fn()
      };

      (window as any).businessMonitor = mockBusinessMonitor;

      const error = new Error('Tracked error');

      userErrorCommunication.showUserFriendlyError(error, container);

      expect(mockBusinessMonitor.trackCustomEvent).toHaveBeenCalledWith(
        'error_shown',
        expect.objectContaining({
          message: expect.any(String),
          timestamp: expect.any(Number)
        })
      );

      delete (window as any).businessMonitor;
    });
  });
});
