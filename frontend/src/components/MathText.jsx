import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { normalizeMarkdownContent } from '../utils/markdown';

const normalizeMathDelimiters = (content = '') =>
  normalizeMarkdownContent(String(content || ''))
    .replace(/\\\[(.*?)\\\]/gs, (_, inner) => `$$${inner.trim()}$$`)
    .replace(/\\\((.*?)\\\)/gs, (_, inner) => `$${inner.trim()}$`)
    .replace(/\\\$/g, '$');

function MathText({ children, className = '', as: Component = 'span' }) {
  const value = normalizeMathDelimiters(children);

  return (
    <Component className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children: paragraphChildren }) => <span>{paragraphChildren}</span>,
          a: ({ children: linkChildren }) => <span>{linkChildren}</span>,
        }}
      >
        {value}
      </ReactMarkdown>
    </Component>
  );
}

export default MathText;
