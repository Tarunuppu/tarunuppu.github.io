import React from 'react';

/**
 * A row of topic chips shown directly under a lesson's title, so the reader
 * can see at a glance which concepts the lesson covers — the title sets the
 * hook, these name the substance.
 *
 * Registered globally in src/theme/MDXComponents.js, so lessons use it with no
 * import, right after the H1:
 *
 *   # What happens when you open a web page
 *
 *   <Topics tags={['DNS', 'TCP handshake', 'OSI layers', 'HTTP methods']} />
 *
 * `tags` can be an array, or a comma-separated string.
 */
export default function Topics({tags = []}) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="topics" role="list" aria-label="Topics covered in this lesson">
      {list.map((tag, i) => (
        <span className="topic" role="listitem" key={i}>
          {tag}
        </span>
      ))}
    </div>
  );
}
