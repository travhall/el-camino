// src/lib/product/backInStockForm.ts
//
// Client behavior for the "Get notified when it's back" form, shared by the
// PDP (BackInStock.astro) and QuickView, whose forms are the same markup under
// different ids.
//
// Accessibility contract, which the markup in both components relies on:
//  - the email input has a visible <label>; validation errors are text in a
//    paragraph referenced by aria-describedby, set together with
//    aria-invalid, and the input is focused so the error is read with it
//  - result messages go into a live region that stays in the DOM and has its
//    text replaced (a region that appears from display:none is announced
//    unreliably)
//  - on success the form is removed, which would drop focus to <body>, so
//    focus moves to the (tabindex=-1) success message instead
//  - state is never carried by color alone: messages are neutral text beside a
//    filled state icon. (Coloring the text with the state tokens fails
//    contrast: the -surface tokens are 3.9:1 on the light card and 2.6:1 on the
//    dark one, and the -text tokens are white.)
import { EMAIL_PATTERN } from '@/lib/emailPattern';

export interface BackInStockIds {
  form: string;
  email: string;
  /** Paragraph under the input, referenced by its aria-describedby */
  emailError: string;
  submit: string;
  /** Persistent aria-live region for results that aren't about the field */
  status: string;
  /** tabindex=-1 element revealed (and focused) on success */
  success: string;
}

export const PDP_BIS_IDS: BackInStockIds = {
  form: 'back-in-stock-form',
  email: 'bis-email',
  emailError: 'bis-email-error',
  submit: 'bis-submit',
  status: 'bis-status',
  success: 'bis-success',
};

export const QUICK_VIEW_BIS_IDS: BackInStockIds = {
  form: 'qv-bis-form',
  email: 'qv-bis-email',
  emailError: 'qv-bis-email-error',
  submit: 'qv-bis-submit',
  status: 'qv-bis-status',
  success: 'qv-bis-success',
};

export const MESSAGES = {
  emailRequired: 'Enter your email address.',
  emailInvalid: 'Enter a valid email address, like name@example.com.',
  rateLimited: 'Too many requests. Please try again in a minute.',
  failed: 'Something went wrong. Please try again',
} as const;

const DEFAULT_LABEL = 'Notify Me';
const SENDING_LABEL = 'Sending…';

// Full literal class strings so Tailwind's scanner picks them up.
const ICON_CLASS = {
  success:
    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-state-success-surface text-state-success-text',
  error:
    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-state-error-surface text-state-error-text',
} as const;

const ICON_SVG = {
  success:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v8M12 18h.01"/></svg>',
} as const;

type Kind = keyof typeof ICON_CLASS;

const byId = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

function icon(kind: Kind): HTMLElement {
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.className = ICON_CLASS[kind];
  span.innerHTML = ICON_SVG[kind]; // static markup
  return span;
}

/** Replace a container's content with `[icon] text`. */
function setMessage(
  container: HTMLElement,
  kind: Kind,
  content: Array<string | Node>
): void {
  const text = document.createElement('span');
  text.append(...content);
  container.replaceChildren(icon(kind), text);
}

/** The problem with an email as typed, or null if it's fine to send. */
export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return MESSAGES.emailRequired;
  if (!EMAIL_PATTERN.test(email)) return MESSAGES.emailInvalid;
  return null;
}

function showFieldError(ids: BackInStockIds, message: string): void {
  const email = byId<HTMLInputElement>(ids.email);
  const error = byId(ids.emailError);
  if (!email || !error) return;

  setMessage(error, 'error', [message]);
  email.setAttribute('aria-invalid', 'true');
  email.focus();
}

function clearFieldError(ids: BackInStockIds): void {
  byId(ids.emailError)?.replaceChildren();
  byId(ids.email)?.removeAttribute('aria-invalid');
}

