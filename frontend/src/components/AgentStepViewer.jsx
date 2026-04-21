/**
 * Agent 推理步骤展示组件
 */
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdownContent } from '../utils/markdown';

const STATUS_MAP = {
  pass: { label: '通过', light: 'bg-green-100 text-green-700', dark: 'bg-green-900/30 text-green-300' },
  warning: { label: '警告', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900/30 text-amber-300' },
  fail: { label: '失败', light: 'bg-red-100 text-red-700', dark: 'bg-red-900/30 text-red-300' },
  failed: { label: '失败', light: 'bg-red-100 text-red-700', dark: 'bg-red-900/30 text-red-300' },
  planned: { label: '已规划', light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-900/30 text-blue-300' },
};

const getStepExtraData = (step) => step?.extra_data || {};
const FINAL_ANSWER_PRIMARY_TITLES = new Set(['正式回答', '最终回答', '简短总结', '总结', '结论', '回答']);
const FINAL_ANSWER_TECHNICAL_TITLES = new Set(['任务目标', '证据摘要', '质量标记', '质量信息', '执行说明', '支持信息']);

const cleanSectionTitle = (title = '') => title.replace(/[：:]\s*$/, '').trim();

const rebuildMarkdownSection = (section) => {
  if (!section?.body) return '';
  return section.title ? `## ${section.title}\n${section.body}` : section.body;
};

const splitFinalAnswerContent = (content = '') => {
  const normalized = normalizeMarkdownContent(content || '').trim();
  if (!normalized) {
    return { primary: '', supporting: '', isLegacyStructured: false };
  }

  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  const matches = [...normalized.matchAll(headingRegex)];
  if (matches.length === 0) {
    return { primary: normalized, supporting: '', isLegacyStructured: false };
  }

  const sections = [];
  if (matches[0].index > 0) {
    const intro = normalized.slice(0, matches[0].index).trim();
    if (intro) {
      sections.push({ title: '', body: intro });
    }
  }

  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const bodyStart = start + match[0].length;
    const nextStart = index + 1 < matches.length ? (matches[index + 1].index ?? normalized.length) : normalized.length;
    sections.push({
      title: cleanSectionTitle(match[1]),
      body: normalized.slice(bodyStart, nextStart).trim(),
    });
  });

  const primarySection =
    sections.find((section) => FINAL_ANSWER_PRIMARY_TITLES.has(cleanSectionTitle(section.title)) && section.body) ||
    sections.find((section) => section.body && !FINAL_ANSWER_TECHNICAL_TITLES.has(cleanSectionTitle(section.title)));

  if (!primarySection) {
    return {
      primary: '',
      supporting: normalized,
      isLegacyStructured: true,
    };
  }

  const supporting = sections
    .filter((section) => section !== primarySection)
    .map(rebuildMarkdownSection)
    .filter(Boolean)
    .join('\n\n')
    .trim();

  const primary = FINAL_ANSWER_PRIMARY_TITLES.has(cleanSectionTitle(primarySection.title))
    ? primarySection.body
    : rebuildMarkdownSection(primarySection);

  return {
    primary: primary.trim(),
    supporting,
    isLegacyStructured: false,
  };
};

