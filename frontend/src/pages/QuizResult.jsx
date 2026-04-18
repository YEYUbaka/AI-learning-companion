import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { useThemeStore } from '../store/themeStore';
import { normalizeMarkdownContent } from '../utils/markdown';
import { normalizeQuizQuestions } from '../utils/quiz';

const QUESTION_TYPE_LABELS = {
  choice: '单选题',
  multiple_choice: '多选题',
  fill: '填空题',
  judge: '判断题',
  essay: '简答题',
  calculation: '计算题',
  comprehensive: '综合题',
  composition: '作文题',
};

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
};

const buildSummaryText = (percentage, wrongCount) => {
  if (percentage >= 90) {
    return '本次表现非常稳定，核心知识已经掌握得比较扎实，后续可以把重点放在速度和细节准确率上。';
  }

  if (percentage >= 75) {
    return '整体完成度不错，主要知识点已经具备，但仍有少量失分点值得集中回看和强化。';
  }

  if (percentage >= 60) {
    return '基础框架已经建立起来，不过关键题型上还有波动，建议先补齐高频错点再继续提难度。';
  }

  if (wrongCount === 0) {
    return '这次题量不大，但发挥比较稳定，可以继续尝试更高难度的测评。';
  }

  return '当前薄弱点还比较集中，建议先回到基础知识和高频题型，完成一轮针对性巩固后再复测。';
};

function QuizResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const {
    score,
    explanations = [],
    questions: rawQuestions = [],
    answers = [],
    topic = '',
    durationSeconds = 0,
    submittedAt,
  } = location.state || {};

  const palette = useMemo(
    () =>
      isDark
        ? {
            page: 'min-h-screen bg-slate-950 text-white',
            shell: 'rounded-xl border border-slate-800 bg-slate-900/88 shadow-[0_24px_90px_rgba(2,6,23,0.45)]',
            soft: 'rounded-lg border border-slate-800 bg-slate-900/78',
            mutedSoft: 'rounded-md border border-slate-800 bg-slate-950/65',
            title: 'text-slate-50',
            text: 'text-slate-300',
            muted: 'text-slate-500',
            primary: 'rounded-md bg-[#325a79] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d6b8f]',
            secondary:
              'rounded-md border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800',
            info: 'border-sky-700/40 bg-sky-500/10 text-sky-200',
            success: 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200',
            warning: 'border-amber-700/40 bg-amber-500/10 text-amber-200',
            danger: 'border-red-700/40 bg-red-500/10 text-red-200',
          }
        : {
            page: 'min-h-screen bg-slate-100 text-slate-900',
            shell: 'rounded-xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]',
            soft: 'rounded-lg border border-slate-200 bg-white',
            mutedSoft: 'rounded-md border border-slate-200 bg-slate-50/85',
            title: 'text-slate-900',
            text: 'text-slate-600',
            muted: 'text-slate-400',
            primary: 'rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700',
            secondary:
              'rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50',
            info: 'border-blue-200 bg-blue-50 text-blue-700',
            success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            warning: 'border-amber-200 bg-amber-50 text-amber-700',
            danger: 'border-red-200 bg-red-50 text-red-700',
          },
    [isDark]
  );

  const questions = useMemo(() => normalizeQuizQuestions(rawQuestions), [rawQuestions]);

  if (score === undefined && !explanations.length) {
    return (
      <div className={`${palette.page} py-10`}>
        <div className="mx-auto max-w-3xl px-4">
          <div className={`${palette.shell} p-8 text-center`}>
            <h1 className={`text-2xl font-bold ${palette.title}`}>没有找到本次测评结果</h1>
            <p className={`mt-3 text-sm ${palette.text}`}>
              可能是页面刷新后丢失了临时状态，返回测评页重新开始即可。
            </p>
            <button type="button" onClick={() => navigate('/quiz')} className={`mt-6 ${palette.primary}`}>
              返回测评页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const correctCount = explanations.filter((item) => item?.correct).length;
  const totalCount = explanations.length || questions.length || 1;
  const wrongCount = Math.max(totalCount - correctCount, 0);
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const finalScore = Number.isFinite(Number(score)) ? Number(score) : percentage;

  const wrongTypeCountMap = explanations.reduce((accumulator, item, index) => {
    if (item?.correct) return accumulator;

    const questionType = questions[index]?.type || 'other';
    const label = QUESTION_TYPE_LABELS[questionType] || '其他题型';
    accumulator[label] = (accumulator[label] || 0) + 1;

    return accumulator;
  }, {});

  const weakTypeEntries = Object.entries(wrongTypeCountMap)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);

  const weakTypes = weakTypeEntries.map(([label]) => label);
  const summaryText = buildSummaryText(percentage, wrongCount);
  const submittedText = submittedAt ? new Date(submittedAt).toLocaleString() : '刚刚完成';
  const suggestions = [
    weakTypes.length
      ? `优先回看 ${weakTypes.join('、')} 的错题和典型例题。`
      : '整体错误不集中，可以直接进入下一轮更高难度测评。',
    wrongCount > 0
      ? '把本次做错的题重新独立做一遍，再对照解析查漏补缺。'
      : '本轮没有明显失分点，可以把题量或难度再提高一档。',
    durationSeconds > 0
      ? `本次作答耗时 ${formatDuration(durationSeconds)}，下次可以继续优化节奏控制。`
      : '下次测评时建议继续保持单题作答节奏，避免来回切换影响专注。',
  ];

  const scoreTone =
    finalScore >= 85 ? palette.success : finalScore >= 60 ? palette.warning : palette.danger;
  const panelBorder = isDark ? 'border-slate-800' : 'border-slate-200';
  const panelDivider = isDark ? 'divide-slate-800' : 'divide-slate-200';
  const panelCardClass = `${palette.soft} flex h-full flex-col`;
  const panelHeaderClass = `border-b px-5 py-4 sm:px-6 ${panelBorder}`;
  const panelTitleClass = `text-lg font-semibold tracking-tight ${palette.title}`;
  const panelBodyClass = 'flex flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6';
  const panelMetaClass = `text-[11px] font-semibold uppercase tracking-[0.16em] ${palette.muted}`;
  const infoAccentClass = isDark ? 'text-sky-200' : 'text-sky-700';
  const warningAccentClass = isDark ? 'text-amber-200' : 'text-amber-700';
  const successAccentClass = isDark ? 'text-emerald-200' : 'text-emerald-700';
  const performanceStage =
    percentage >= 90
      ? '冲刺提速'
      : percentage >= 75
        ? '查漏补缺'
        : percentage >= 60
          ? '夯实基础'
          : '回归核心';

  const markdownComponents = {
    p: ({ children }) => <p className="mb-3 last:mb-0 break-words leading-7">{children}</p>,
    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
    li: ({ children }) => <li className="break-words">{children}</li>,
    table: ({ children }) => (
      <div className="my-3 max-w-full">
        <div className={`mb-2 flex items-center justify-between text-[11px] sm:hidden ${palette.muted}`}>
          <span>左右滑动查看完整表格</span>
          <span className="font-medium">表格</span>
        </div>
        <div
          className={`max-w-full overflow-x-auto overscroll-x-contain rounded-md border ${
            isDark ? 'border-slate-700 bg-slate-950/70' : 'border-slate-200 bg-white'
          }`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <table
            className={`w-max min-w-full border-collapse text-sm ${
              isDark ? 'text-slate-100' : 'text-slate-800'
            }`}
          >
            {children}
          </table>
        </div>
      </div>
    ),
    thead: ({ children }) => <thead className={isDark ? 'bg-slate-800/80' : 'bg-slate-100'}>{children}</thead>,
    tr: ({ children }) => (
      <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-slate-200'}>{children}</tr>
    ),
    th: ({ children }) => <th className="min-w-[6rem] px-3 py-2 text-left align-top font-semibold">{children}</th>,
    td: ({ children }) => <td className="min-w-[6rem] px-3 py-2 align-top break-words">{children}</td>,
    code: ({ children }) => (
      <code
        className={`rounded px-1.5 py-0.5 text-[0.92em] ${
          isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'
        }`}
      >
        {children}
      </code>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={`my-3 border-l-4 pl-4 italic ${
          isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'
        }`}
      >
        {children}
      </blockquote>
    ),
    a: ({ node, ...props }) => (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className={isDark ? 'text-blue-400 underline hover:text-blue-300' : 'text-blue-600 underline hover:text-blue-800'}
      />
    ),
  };

  return (
    <div className={`${palette.page} py-6 sm:py-10`}>
      <div className="mx-auto max-w-7xl px-4">
        <div className={`${palette.shell} p-4 sm:p-6 lg:p-8`}>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
            <div className={`${palette.soft} p-5 sm:p-7`}>
              <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>
                测评结果报告
              </div>
              <h1 className={`mt-3 text-3xl font-bold sm:text-4xl ${palette.title}`}>
                {topic || '本次 AI 测评'}
              </h1>
              <div className={`mt-4 flex flex-wrap gap-3 text-sm ${palette.text}`}>
                <span>提交时间：{submittedText}</span>
                <span>作答时长：{formatDuration(durationSeconds)}</span>
                <span>总题数：{totalCount} 题</span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className={`rounded-md border px-5 py-5 ${scoreTone}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">最终得分</div>
                  <div className="mt-4 text-5xl font-bold leading-none tracking-tight">{finalScore}</div>
                </div>
                <div className={`${palette.mutedSoft} px-5 py-5`}>
                  <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>答对题数</div>
                  <div className={`mt-4 text-5xl font-bold leading-none tracking-tight ${palette.title}`}>{correctCount}</div>
                </div>
                <div className={`${palette.mutedSoft} px-5 py-5`}>
                  <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>正确率</div>
                  <div className={`mt-4 text-5xl font-bold leading-none tracking-tight ${palette.title}`}>{percentage}%</div>
                </div>
              </div>
            </div>

            <aside className={panelCardClass}>
              <div className={panelHeaderClass}>
                <div className={panelTitleClass}>本次结论</div>
              </div>
              <div className={panelBodyClass}>
                <p className={`text-sm leading-7 ${palette.text}`}>{summaryText}</p>

                <dl className={`mt-5 divide-y border-y ${panelDivider} ${panelBorder}`}>
                  <div className="flex items-start justify-between gap-4 py-4">
                    <div>
                      <dt className={panelMetaClass}>失分情况</dt>
                      <dd className={`mt-1 text-sm ${palette.text}`}>本次失分题量</dd>
                    </div>
                    <div className={`text-xl font-semibold ${wrongCount > 0 ? infoAccentClass : palette.title}`}>
                      {wrongCount} 题
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-4">
                    <div>
                      <dt className={panelMetaClass}>重点回看</dt>
                      <dd className={`mt-1 text-sm ${palette.text}`}>优先处理的题型</dd>
                    </div>
                    <div
                      className={`max-w-[11rem] text-right text-sm font-medium leading-6 ${
                        weakTypeEntries.length ? warningAccentClass : successAccentClass
                      }`}
                    >
                      {weakTypeEntries.length ? weakTypes.join(' / ') : '暂无集中失分'}
                    </div>
                  </div>
                </dl>
              </div>
            </aside>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-3">
            <div className={panelCardClass}>
              <div className={panelHeaderClass}>
                <div className={panelTitleClass}>AI 总评</div>
              </div>
              <div className={panelBodyClass}>
                <p className={`text-sm leading-7 ${palette.text}`}>{summaryText}</p>
                <div className={`mt-5 border-t pt-4 ${panelBorder}`}>
                  <div className={panelMetaClass}>当前阶段</div>
                  <div className={`mt-2 text-sm font-medium ${palette.title}`}>{performanceStage}</div>
                </div>
              </div>
            </div>

            <div className={panelCardClass}>
              <div className={panelHeaderClass}>
                <div className={panelTitleClass}>薄弱点</div>
              </div>
              <div className={panelBodyClass}>
                {weakTypeEntries.length ? (
                  <div className={`divide-y ${panelDivider}`}>
                    {weakTypeEntries.map(([label, count], index) => (
                      <div key={label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-xs font-semibold ${palette.muted}`}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className={`text-sm font-medium ${palette.title}`}>{label}</span>
                        </div>
                        <span className={`text-sm font-medium ${warningAccentClass}`}>{count} 题</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm leading-7 ${palette.text}`}>
                    当前没有明显集中薄弱点，可以继续提高难度，或者尝试压缩作答时间。
                  </p>
                )}
              </div>
            </div>

            <div className={panelCardClass}>
              <div className={panelHeaderClass}>
                <div className={panelTitleClass}>下一步建议</div>
              </div>
              <div className={panelBodyClass}>
                <ul className={`divide-y ${panelDivider}`}>
                  {suggestions.map((item, index) => (
                    <li key={item} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <span className={`mt-0.5 w-6 text-xs font-semibold ${palette.muted}`}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={`text-sm leading-7 ${palette.text}`}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className={`text-2xl font-bold ${palette.title}`}>逐题解析</h2>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => navigate('/quiz')} className={palette.primary}>
                  再测一轮
                </button>
                <button type="button" onClick={() => navigate('/dashboard')} className={palette.secondary}>
                  返回首页
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {explanations.map((item, index) => {
                const question = questions[index] || {};
                const userAnswer = answers[index];

                return (
                  <article
                    key={`explanation-${index}`}
                    className={`rounded-md border p-5 sm:p-6 ${item?.correct ? palette.success : palette.danger}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-sm border px-3 py-1 text-xs font-semibold ${
                              item?.correct ? palette.success : palette.danger
                            }`}
                          >
                            {item?.correct ? '回答正确' : '回答错误'}
                          </span>
                          <span className={`text-sm ${palette.text}`}>
                            {QUESTION_TYPE_LABELS[question.type] || '题目'}
                          </span>
                        </div>
                        <h3 className={`mt-3 text-lg font-semibold leading-8 ${palette.title}`}>
                          {index + 1}. {item?.question || question.question || question.stem || '题目'}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className={`${palette.mutedSoft} p-4`}>
                        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${palette.muted}`}>
                          你的答案
                        </div>
                        <div className={`mt-2 text-sm leading-7 ${palette.title}`}>{userAnswer || '未作答'}</div>
                      </div>
                      <div className={`${palette.mutedSoft} p-4`}>
                        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${palette.muted}`}>
                          标准答案
                        </div>
                        <div className={`mt-2 text-sm leading-7 ${palette.title}`}>{question.answer || '未提供'}</div>
                      </div>
                    </div>

                    <div className={`${palette.mutedSoft} mt-4 p-4 sm:p-5`}>
                      <div className={`mb-3 text-sm font-semibold ${palette.title}`}>AI 解析</div>
                      <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeSanitize]}
                          components={markdownComponents}
                        >
                          {normalizeMarkdownContent(item?.explanation || '暂无解析')}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default QuizResult;
