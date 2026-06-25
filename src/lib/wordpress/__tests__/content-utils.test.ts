import { describe, it, expect } from 'vitest';
import { stripUnsafeHtml } from '../content-utils';

describe('stripUnsafeHtml', () => {
  it('neutralizes data:text/html URIs', () => {
    const result = stripUnsafeHtml('<img src="data:text/html,<script>alert(1)</script>">');
    expect(result).not.toContain('data:text/html');
  });

  it('neutralizes data:application/javascript URIs', () => {
    const result = stripUnsafeHtml('<a href="data:application/javascript,alert(1)">x</a>');
    expect(result).not.toContain('data:application/javascript');
  });

  it('still neutralizes javascript: URIs', () => {
    const result = stripUnsafeHtml('<a href="javascript:alert(1)">x</a>');
    expect(result).not.toContain('javascript:alert');
  });

  it('does not alter legitimate data:image/* URIs', () => {
    const input = '<img src="data:image/png;base64,iVBORw0KGgo=">';
    expect(stripUnsafeHtml(input)).toBe(input);
  });

  it('still strips <script> tags', () => {
    const result = stripUnsafeHtml('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
  });
});
