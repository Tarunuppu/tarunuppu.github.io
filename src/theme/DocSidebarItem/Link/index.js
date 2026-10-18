/**
 * Swizzled from @docusaurus/theme-classic's DocSidebarItem/Link.
 *
 * Building Blocks lessons use a two-part sidebar_label, "Concept: Evocative
 * title" (e.g. "Caching: Not doing the work twice"). Since sidebar_label is
 * plain text, we split it here and render the concept as a small uppercase
 * eyebrow above the evocative title, so the two read as distinct tiers.
 *
 * Scoped to /building-blocks/ links; every other sidebar item (and any label
 * without the "concept: title" shape) renders as plain text, unchanged.
 */
import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {isActiveSidebarItem} from '@docusaurus/plugin-content-docs/client';
import Link from '@docusaurus/Link';
import isInternalUrl from '@docusaurus/isInternalUrl';
import IconExternalLink from '@theme/Icon/ExternalLink';

function LinkLabel({label, href}) {
  const scoped = typeof href === 'string' && href.includes('/system-design/');
  const match =
    scoped && typeof label === 'string'
      ? label.match(/^([^:]+):\s+(.+)$/s)
      : null;
  if (!match) {
    return <span>{label}</span>;
  }
  const [, concept, title] = match;
  return (
    <span className="sidebar-label-split">
      <span className="sidebar-label-concept">{concept}</span>
      <span className="sidebar-label-title">{title}</span>
    </span>
  );
}

export default function DocSidebarItemLink({
  item,
  onItemClick,
  activePath,
  level,
  index,
  ...props
}) {
  const {href, label, className, autoAddBaseUrl} = item;
  const isActive = isActiveSidebarItem(item, activePath);
  const isInternalLink = isInternalUrl(href);
  return (
    <li
      className={clsx(
        ThemeClassNames.docs.docSidebarItemLink,
        ThemeClassNames.docs.docSidebarItemLinkLevel(level),
        'menu__list-item',
        className,
      )}
      key={label}>
      <Link
        className={clsx('menu__link', {
          'menu__link--active': isActive,
        })}
        autoAddBaseUrl={autoAddBaseUrl}
        aria-current={isActive ? 'page' : undefined}
        to={href}
        {...(isInternalLink && {
          onClick: onItemClick ? () => onItemClick(item) : undefined,
        })}
        {...props}>
        <LinkLabel label={label} href={href} />
        {!isInternalLink && <IconExternalLink />}
      </Link>
    </li>
  );
}
