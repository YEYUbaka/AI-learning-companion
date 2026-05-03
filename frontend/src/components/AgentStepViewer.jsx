import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { getAnchorProps } from '../utils/links';
import { normalizeMarkdownContent } from '../utils/markdown';
import { exportPaper } from '../api/apiClient';
import { getUserId } from '../utils/auth';
import 'katex/dist/katex.min.css';

const isWhitespace = (char) => /\s/.test(char || '');

const extractArgument = (text, start) => {
  let i = start;
  while (i < text.length && isWhitespace(text[i])) i += 1;
  if (i >= text.length) return null;

  if (text[i] === '{') {
    let depth = 0;
    let j = i;
    while (j < text.length) {
      if (text[j] === '{') depth += 1;
      else if (text[j] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      j += 1;
    }
    if (depth !== 0) return null;
    return { content: text.slice(i + 1, j), next: j + 1 };
  }

  if (text[i] === '\\') {
    let j = i + 1;
    while (j < text.length && /[A-Za-z]/.test(text[j])) j += 1;
    let content = text.slice(i, j);
    if (text[j] === '{') {
      const nested = extractArgument(text, j);
      if (nested) {
        content += `{${nested.content}}`;
        j = nested.next;
      }
    }
    return { content, next: j };
  }

  let j = i;
  while (j < text.length && !isWhitespace(text[j]) && text[j] !== '{' && text[j] !== '}') j += 1;
  return { content: text.slice(i, j), next: j };
};

const normalizeFractions = (text = '') => {
  let i = 0;
  let result = '';
  while (i < text.length) {
    if (text.startsWith('\\frac', i)) {
      const originalIndex = i;
      let cursor = i + 5;
      const numerator = extractArgument(text, cursor);
      if (!numerator) {
        result += text.slice(originalIndex, cursor);
        i = cursor;
        continue;
      }
      cursor = numerator.next;
      const denominator = extractArgument(text, cursor);
      if (!denominator) {
        result += text.slice(originalIndex, cursor);
        i = cursor;
        continue;
      }
      result += `\\frac{${numerator.content}}{${denominator.content}}`;
      i = denominator.next;
      continue;
    }
    result += text[i];
    i += 1;
  }
  return result;
};

const repairLegacyMathArtifacts = (text = '') => {
  if (!text) return text;

  let repaired = text;
  repaired = repaired.replace(
    /(\\end\{(?:aligned|align\*?|cases)\})\s*(\${3,})\s*(?=\$|[A-Za-z\u4e00-\u9fff#*-])/g,
    '$1$$$$\n\n',
  );
  repaired = repaired.replace(
    /(\\end\{(?:aligned|align\*?|cases)\}\$\$)\s*(?=\$|[A-Za-z\u4e00-\u9fff#*-])/g,
    '$1\n\n',
  );
  repaired = repaired.replace(/\${4,}/g, '$$$$');
  repaired = repaired.replace(/\$\$\s+\$(?=\\|[A-Za-z\u4e00-\u9fff])/g, '$$$$\n\n$$');
  repaired = repaired.replace(/(?<!\$)\$\s+\$(?!\$)(?=\\[A-Za-z]|[A-Za-z0-9\u4e00-\u9fff])/g, '$');
  repaired = repaired.replace(/(\$\$)\s*(---|###)/g, '$1\n\n$2');
  return repaired;
};

const normalizeAlignedBody = (body = '') =>
  normalizeFractions(String(body || ''))
    .replace(/\r\n?/g, '\n')
    .replace(/\\\\\s*&/g, '\\\\\n&')
    .replace(/(?<!\\)\\\s*&/g, '\\\\\n&')
    .trim();

const wrapDisplayMathBlock = (body, env = 'aligned') =>
  `$$\n\\begin{${env}}\n${normalizeAlignedBody(body)}\n\\end{${env}}\n$$`;

const normalizeDoubleDollarMathSegments = (text = '') => {
  if (!text) return text;

  let cursor = 0;
  let result = '';

  while (cursor < text.length) {
    const start = text.indexOf('$$', cursor);
    if (start === -1) {
      result += text.slice(cursor);
      break;
    }

    const end = text.indexOf('$$', start + 2);
    if (end === -1) {
      result += text.slice(cursor);
      break;
    }

    result += text.slice(cursor, start);

    const body = normalizeAlignedBody(text.slice(start + 2, end));
    const prevChar = result[result.length - 1] || '';
    const nextChar = text[end + 2] || '';
    const prevInline = Boolean(prevChar && prevChar !== '\n');
    const nextInline = Boolean(nextChar && nextChar !== '\n');
    const prefersBlock = /\\begin\{|\\\\|\n/.test(body);

    if (!prefersBlock && prevInline && nextInline) {
      result += `$${body}$`;
    } else if (prevInline || nextInline || prefersBlock) {
      result += `\n\n$$\n${body}\n$$\n\n`;
    } else {
      result += `$$\n${body}\n$$`;
    }

    cursor = end + 2;
  }

  return result.replace(/\n{3,}/g, '\n\n');
};

const isBareMathRunChar = (char = '') =>
  char === ' ' || char === '\t' || /[A-Za-z0-9\\{}\[\]()^_=+\-*/.,<>&]/.test(char);

const isLikelyBareMathRun = (text = '') => {
  const value = String(text || '').trim();
  if (!value) return false;

  const hasCommand = /\\[A-Za-z]+/.test(value);
  const commandCount = (value.match(/\\[A-Za-z]+/g) || []).length;
  const hasMathOperator = /[=+\-*/^_<>]/.test(value);
  const hasGrouping = /[{}()[\]]/.test(value);
  const hasPlainFunction = /\b(?:sin|cos|tan|cot|max|min|lim)\b/.test(value);
  const hasAlphaNumeric = /[A-Za-z0-9]/.test(value);

  return (
    (hasCommand && (hasMathOperator || hasGrouping || commandCount >= 2)) ||
    (!hasCommand && hasPlainFunction && hasMathOperator && hasAlphaNumeric)
  );
};

const wrapBareMathRuns = (text = '') => {
  if (!text) return text;

  const stashedSegments = [];
  const stashSegment = (value) => {
    const token = `@@MATH_SEGMENT_${stashedSegments.length}@@`;
    stashedSegments.push(value);
    return token;
  };

  let cursor = 0;
  let result = '';
  const working = text.replace(/```[\s\S]*?```|`[^`\n]+`|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$/g, stashSegment);

  while (cursor < working.length) {
    if (!isBareMathRunChar(working[cursor])) {
      result += working[cursor];
      cursor += 1;
      continue;
    }

    let end = cursor;
    while (end < working.length && isBareMathRunChar(working[end])) end += 1;

    const run = working.slice(cursor, end);
    const leadingWhitespace = run.match(/^[ \t]*/)?.[0] || '';
    const trailingWhitespace = run.match(/[ \t]*$/)?.[0] || '';
    const core = run.slice(leadingWhitespace.length, run.length - trailingWhitespace.length);

    result += isLikelyBareMathRun(core) ? `${leadingWhitespace}$${core}$${trailingWhitespace}` : run;
    cursor = end;
  }

  return result.replace(/@@MATH_SEGMENT_(\d+)@@/g, (_, index) => stashedSegments[Number(index)] || '');
};

const normalizeMathContent = (text = '') => {
  if (!text) return text;

  const stashedBlocks = [];
  const stashBlock = (value) => {
    const token = `@@MATH_BLOCK_${stashedBlocks.length}@@`;
    stashedBlocks.push(value);
    return token;
  };

  let normalized = normalizeFractions(repairLegacyMathArtifacts(text));
  normalized = normalized.replace(/\\\[(.*?)\\\]/gs, (_, inner) => `$$${inner.trim()}$$`);
  normalized = normalized.replace(/\\\((.*?)\\\)/gs, (_, inner) => `$${inner.trim()}$`);
  normalized = normalized.replace(
    /\$\$\s*\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}\s*\$\$/g,
    (_, body) => stashBlock(wrapDisplayMathBlock(body, 'aligned')),
  );
  normalized = normalized.replace(
    /\\begin\{(aligned|cases)\}([\s\S]*?)\\end\{\1\}/g,
    (_, env, body) => stashBlock(wrapDisplayMathBlock(body, env)),
  );
  normalized = normalized.replace(
    /\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
    (_, body) => stashBlock(wrapDisplayMathBlock(body, 'aligned')),
  );
  normalized = normalizeDoubleDollarMathSegments(normalized);
  normalized = normalized.replace(/\\\$/g, '$');
  normalized = wrapBareMathRuns(normalized);

  return normalized.replace(/@@MATH_BLOCK_(\d+)@@/g, (_, index) => stashedBlocks[Number(index)] || '');
};

const normalizeRenderedMarkdown = (content = '') => normalizeMathContent(normalizeMarkdownContent(content));

const buildMarkdownComponents = (isDark) => ({
  p: ({ children }) => <p className="mb-3 last:mb-0 break-words text-[15px] leading-7">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-2 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-2 pl-5">{children}</ol>,
  li: ({ children }) => <li className="break-words leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      className={`my-4 border-l-4 pl-4 italic ${
        isDark ? 'border-cyan-400/50 text-slate-300' : 'border-cyan-300 text-slate-600'
      }`}
    >
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-black/5">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-t border-black/5 px-3 py-2 align-top">{children}</td>,
  code: ({ children }) => (
    <code
      className={`rounded px-1.5 py-0.5 text-[0.92em] ${
        isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {children}
    </code>
  ),
  a: ({ node, ...props }) => (
    <a
      {...props}
      {...getAnchorProps(props.href)}
      className={`underline ${isDark ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-900'}`}
    />
  ),
});

const MessageMarkdown = ({ content, isDark, className = '' }) => {
  const markdownComponents = useMemo(() => buildMarkdownComponents(isDark), [isDark]);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
        components={markdownComponents}
      >
        {normalizeRenderedMarkdown(content || '')}
      </ReactMarkdown>
    </div>
  );
};

const AttachmentPreview = ({ attachment, isDark }) => {
  const preview = attachment?.image_url || attachment?.preview_url || attachment?.file_url || '';
  const isImage = attachment?.file_type === 'image' || attachment?.type === 'image';

  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'
      }`}
    >
      {isImage && preview ? (
        <img
          src={preview}
          alt={attachment?.file_name || attachment?.name || '附件'}
          className="h-24 w-full object-cover"
        />
      ) : (
        <div className={`flex h-24 items-center justify-center ${isDark ? 'bg-slate-900/70 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h10M7 11h10M7 15h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
        </div>
      )}
      <div className="px-3 py-2">
        <div className={`truncate text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          {attachment?.file_name || attachment?.name || '附件'}
        </div>
        <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isImage ? '图片附件' : '文件附件'}
        </div>
      </div>
    </div>
  );
};

const normalizeToolOutput = (value) => {
  if (!value || typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^[{\[]/.test(trimmed)) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const collectToolLinks = (toolOutput) => {
  if (!toolOutput || typeof toolOutput !== 'object') {
    return [];
  }

  const linkMap = new Map();
  const items = [
    ...(Array.isArray(toolOutput?.evidence) ? toolOutput.evidence : []),
    ...(Array.isArray(toolOutput?.results) ? toolOutput.results : []),
  ];

  items.forEach((item, index) => {
    const url = item?.url || item?.link || item?.source_url;
    if (!url || linkMap.has(url)) {
      return;
    }

    linkMap.set(url, {
      url,
      title: item?.title || item?.name || item?.source || `来源 ${index + 1}`,
      summary: item?.summary || item?.excerpt || item?.snippet || '',
    });
  });

  return Array.from(linkMap.values()).slice(0, 6);
};

const ToolCard = ({ tool, isDark }) => {
  const toolOutput = normalizeToolOutput(tool?.output);
  const providerSearchError = toolOutput?.provider_search_error;
  const toolLinks = collectToolLinks(toolOutput);
  const paperId = toolOutput?.paper_id;
  const inputText = JSON.stringify(tool?.input || {}, null, 2);
  const summaryText = tool?.output_summary || '';
  const [inputExpanded, setInputExpanded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const summaryPreview = summaryText.length > 180 && !summaryExpanded
    ? `${summaryText.slice(0, 180)}...`
    : summaryText;
  const inputPreview = inputText.length > 260 && !inputExpanded
    ? `${inputText.slice(0, 260)}...`
    : inputText;
  const statusClass = tool?.status === 'success'
    ? isDark
      ? 'bg-emerald-400/10 text-emerald-300'
      : 'bg-emerald-50 text-emerald-700'
    : tool?.status === 'failed'
      ? isDark
        ? 'bg-rose-400/10 text-rose-300'
        : 'bg-rose-50 text-rose-700'
      : isDark
        ? 'bg-amber-400/10 text-amber-300'
        : 'bg-amber-50 text-amber-700';

  return (
    <details
      className={`group rounded-lg border px-3 py-2.5 ${
        isDark ? 'border-white/10 bg-white/[0.025]' : 'border-slate-200/80 bg-slate-50/70'
      }`}
      open={tool?.status === 'pending' || tool?.status === 'failed'}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tool?.status === 'success' ? 'bg-emerald-500' : tool?.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`} />
          <span className={`truncate text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {tool?.tool_name || '工具调用'}
          </span>
          {toolOutput?.provider_search ? (
            <span className={`hidden rounded-md px-1.5 py-0.5 text-[11px] sm:inline-flex ${isDark ? 'bg-cyan-400/10 text-cyan-200' : 'bg-cyan-50 text-cyan-700'}`}>
              {toolOutput.provider_search}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs ${statusClass}`}>
            {tool?.status === 'success' ? '成功' : tool?.status === 'failed' ? '失败' : '执行中'}
          </span>
          <svg
            className={`h-4 w-4 transition-transform group-open:rotate-180 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </summary>

      <div className={`mt-3 border-t pt-3 ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
        <div className={`text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {tool?.status === 'pending' ? '等待工具返回结果...' : summaryPreview || '暂无结果摘要'}
        </div>
        {summaryText.length > 180 ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setSummaryExpanded((value) => !value);
            }}
            className={`mt-1 text-xs font-medium ${isDark ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-900'}`}
          >
            {summaryExpanded ? '收起摘要' : '展开摘要'}
          </button>
        ) : null}

        {providerSearchError ? (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm leading-6 ${isDark ? 'border-rose-400/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            <div className="font-medium">官方搜索失败</div>
            <div className="mt-1 break-words">
              {providerSearchError.code || 'UNKNOWN_ERROR'}: {providerSearchError.message || '未返回错误说明'}
            </div>
          </div>
        ) : null}

        {toolLinks.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {toolLinks.map((item) => (
              <a
                key={item.url}
                {...getAnchorProps(item.url)}
                className={`max-w-full truncate rounded-md border px-2.5 py-1.5 text-xs transition ${
                  isDark
                    ? 'border-white/10 bg-slate-950/50 text-slate-300 hover:border-cyan-400/30 hover:text-cyan-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-700'
                }`}
                title={item.url}
              >
                {item.title}
              </a>
            ))}
          </div>
        ) : null}

        {paperId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const userId = getUserId();
                exportPaper(paperId, userId, 'pdf', true).then((response) => {
                  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = blobUrl;
                  link.setAttribute('download', `试卷_${paperId}.pdf`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(blobUrl);
                }).catch(() => {});
              }}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                isDark
                  ? 'border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20'
                  : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              导出 PDF
            </button>
            <button
              type="button"
              onClick={() => {
                const userId = getUserId();
                exportPaper(paperId, userId, 'word', true).then((response) => {
                  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = blobUrl;
                  link.setAttribute('download', `试卷_${paperId}.docx`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(blobUrl);
                }).catch(() => {});
              }}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                isDark
                  ? 'border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20'
                  : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              导出 Word
            </button>
          </div>
        ) : null}

        <details className="mt-3">
          <summary className={`cursor-pointer text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            查看参数和完整结果
          </summary>
          <div className="mt-2 grid gap-2">
            <pre className={`max-h-64 overflow-auto rounded-lg px-3 py-2 text-xs leading-6 ${isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}`}>
              {inputPreview}
            </pre>
            {inputText.length > 260 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  setInputExpanded((value) => !value);
                }}
                className={`justify-self-start text-xs font-medium ${isDark ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-900'}`}
              >
                {inputExpanded ? '收起参数' : '展开参数'}
              </button>
            ) : null}
            {toolOutput ? (
              <pre className={`max-h-72 overflow-auto rounded-lg px-3 py-2 text-xs leading-6 ${isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}`}>
                {typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput, null, 2)}
              </pre>
            ) : null}
          </div>
        </details>
      </div>
    </details>
  );
};

const ThinkingSection = ({ message, isDark, onToggleThinking, loading }) => {
  if (!message?.thinking) {
    return null;
  }

  const isExpanded = Boolean(message?.thinking_expanded);
  const title = loading && message?.status !== 'completed' ? '思考中' : '已思考';
  const thoughtBlocks = String(message.thinking).split(/\n{2,}/).filter(Boolean);

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isDark ? 'border-white/10 bg-white/[0.025]' : 'border-slate-200/80 bg-slate-50/70'}`}>
      <button
        type="button"
        onClick={() => onToggleThinking?.(message.id)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${loading && message?.status !== 'completed' ? 'animate-pulse bg-amber-500' : 'bg-cyan-500'}`} />
          <div className={`truncate text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {title}
          </div>
          <div className={`hidden text-xs sm:block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {thoughtBlocks.length} 段
          </div>
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded ? (
        <div className={`mt-3 border-l pl-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <MessageMarkdown
            content={message.thinking}
            isDark={isDark}
            className={isDark ? 'text-slate-300' : 'text-slate-600'}
          />
        </div>
      ) : null}
    </div>
  );
};

const AssistantMessage = ({ message, isDark, loading, onToggleThinking }) => (
  <div className="flex gap-3 sm:gap-4">
    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-white/[0.06] text-cyan-200' : 'bg-slate-100 text-slate-700'}`}>
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M4 13h16M5 17h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </div>

    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Agent 助手</div>
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          第 {message?.turn_index || 1} 轮
        </span>
      </div>

      <ThinkingSection
        message={message}
        isDark={isDark}
        onToggleThinking={onToggleThinking}
        loading={loading}
      />

      {Array.isArray(message?.tool_uses) && message.tool_uses.length > 0 ? (
        <div className="space-y-2">
          {message.tool_uses.map((tool) => (
            <ToolCard key={tool.id} tool={tool} isDark={isDark} />
          ))}
        </div>
      ) : null}

      <div className="pt-1">
        {message?.content ? (
          <MessageMarkdown content={message.content} isDark={isDark} className={isDark ? 'text-slate-100' : 'text-slate-800'} />
        ) : (
          <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="inline-flex gap-1">
              <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${isDark ? 'bg-cyan-300' : 'bg-cyan-500'}`} />
              <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${isDark ? 'bg-cyan-300' : 'bg-cyan-500'}`} style={{ animationDelay: '0.12s' }} />
              <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${isDark ? 'bg-cyan-300' : 'bg-cyan-500'}`} style={{ animationDelay: '0.24s' }} />
            </span>
            <span>正在组织回答…</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const UserMessage = ({ message, isDark }) => (
  <div className="flex justify-end">
    <div className="max-w-[78%] space-y-3 sm:max-w-[68%]">
      {Array.isArray(message?.attachments) && message.attachments.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {message.attachments.map((attachment, index) => (
            <AttachmentPreview
              key={`${attachment?.file_path || attachment?.file_name || attachment?.name || 'attachment'}-${index}`}
              attachment={attachment}
              isDark={isDark}
            />
          ))}
        </div>
      ) : null}
      <div className={`rounded-lg rounded-tr-sm px-4 py-3 text-[15px] leading-7 shadow-sm ${
        isDark
          ? 'bg-cyan-500/18 text-cyan-50 ring-1 ring-cyan-300/15'
          : 'bg-[#e8f3ff] text-slate-900 ring-1 ring-cyan-100'
      }`}>
        <div className="whitespace-pre-wrap break-words">{message?.content || ''}</div>
      </div>
    </div>
  </div>
);

const AgentStepViewer = ({
  timeline,
  isDark = false,
  loading = false,
  onToggleThinking,
}) => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="max-w-lg text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl ${isDark ? 'bg-cyan-400/10 text-cyan-200' : 'bg-cyan-100 text-cyan-800'}`}>
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M4 13h16M5 17h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>开始一段新的智能体对话</h3>
          <p className={`mt-3 text-sm leading-7 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            你可以直接输入问题，也可以附带图片或文件。回答会以多轮对话形式流式展示，思考过程和工具调用都会出现在对话里。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {timeline.map((message) => (
        <div key={message.id}>
          {message.role === 'user' ? (
            <UserMessage message={message} isDark={isDark} />
          ) : (
            <AssistantMessage
              message={message}
              isDark={isDark}
              loading={loading}
              onToggleThinking={onToggleThinking}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default AgentStepViewer;