function showStatusError(ids: BackInStockIds, content: Array<string | Node>) {
  const status = byId(ids.status);
  if (status) setMessage(status, 'error', content);
}

function failedContent(status: HTMLElement | null): Array<string | Node> {
  const contact = status?.dataset.contactEmail;
  if (!contact) return [`${MESSAGES.failed}.`];

  const link = document.createElement('a');
  link.href = `mailto:${contact}`;
  link.className = 'underline hover:no-underline';
  link.textContent = 'email us directly';
  return [`${MESSAGES.failed} or `, link, '.'];
}

function setSending(ids: BackInStockIds, sending: boolean): void {
  const submit = byId<HTMLButtonElement>(ids.submit);
  if (!submit) return;
  submit.disabled = sending;
  submit.textContent = sending
    ? SENDING_LABEL
    : (submit.dataset.bisLabel ?? DEFAULT_LABEL);
}

function showSuccess(ids: BackInStockIds): void {
  const form = byId(ids.form);
  const success = byId(ids.success);

  byId(ids.status)?.replaceChildren();
  form?.classList.add('hidden');
  if (!success) return;

  // Decorate once; the message text itself is server-rendered
  if (!success.querySelector('[data-bis-icon]')) {
    const mark = icon('success');
    mark.setAttribute('data-bis-icon', '');
    success.prepend(mark);
  }
  success.classList.remove('hidden');
  // The form just left the page, so focus would otherwise fall to <body>
  success.focus();
}

async function submit(ids: BackInStockIds, e: Event): Promise<void> {
  e.preventDefault();
  const form = byId<HTMLFormElement>(ids.form);
  const email = byId<HTMLInputElement>(ids.email);
  if (!form || !email) return;

  byId(ids.status)?.replaceChildren();

  const problem = validateEmail(email.value);
  if (problem) {
    showFieldError(ids, problem);
    return;
  }
  clearFieldError(ids);
  setSending(ids, true);

  try {
    const res = await fetch('/api/back-in-stock', {
      method: 'POST',
      body: new FormData(form),
    });

    if (res.ok) {
      showSuccess(ids);
      return;
    }

    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    setSending(ids, false);

    if (res.status === 400 && /email/i.test(body?.error ?? '')) {
      showFieldError(ids, MESSAGES.emailInvalid);
    } else if (res.status === 429) {
      showStatusError(ids, [body?.error || MESSAGES.rateLimited]);
    } else {
      showStatusError(ids, failedContent(byId(ids.status)));
    }
  } catch {
    setSending(ids, false);
    showStatusError(ids, failedContent(byId(ids.status)));
  }
}

/**
 * Wire up the form. Safe to call repeatedly: a form that is already wired
 * (they re-run on astro:page-load) is skipped, while a swapped-in form is new
 * DOM and gets wired.
 */
export function initBackInStockForm(ids: BackInStockIds): void {
  const form = byId<HTMLFormElement>(ids.form);
  const email = byId<HTMLInputElement>(ids.email);
  const button = byId<HTMLButtonElement>(ids.submit);
  if (!form || !email || form.dataset.bisInit === 'true') return;
  form.dataset.bisInit = 'true';

  if (button)
    button.dataset.bisLabel = button.textContent?.trim() || DEFAULT_LABEL;

  form.addEventListener('submit', (e) => void submit(ids, e));
  // The error described a value that has since changed
  email.addEventListener('input', () => clearFieldError(ids));
}

/**
 * Put the form back to its starting state, for when the shopper moves to
 * another sold-out variant: it must not still say "You're on the list" about
 * the previous one.
 */
export function resetBackInStockForm(ids: BackInStockIds): void {
  const email = byId<HTMLInputElement>(ids.email);

  byId(ids.form)?.classList.remove('hidden');
  if (email) email.value = '';
  clearFieldError(ids);
  byId(ids.status)?.replaceChildren();
  byId(ids.success)?.classList.add('hidden');
  setSending(ids, false);
}
