import React from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * A small, muted date line shown just under a lesson's title, recording when
 * the page was created. Formatted by hand (not toLocaleDateString) so the
 * output is identical on the server and in the browser — no hydration drift.
 *
 * Registered globally in src/theme/MDXComponents.js, so lessons use it with no
 * import, right after the H1:
 *
 *   # Finding the needle
 *
 *   <Updated date="2026-10-11" />
 */
export default function Updated({date}) {
  if (!date || typeof date !== 'string') {
    return null;
  }
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  const label = `${d} ${MONTHS[m - 1]} ${y}`;
  return (
    <div className="page-updated">
      Updated <time dateTime={date}>{label}</time>
    </div>
  );
}
