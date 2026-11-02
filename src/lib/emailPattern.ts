// src/lib/emailPattern.ts
//
// The email shape the back-in-stock API accepts, shared with the client forms
// so they reject exactly what the server would. Deliberately loose (something
// @ something . something): real validation is the confirmation email. Note
// the browser's own type="email" check accepts "a@b" with no dot, which this
// does not, so relying on it alone lets through input the API then 400s.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
