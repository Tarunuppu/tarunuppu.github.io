import MDXComponents from '@theme-original/MDXComponents';
import Sidenote from '@site/src/components/Sidenote';
import Topics from '@site/src/components/Topics';

// Registered globally so lessons can use <Sidenote> and <Topics> in plain .md
// files without an import line at the top of every lesson.
export default {
  ...MDXComponents,
  Sidenote,
  Topics,
};
