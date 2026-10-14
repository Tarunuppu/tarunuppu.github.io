import React, {useId} from 'react';

/**
 * A margin note. On wide screens it floats into the right gutter, aligned to
 * its numbered marker in the prose; on narrow screens the marker becomes a
 * tap target that expands the note inline. The note is good-to-have context
 * that is deliberately kept out of the main flow so the argument stays short.
 *
 * Usage in a lesson (no import needed — registered globally in
 * src/theme/MDXComponents.js):
 *
 *   The router hands out private addresses.<Sidenote>NAT maps the many
 *   private addresses behind your router onto its single public one.</Sidenote>
 *
 * Keep the content to a sentence or two of plain prose; a sidenote is an
 * aside, not a second paragraph.
 */
export default function Sidenote({children}) {
  // useId gives a stable id across SSR and hydration; strip the colons React
  // uses so it is a valid id for the label/checkbox pairing.
  const id = 'sidenote-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <span className="sidenote-wrap">
      <input
        type="checkbox"
        id={id}
        className="sidenote-toggle"
        aria-hidden="true"
        tabIndex={-1}
      />
      <label className="sidenote-ref" htmlFor={id} aria-label="Show note" />
      <span className="sidenote" role="note">
        {children}
      </span>
    </span>
  );
}
