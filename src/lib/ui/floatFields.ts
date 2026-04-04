/**
 * Floating label select initializer.
 *
 * Toggles `.has-value` on `.elco-field-float` wrappers that contain a
 * <select> element so the CSS floating label animates correctly.
 * Call once per page after the DOM is ready; safe to call multiple times.
 */
export function initFloatSelects(root: Document | Element = document): void {
  const selects = root.querySelectorAll<HTMLSelectElement>(
    ".elco-field-float > select"
  );

  selects.forEach((select) => {
    const wrapper = select.closest<HTMLElement>(".elco-field-float");
    if (!wrapper) return;

    const update = () => {
      wrapper.classList.toggle("has-value", select.value !== "");
    };

    update(); // set initial state
    select.addEventListener("change", update);
  });
}
