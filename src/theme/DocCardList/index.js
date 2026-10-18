/**
 * Swizzled from @docusaurus/theme-classic's DocCardList.
 *
 * Renders a category's children as a single-column, numbered "syllabus" list
 * (see the DocCard swizzle) instead of the default two-column card grid — and
 * passes each item's ordinal index down so the cards can number themselves.
 */
import React from 'react';
import clsx from 'clsx';
import {
  useCurrentSidebarSiblings,
  filterDocCardListItems,
} from '@docusaurus/plugin-content-docs/client';
import DocCard from '@theme/DocCard';

function DocCardListForCurrentSidebarCategory({className}) {
  const items = useCurrentSidebarSiblings();
  return <DocCardList items={items} className={className} />;
}

export default function DocCardList(props) {
  const {items, className} = props;
  if (!items) {
    return <DocCardListForCurrentSidebarCategory {...props} />;
  }
  const filteredItems = filterDocCardListItems(items);
  return (
    <section className={clsx('note-cards', className)}>
      {filteredItems.map((item, index) => (
        <DocCard key={index} item={item} index={index} />
      ))}
    </section>
  );
}
