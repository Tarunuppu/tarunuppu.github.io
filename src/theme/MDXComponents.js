import MDXComponents from '@theme-original/MDXComponents';
import Sidenote from '@site/src/components/Sidenote';
import Topics from '@site/src/components/Topics';
import Updated from '@site/src/components/Updated';

// Registered globally so lessons can use <Sidenote>, <Topics> and <Updated> in
// plain .md files without an import line at the top of every lesson.
export default {
  ...MDXComponents,
  Sidenote,
  Topics,
  Updated,
};
