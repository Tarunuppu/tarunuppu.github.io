/**
 * Swizzled from @docusaurus/theme-classic's DocCard.
 *
 * Replaces the default emoji card with an editorial "syllabus row": an ordinal
 * number, a concept eyebrow (split from a "Concept: Title" label, as on the
 * sidebar), the evocative title, a short description, and a hover arrow. Works
 * for both doc links and sub-category links; falls back gracefully when a label
 * has no "Concept: Title" shape (then there's just a title).
 */
import React from 'react';
import Link from '@docusaurus/Link';
import {
  useDocById,
  findFirstSidebarItemLink,
} from '@docusaurus/plugin-content-docs/client';

// Split a "Concept: Title" label into an eyebrow + title, but only for
// system-design items — their sidebar labels use that shape deliberately.
// Elsewhere a colon in a title is just punctuation, so leave the title whole.
function splitLabel(label, href) {
  const scoped = typeof href === 'string' && href.includes('/system-design/');
  const m =
    scoped && typeof label === 'string'
      ? label.match(/^([^:]+):\s+(.+)$/s)
      : null;
  return m ? {eyebrow: m[1], title: m[2]} : {eyebrow: null, title: label};
}

function Card({href, number, eyebrow, title, description}) {
  return (
    <Link href={href} className="note-card">
      {number && <span className="note-card__num">{number}</span>}
      <span className="note-card__body">
        {eyebrow && <span className="note-card__eyebrow">{eyebrow}</span>}
        <span className="note-card__title">{title}</span>
        {description && <span className="note-card__desc">{description}</span>}
      </span>
      <span className="note-card__arrow" aria-hidden="true">→</span>
    </Link>
  );
}

function CardCategory({item, number}) {
  const href = findFirstSidebarItemLink(item);
  if (!href) {
    return null;
  }
  const {eyebrow, title} = splitLabel(item.label, href);
  const count = item.items?.length ?? 0;
  return (
    <Card
      href={href}
      number={number}
      eyebrow={eyebrow ?? `${count} ${count === 1 ? 'lesson' : 'lessons'}`}
      title={title}
      description={item.description}
    />
  );
}

function CardLink({item, number}) {
  const doc = useDocById(item.docId ?? undefined);
  const {eyebrow, title} = splitLabel(item.label, item.href);
  return (
    <Card
      href={item.href}
      number={number}
      eyebrow={eyebrow}
      title={title}
      description={item.description ?? doc?.description}
    />
  );
}

export default function DocCard({item, index}) {
  const number =
    typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;
  switch (item.type) {
    case 'link':
      return <CardLink item={item} number={number} />;
    case 'category':
      return <CardCategory item={item} number={number} />;
    default:
      throw new Error(`unknown item type ${JSON.stringify(item)}`);
  }
}
