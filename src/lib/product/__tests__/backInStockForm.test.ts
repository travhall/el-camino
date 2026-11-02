/**
 * The shared back-in-stock form behavior (PDP and QuickView), in happy-dom.
 * The fixture mirrors the markup both components render.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initBackInStockForm,
  resetBackInStockForm,
  validateEmail,
  MESSAGES,
  PDP_BIS_IDS as IDS,
} from '../backInStockForm';

function setupDom({ contactEmail = 'shop@example.com' } = {}): void {
  document.body.innerHTML = `
    <form id="back-in-stock-form" name="back-in-stock" method="POST" action="/api/back-in-stock" novalidate>
      <input type="hidden" name="product_id" value="prod-1" />
      <label for="bis-email">Email address</label>
      <input type="email" name="email" id="bis-email" aria-describedby="bis-email-error" />
      <p id="bis-email-error"></p>
      <button type="submit" id="bis-submit">Notify Me</button>
    </form>
    <div id="bis-status" role="status" aria-live="polite" ${
      contactEmail ? `data-contact-email="${contactEmail}"` : ''
    }></div>
    <p id="bis-success" class="hidden" tabindex="-1">You're on the list!</p>
  `;
}

const $ = (id: string) => document.getElementById(id)!;
const email = () => $('bis-email') as HTMLInputElement;
const submit = () => $('bis-submit') as HTMLButtonElement;
const fieldError = () => $('bis-email-error');
const status = () => $('bis-status');

const send = (value: string) => {
  email().value = value;
  $('back-in-stock-form').dispatchEvent(
    new Event('submit', { cancelable: true })
  );
};
// let the async submit handler settle
const settle = () => new Promise((r) => setTimeout(r, 0));

function mockFetch(
  impl: () => Promise<Partial<Response>> | Partial<Response>
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => impl());
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}
const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('validateEmail', () => {
  it('asks for an address when it is empty or only whitespace', () => {
    expect(validateEmail('')).toBe(MESSAGES.emailRequired);
    expect(validateEmail('   ')).toBe(MESSAGES.emailRequired);
  });

  it.each(['foo', 'foo@bar', 'a b@c.com', '@c.com', 'a@.com', 'a@@c.com'])(
    'rejects %j, including the "a@b" the browser accepts but the API would 400',
    (value) => {
      expect(validateEmail(value)).toBe(MESSAGES.emailInvalid);
    }
  );

  it('accepts a normal address and ignores surrounding whitespace', () => {
    expect(validateEmail('shopper@example.com')).toBeNull();
    expect(validateEmail('  shopper@example.com  ')).toBeNull();
  });
});

describe('initBackInStockForm', () => {
  beforeEach(() => {
    setupDom();
    initBackInStockForm(IDS);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('validation', () => {
    it('does not send, shows the message, flags the field, and moves focus to it', () => {
      const fetchSpy = mockFetch(() => json(200, {}));

      send('not-an-email');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(fieldError().textContent).toBe(MESSAGES.emailInvalid);
      expect(email().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(email());
    });

    it('asks for an address when the field is empty', () => {
      mockFetch(() => json(200, {}));
      send('');
      expect(fieldError().textContent).toBe(MESSAGES.emailRequired);
    });

    it('gives the message a hidden icon but only the text to assistive tech', () => {
      send('');
      const icon = fieldError().querySelector('[aria-hidden="true"]');
      expect(icon).not.toBeNull();
      expect(icon!.className).toContain('bg-state-error-surface');
    });

    it('clears the message and the invalid flag as soon as the shopper edits the field', () => {
      send('');
      email().dispatchEvent(new Event('input', { bubbles: true }));

      expect(fieldError().childNodes.length).toBe(0);
      expect(email().hasAttribute('aria-invalid')).toBe(false);
    });

    it('is still described by the error paragraph, which exists before any error', () => {
      expect(email().getAttribute('aria-describedby')).toBe('bis-email-error');
      expect(fieldError()).not.toBeNull();
    });
  });

  describe('success', () => {
    it('posts the form, removes it, reveals the message, and focuses it', async () => {
      const fetchSpy = mockFetch(() => json(200, { success: true }));

      send('shopper@example.com');
      await settle();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe('/api/back-in-stock');
      expect(init.method).toBe('POST');
      expect((init.body as FormData).get('email')).toBe('shopper@example.com');

      expect($('back-in-stock-form').classList.contains('hidden')).toBe(true);
      expect($('bis-success').classList.contains('hidden')).toBe(false);
      // The form held focus and just left; focus must not fall to <body>
      expect(document.activeElement).toBe($('bis-success'));
    });

    it('adds the success icon once', async () => {
      mockFetch(() => json(200, {}));
      send('shopper@example.com');
      await settle();

      expect($('bis-success').querySelectorAll('[data-bis-icon]').length).toBe(
        1
      );
    });

    it('clears any earlier status message', async () => {
      mockFetch(() => json(500, { error: 'x' }));
      send('shopper@example.com');
      await settle();
      expect(status().textContent).not.toBe('');

      mockFetch(() => json(200, {}));
      send('shopper@example.com');
      await settle();

      expect(status().childNodes.length).toBe(0);
    });
  });

  describe('failures', () => {
    it('shows the field message for a 400 about the email, and refocuses the field', async () => {
      mockFetch(() => json(400, { error: 'Invalid email address' }));

      send('shopper@example.com');
      await settle();

      expect(fieldError().textContent).toBe(MESSAGES.emailInvalid);
      expect(document.activeElement).toBe(email());
      expect(submit().disabled).toBe(false);
    });

    it("shows the server's own message for a 429", async () => {
      mockFetch(() =>
        json(429, { error: 'Too many requests. Please try again in a minute.' })
      );

      send('shopper@example.com');
      await settle();

      expect(status().textContent).toContain('Too many requests');
    });

    it('falls back to a default message for a 429 with no body', async () => {
      mockFetch(() => ({
        ok: false,
        status: 429,
        json: async () => Promise.reject(new Error('no body')),
      }));

      send('shopper@example.com');
      await settle();

      expect(status().textContent).toContain(MESSAGES.rateLimited);
    });

    it('offers an email link for any other failure', async () => {
      mockFetch(() => json(500, { error: 'Internal server error' }));

      send('shopper@example.com');
      await settle();

      expect(status().textContent).toContain('Something went wrong');
      const link = status().querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('mailto:shop@example.com');
      expect(link.textContent).toBe('email us directly');
    });

    it('treats a network error the same way', async () => {
      mockFetch(() => Promise.reject(new Error('offline')));

      send('shopper@example.com');
      await settle();

      expect(status().textContent).toContain('Something went wrong');
      expect(status().querySelector('a')).not.toBeNull();
    });

    it('omits the link when there is no contact address', async () => {
      setupDom({ contactEmail: '' });
      initBackInStockForm(IDS);
      mockFetch(() => json(500, {}));

      send('shopper@example.com');
      await settle();

      expect(status().querySelector('a')).toBeNull();
      expect(status().textContent).toContain(
        'Something went wrong. Please try again.'
      );
    });

    it('keeps the form, re-enables the button, and restores its original label', async () => {
      mockFetch(() => json(500, {}));

      send('shopper@example.com');
      await settle();

      expect($('back-in-stock-form').classList.contains('hidden')).toBe(false);
      expect(submit().disabled).toBe(false);
      expect(submit().textContent).toBe('Notify Me');
    });

    it('keeps its result message in the same live region element, rather than swapping it in', async () => {
      const region = status();
      mockFetch(() => json(500, {}));

      send('shopper@example.com');
      await settle();

      expect(status()).toBe(region);
      expect(region.getAttribute('role')).toBe('status');
      expect(region.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('while sending', () => {
    it('disables the button and says so, then restores it', async () => {
      let finish!: (r: Partial<Response>) => void;
      mockFetch(() => new Promise((resolve) => (finish = resolve)));

      send('shopper@example.com');
      expect(submit().disabled).toBe(true);
      expect(submit().textContent).toBe('Sending…');

      finish(json(500, {}));
      await settle();
      expect(submit().disabled).toBe(false);
      expect(submit().textContent).toBe('Notify Me');
    });

    it("restores the button's own label, not a hard-coded one", async () => {
      setupDom();
      $('bis-submit').textContent = 'Email me';
      initBackInStockForm(IDS);
      mockFetch(() => json(500, {}));

      send('shopper@example.com');
      await settle();

      expect(submit().textContent).toBe('Email me');
    });
  });

  describe('wiring', () => {
    it('is safe to call repeatedly: one submit, one request', async () => {
      initBackInStockForm(IDS);
      initBackInStockForm(IDS);
      const fetchSpy = mockFetch(() => json(200, {}));

      send('shopper@example.com');
      await settle();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the form is not on the page', () => {
      document.body.innerHTML = '';
      expect(() => initBackInStockForm(IDS)).not.toThrow();
    });
  });
});

describe('resetBackInStockForm', () => {
  beforeEach(() => {
    setupDom();
    initBackInStockForm(IDS);
  });
  afterEach(() => vi.restoreAllMocks());

  it('undoes a successful send, so it does not claim a different variant is covered', async () => {
    mockFetch(() => json(200, {}));
    send('shopper@example.com');
    await settle();

    resetBackInStockForm(IDS);

    expect($('back-in-stock-form').classList.contains('hidden')).toBe(false);
    expect($('bis-success').classList.contains('hidden')).toBe(true);
    expect(email().value).toBe('');
    expect(submit().disabled).toBe(false);
    expect(submit().textContent).toBe('Notify Me');
  });

  it('clears a field error and a status message', async () => {
    send('');
    mockFetch(() => json(500, {}));
    send('shopper@example.com');
    await settle();

    resetBackInStockForm(IDS);

    expect(fieldError().childNodes.length).toBe(0);
    expect(status().childNodes.length).toBe(0);
    expect(email().hasAttribute('aria-invalid')).toBe(false);
  });

  it('works before the form has been wired', () => {
    setupDom();
    expect(() => resetBackInStockForm(IDS)).not.toThrow();
    expect(submit().textContent).toBe('Notify Me');
  });
});