const AgentStepViewer = ({ steps, toolCalls, isDark = false }) => {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  // 从 sessionStorage 读取当前用户 ID，用于拼接下载链接
  const userId = (() => {
    try {
      const info = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
      return info.id || info.user_id || null;
    } catch {
      return null;
    }
  })();

  const toggleStep = (index) => {
    const next = new Set(expandedSteps);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setExpandedSteps(next);
  };

  const renderStepIcon = (stepType) => {
    const tone = {
      thought: isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-600',
      action: isDark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-600',
      observation: isDark ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-100 text-violet-600',
      final_answer: isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-600',
      goal: isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700',
    }[stepType] || (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600');

    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tone}`}>
        <span className="text-xs font-semibold">
          {stepType === 'goal' ? 'G' : stepType === 'thought' ? 'T' : stepType === 'action' ? 'A' : stepType === 'observation' ? 'O' : 'F'}
        </span>
      </div>
    );
  };

  const renderStatusBadge = (status) => {
    if (!status) return null;
    const mapped = STATUS_MAP[status] || {
      label: status,
      light: 'bg-slate-100 text-slate-700',
      dark: 'bg-slate-700 text-slate-300',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? mapped.dark : mapped.light}`}>
        {mapped.label}
      </span>
    );
  };

  const renderMeta = (step, options = {}) => {
    const { collapsible = false, summaryLabel = '证据与质量信息' } = options;
    const extra = getStepExtraData(step);
    const evidence = extra.evidence || [];

    if (!extra.trace_id && extra.confidence == null && !extra.quality_status && !extra.fallback_used && evidence.length === 0) {
      return null;
    }

    const panel = (
      <div className={`mt-3 rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex flex-wrap gap-2 items-center">
          {extra.quality_status ? renderStatusBadge(extra.quality_status) : null}
          {typeof extra.confidence === 'number' ? (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-gray-200'}`}>
              置信度 {Math.round(extra.confidence * 100)}%
            </span>
          ) : null}
          {extra.fallback_used ? (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>
              已触发回退
            </span>
          ) : null}
        </div>

        {extra.trace_id ? (
          <div className={`mt-2 text-xs font-mono break-all ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            trace_id: {extra.trace_id}
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div className="mt-3">
            <div className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              证据摘要
            </div>
            <div className="space-y-2">
              {evidence.slice(0, 5).map((item, index) => (
                <div key={`${item.summary || item.excerpt || index}-${index}`} className={`text-xs rounded-lg p-2 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-gray-200'}`}>
                  {item.summary || item.excerpt || JSON.stringify(item)}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );

    if (!collapsible) {
      return panel;
    }

    return (
      <details className="mt-4 group">
        <summary
          className={`flex cursor-pointer list-none items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            isDark
              ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60'
              : 'border-amber-200 bg-white/80 text-slate-700 hover:bg-amber-50'
          }`}
        >
          <span>{summaryLabel}</span>
          <span className={`text-xs transition-transform group-open:rotate-180 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            ▼
          </span>
        </summary>
        {panel}
      </details>
    );
  };

  const renderActionContent = (step) => {
    const extra = getStepExtraData(step);
    const toolName = extra.tool_name || step.content?.split(':')[0];
    const toolInput = extra.tool_input;
    let parsedInput = toolInput;

    if (!parsedInput) {
      const raw = step.content?.split(':').slice(1).join(':').trim();
      try {
        parsedInput = JSON.parse(raw);
      } catch {
        parsedInput = raw ? { raw } : {};
      }
    }

    return (
      <div className={`border rounded-lg p-3 ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
        <div className={`font-medium mb-2 text-sm ${isDark ? 'text-green-300' : 'text-green-800'}`}>
          工具调用: {toolName}
        </div>
        <div className={`rounded p-2 space-y-1 ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700 border border-gray-200'}`}>
          {parsedInput && typeof parsedInput === 'object' ? (
            Object.entries(parsedInput).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className={`font-mono text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {key}:
                </span>
                <span className="font-mono text-xs break-all">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </span>
              </div>
            ))
          ) : (
            <div className="font-mono text-xs break-all">{String(parsedInput || '')}</div>
          )}
        </div>
        {renderMeta(step)}
      </div>
    );
  };

  const renderObservationContent = (step) => {
    const extra = getStepExtraData(step);
    let result = extra;
    if (!result || Object.keys(result).length === 0) {
      try {
        result = JSON.parse(step.content);
      } catch {
        result = { text: step.content };
      }
    }

    const summaryBlocks = [];
    if (result.tool_name) summaryBlocks.push(['工具', result.tool_name]);
    if (result.error) summaryBlocks.push(['错误', result.error]);
    if (result.text) summaryBlocks.push(['输出摘要', result.text]);
    if (result.file_name || result.filename) summaryBlocks.push(['文件', result.file_name || result.filename]);
    if (result.session_id) summaryBlocks.push(['session_id', result.session_id]);

    const paperId = result.paper_id;
    const xmindFileName = result.file_name || result.filename;
    const isXmind = xmindFileName && (xmindFileName.endsWith('.xmind') || xmindFileName.endsWith('.zip'));

    return (
      <div className={`border rounded-lg p-3 ${isDark ? 'bg-violet-900/20 border-violet-800' : 'bg-violet-50 border-violet-200'}`}>
        <div className={`font-medium mb-2 text-sm ${isDark ? 'text-violet-300' : 'text-violet-800'}`}>
          工具结果
        </div>
        <div className="space-y-2">
          {summaryBlocks.map(([label, value]) => (
            <div key={label} className={`rounded p-2 text-xs ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700 border border-gray-200'}`}>
              <span className={`font-medium mr-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{label}:</span>
              <span className="break-all whitespace-pre-wrap">
                {typeof value === 'string' ? value.slice(0, 500) : JSON.stringify(value)}
              </span>
            </div>
          ))}
        </div>

        {/* 试卷下载按钮区域 */}
        {paperId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/quiz/paper/${paperId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
                isDark
                  ? 'border-blue-500 text-blue-400 hover:bg-blue-900/30'
                  : 'border-blue-600 text-blue-600 hover:bg-blue-50'
              }`}
            >
              查看试卷
            </a>
            {userId ? (
              <a
                href={`/api/v1/quiz/paper/${paperId}/export?user_id=${userId}&format=pdf&include_answer=true`}
                download
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  isDark
                    ? 'bg-blue-700 text-white hover:bg-blue-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                下载试卷（PDF）
              </a>
            ) : null}
          </div>
        ) : null}

        {/* XMind 文件下载按钮区域 */}
        {isXmind ? (
          <div className="mt-3">
            <a
              href={`/api/v1/learning-map/export/xmind/${result.session_id || ''}`}
              download={xmindFileName}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                isDark
                  ? 'bg-green-700 text-white hover:bg-green-600'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              下载思维导图（XMind）
            </a>
          </div>
        ) : null}

        {renderMeta(step)}
      </div>
    );
  };

  const renderDefaultContent = (step, index) => {
    const isExpanded = expandedSteps.has(index);
    const content = step.content || '';
    const isLongContent = content.length > 240;
    const displayContent = isExpanded || !isLongContent ? content : `${content.slice(0, 240)}...`;

    return (
      <div>
        <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          {displayContent}
        </div>
        {isLongContent ? (
          <button
            onClick={() => toggleStep(index)}
            className={`mt-2 text-xs underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
          >
            {isExpanded ? '收起' : '展开全部'}
          </button>
        ) : null}
        {renderMeta(step)}
      </div>
    );
  };

  const renderStepContent = (step, index) => {
    if (step.step_type === 'action') {
      return renderActionContent(step);
    }
    if (step.step_type === 'observation') {
      return renderObservationContent(step);
    }
    if (step.step_type === 'final_answer') {
      const parsedAnswer = splitFinalAnswerContent(step.content);
      const primaryContent = parsedAnswer.primary
        || '这条结果仍是旧版结构化输出，正式回答没有被单独抽离。建议重新执行一次任务，以获得新版正文展示。';

      return (
        <div
          className={`overflow-hidden rounded-2xl border p-4 shadow-sm sm:p-5 ${
            isDark
              ? 'border-amber-700/70 bg-gradient-to-br from-amber-900/30 via-slate-900 to-slate-900'
              : 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-amber-100/70'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className={`mb-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                isDark ? 'bg-amber-900/50 text-amber-200' : 'bg-amber-100 text-amber-700'
              }`}>
                Final
              </div>
              <div className={`text-lg font-semibold sm:text-xl ${isDark ? 'text-amber-100' : 'text-slate-900'}`}>
                正式回答
              </div>
              <p className={`mt-1 text-xs sm:text-sm ${isDark ? 'text-amber-200/80' : 'text-slate-600'}`}>
                这是本次任务最终交付给你的正文结果
              </p>
            </div>
            {parsedAnswer.isLegacyStructured ? (
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-500 border border-amber-200'
              }`}>
                旧版结果结构
              </span>
            ) : null}
          </div>

          <div className={`mt-4 rounded-2xl border p-4 sm:p-5 ${
            isDark ? 'border-slate-700 bg-slate-950/65' : 'border-white/90 bg-white/90 shadow-sm'
          }`}>
            <div className={`mb-3 text-xs font-medium uppercase tracking-[0.18em] ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
              Main Response
            </div>
            <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert text-slate-100' : 'text-gray-800'}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0 break-words text-[15px] leading-7">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="ml-2 break-words leading-7">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote
                      className={`my-4 border-l-4 pl-4 italic ${
                        isDark ? 'border-amber-500/60 text-slate-300' : 'border-amber-300 text-slate-600'
                      }`}
                    >
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="my-3 max-w-full">
                      <div
                        className={`mb-2 flex items-center justify-between text-[11px] sm:hidden ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        <span>左右滑动查看完整表格</span>
                        <span className="font-medium">表格</span>
                      </div>
                      <div
                        className={`max-w-full overflow-x-auto overscroll-x-contain rounded-xl border ${
                          isDark ? 'border-slate-700 bg-slate-900/40' : 'border-amber-200 bg-white/70'
                        }`}
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        <table
                          className={`w-max min-w-full border-collapse text-sm ${
                            isDark ? 'border-slate-700 text-slate-200' : 'border-amber-200 text-gray-800'
                          }`}
                        >
                          {children}
                        </table>
                      </div>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className={isDark ? 'bg-slate-800/80' : 'bg-amber-100/80'}>{children}</thead>
                  ),
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => (
                    <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-amber-200'}>{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="min-w-[6rem] px-3 py-2 text-left align-top font-semibold sm:min-w-[7rem]">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="min-w-[6rem] px-3 py-2 align-top break-words sm:min-w-[7rem]">{children}</td>
                  ),
                  code: ({ children }) => (
                    <code
                      className={`rounded px-1.5 py-0.5 text-[0.9em] ${
                        isDark ? 'bg-slate-800 text-slate-100' : 'bg-amber-100 text-amber-950'
                      }`}
                    >
                      {children}
                    </code>
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                    />
                  ),
                }}
              >
                {primaryContent}
              </ReactMarkdown>
            </div>
          </div>

          {parsedAnswer.supporting ? (
            <details className="mt-4 group">
              <summary
                className={`flex cursor-pointer list-none items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                  isDark
                    ? 'border-slate-700 bg-slate-900/45 text-slate-200 hover:bg-slate-900/65'
                    : 'border-amber-200 bg-white/80 text-slate-700 hover:bg-amber-50'
                }`}
              >
                <span>查看补充说明</span>
                <span className={`text-xs transition-transform group-open:rotate-180 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  ▼
                </span>
              </summary>
              <div className={`mt-3 rounded-2xl border p-4 ${
                isDark ? 'border-slate-700 bg-slate-950/55' : 'border-gray-200 bg-white/85'
              }`}>
                <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert text-slate-300' : 'text-gray-700'}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="ml-2 break-words">{children}</li>,
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                        />
                      ),
                    }}
                  >
                    {parsedAnswer.supporting}
                  </ReactMarkdown>
                </div>
              </div>
            </details>
          ) : null}

          {renderMeta(step, { collapsible: true })}
        </div>
      );
    }
    return renderDefaultContent(step, index);
  };

  const getStepLabel = (stepType) =>
    ({
      thought: '思考',
      action: '行动',
      observation: '观察',
      final_answer: '正式回答',
      goal: '目标',
    }[stepType] || stepType);

  const toolCallSummary = useMemo(() => toolCalls || [], [toolCalls]);

  if (!steps || steps.length === 0) {
    return (
      <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
        暂无执行步骤
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      {steps.map((step, index) => (
        <div key={`${step.step_number}-${index}`} className="flex min-w-0">
          <div className="flex flex-col items-center mr-4">
            {renderStepIcon(step.step_type)}
            {index < steps.length - 1 ? (
              <div className={`w-0.5 h-full mt-2 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
            ) : null}
          </div>

          <div className="flex-1 min-w-0 pb-6">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                步骤 {step.step_number}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
                {getStepLabel(step.step_type)}
              </span>
              {step.created_at ? (
                <span className={`text-xs ml-auto ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                  {new Date(step.created_at).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            {renderStepContent(step, index)}
          </div>
        </div>
      ))}

      {toolCallSummary.length > 0 ? (
        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
            工具调用统计
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {toolCallSummary.map((call, index) => (
              <div
                key={`${call.tool_name}-${index}`}
                className={`border rounded-lg p-3 ${
                  call.status === 'success'
                    ? isDark
                      ? 'bg-green-900/20 border-green-800'
                      : 'bg-green-50 border-green-200'
                    : isDark
                    ? 'bg-red-900/20 border-red-800'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium text-sm ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    {call.tool_name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    call.status === 'success'
                      ? isDark
                        ? 'bg-green-800 text-green-200'
                        : 'bg-green-200 text-green-800'
                      : isDark
                      ? 'bg-red-800 text-red-200'
                      : 'bg-red-200 text-red-800'
                  }`}>
                    {call.status}
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  耗时: {call.execution_time_ms || 0}ms
                </p>
                {call.error_message ? (
                  <p className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {call.error_message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AgentStepViewer;
