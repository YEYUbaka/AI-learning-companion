import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useThemeStore } from '../store/themeStore';
import MathText from '../components/MathText';
import { getAnchorProps } from '../utils/links';
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
    return '这次整体发挥很稳定，核心知识点掌握得比较扎实，后续可以把重点放在速度和细节准确率上。';
  }

  if (percentage >= 75) {
    return '整体完成度不错，主要知识点已经具备，但仍有少量失分点值得集中回看和强化。';
  }

  if (percentage >= 60) {
    return '基础框架已经建立起来，不过部分知识点上还有波动，建议先补齐高频错点再继续提难度。';
  }

  if (wrongCount === 0) {
    return '这次题量不大，但发挥比较稳定，可以继续尝试更高难度的测评。';
  }

  return '当前薄弱点还比较集中，建议先回到基础知识和高频错点，完成一轮针对性巩固后再复测。';
};

const normalizeKnowledgePoints = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return [...new Set(rawValue.flatMap((item) => normalizeKnowledgePoints(item)).filter(Boolean))];
  }

  if (typeof rawValue === 'object') {
    return normalizeKnowledgePoints(
      rawValue.knowledge_points ??
        rawValue.knowledge_point ??
        rawValue.points ??
        rawValue.point ??
        rawValue.name ??
        rawValue.label ??
        rawValue.text
    );
  }

  return [...new Set(
    String(rawValue)
      .split(/[\n,，、；;/]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
};

const normalizeExplanationItem = (item = {}, question = {}, userAnswer = '') => {
  const correct = Boolean(item?.is_correct ?? item?.correct ?? false);

  return {
    ...item,
    correct,
    is_correct: correct,
    question: item?.question || question?.question || question?.stem || '',
    user_answer: item?.user_answer ?? userAnswer ?? '',
    correct_answer: item?.correct_answer ?? question?.answer ?? '',
    explanation: item?.explanation || '',
  };
};

const buildFallbackWeakPoints = (questions = [], explanations = []) => {
  const grouped = new Map();

  explanations.forEach((item, index) => {
    if (item?.correct) return;

    const question = questions[index] || {};
    const knowledgePoints = normalizeKnowledgePoints(
      item?.knowledge_points ?? item?.knowledge_point ?? question?.knowledge_points ?? question?.knowledge_point
    );

    knowledgePoints.forEach((knowledgePoint) => {
      const current = grouped.get(knowledgePoint) || {
        knowledge_point: knowledgePoint,
        reason: '该知识点相关题目出现失分，建议结合逐题解析回看核心概念、方法与易错点。',
        related_questions: [],
        count: 0,
      };

      current.count += 1;
      current.related_questions.push(index + 1);
      grouped.set(knowledgePoint, current);
    });
  });

  return [...grouped.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map(({ count, ...item }) => ({
      ...item,
      related_questions: [...new Set(item.related_questions)].sort((left, right) => left - right),
    }));
};

const normalizeWeakPoints = (rawWeakPoints = [], questions = [], explanations = []) => {
  if (Array.isArray(rawWeakPoints) && rawWeakPoints.length > 0) {
    const normalizedItems = rawWeakPoints
      .map((item) => {
        if (typeof item === 'string') {
          return {
            knowledge_point: item.trim(),
            reason: '',
            related_questions: [],
          };
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        const knowledgePoint =
          item.knowledge_point ||
          item.point ||
          item.name ||
          item.label ||
          normalizeKnowledgePoints(item.knowledge_points)[0] ||
          '';

        if (!knowledgePoint) {
          return null;
        }

        const rawRelatedQuestions = item.related_questions ?? item.question_numbers ?? item.questions ?? [];
        const relatedQuestions = Array.isArray(rawRelatedQuestions) ? rawRelatedQuestions : [];

        return {
          knowledge_point: knowledgePoint,
          reason: item.reason || item.analysis || item.description || '',
          related_questions: [...new Set(
            relatedQuestions
              .map((questionNo) => Number(questionNo))
              .filter((questionNo) => Number.isFinite(questionNo) && questionNo > 0)
          )].sort((left, right) => left - right),
        };
      })
      .filter(Boolean);

    if (normalizedItems.length > 0) {
      return normalizedItems.slice(0, 3);
    }
  }

  return buildFallbackWeakPoints(questions, explanations);
};

const normalizeNextSteps = (rawNextSteps, weakPoints = [], durationSeconds = 0) => {
  const extractedSteps = [];

  const appendSteps = (value) => {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      value.forEach(appendSteps);
      return;
    }

    String(value)
      .split(/[\n\r]+|(?<=[。！？；;])/)
      .map((item) => item.trim().replace(/^[-\d.\s、)]+/, ''))
      .filter(Boolean)
      .forEach((item) => extractedSteps.push(item));
  };

  appendSteps(rawNextSteps);

  const deduplicatedSteps = [...new Set(extractedSteps)];
  if (deduplicatedSteps.length > 0) {
    return deduplicatedSteps.slice(0, 4);
  }

  if (weakPoints.length > 0) {
    const generatedSteps = weakPoints.slice(0, 3).map(
      (item) => `优先复习“${item.knowledge_point}”相关概念、方法和典型题，并重做关联错题。`
    );

    if (durationSeconds > 0) {
      generatedSteps.push(`保持当前复盘节奏，下一轮练习时尝试在 ${formatDuration(durationSeconds)} 内提升稳定性。`);
    }

    return generatedSteps.slice(0, 4);
  }

  return ['整体表现比较稳定，下一轮可以适当提高难度，并继续保持当前答题节奏。'];
};

function QuizResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const {
    score,
    totalScore,
    correctCount: responseCorrectCount,
    totalCount: responseTotalCount,
    explanations: rawExplanations = [],
    summary,
    weakPoints: rawWeakPoints = [],
    nextSteps: rawNextSteps = [],
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
  const explanations = useMemo(
    () => rawExplanations.map((item, index) => normalizeExplanationItem(item, questions[index] || {}, answers[index])),
    [answers, questions, rawExplanations]
  );

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

  const correctCount = Number.isFinite(Number(responseCorrectCount))
    ? Number(responseCorrectCount)
    : explanations.filter((item) => item?.correct).length;
  const totalCount = Number.isFinite(Number(responseTotalCount))
    ? Number(responseTotalCount)
    : explanations.length || questions.length || 1;
  const wrongCount = Math.max(totalCount - correctCount, 0);
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const finalScore = Number.isFinite(Number(score)) ? Number(score) : percentage;
  const displayTotalScore = Number.isFinite(Number(totalScore)) ? Number(totalScore) : 100;
  const weakPoints = normalizeWeakPoints(rawWeakPoints, questions, explanations);
  const weakPointNames = weakPoints.map((item) => item.knowledge_point);
  const summaryText = summary || buildSummaryText(percentage, wrongCount);
  const submittedText = submittedAt ? new Date(submittedAt).toLocaleString() : '刚刚完成';
  const nextSteps = normalizeNextSteps(rawNextSteps, weakPoints, durationSeconds);

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
        {...getAnchorProps(props.href)}
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
                  <div className="mt-2 text-xs opacity-80">满分 {displayTotalScore}</div>
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
                      <dd className={`mt-1 text-sm ${palette.text}`}>优先处理的知识点</dd>
                    </div>
                    <div
                      className={`max-w-[11rem] text-right text-sm font-medium leading-6 ${
                        weakPointNames.length ? warningAccentClass : successAccentClass
                      }`}
                    >
                      {weakPointNames.length ? weakPointNames.join(' / ') : '暂无集中失分'}
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
                {weakPoints.length ? (
                  <div className={`space-y-3`}>
                    {weakPoints.map((item, index) => (
                      <div key={`${item.knowledge_point}-${index}`} className={`${palette.mutedSoft} p-4`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-6 text-xs font-semibold ${palette.muted}`}>
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className={`text-sm font-medium ${palette.title}`}>{item.knowledge_point}</span>
                          </div>
                          {item.related_questions?.length ? (
                            <span className={`text-xs font-medium ${warningAccentClass}`}>
                              题号 {item.related_questions.join(', ')}
                            </span>
                          ) : null}
                        </div>
                        {item.reason ? (
                          <p className={`mt-3 text-sm leading-7 ${palette.text}`}>{item.reason}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm leading-7 ${palette.text}`}>
                    当前没有明显集中的薄弱知识点，可以继续提高难度，或者尝试压缩作答时间。
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
                  {nextSteps.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
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
                const userAnswer = item?.user_answer ?? answers[index];
                const knowledgePoints = normalizeKnowledgePoints(
                  item?.knowledge_points ?? item?.knowledge_point ?? question?.knowledge_points ?? question?.knowledge_point
                );

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
                          {index + 1}. <MathText>{item?.question || question.question || question.stem || '题目'}</MathText>
                        </h3>
                        {knowledgePoints.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {knowledgePoints.map((knowledgePoint) => (
                              <span key={`${knowledgePoint}-${index}`} className={`rounded-sm border px-3 py-1 text-xs ${palette.info}`}>
                                {knowledgePoint}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className={`${palette.mutedSoft} p-4`}>
                        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${palette.muted}`}>
                          你的答案
                        </div>
                        <div className={`mt-2 text-sm leading-7 ${palette.title}`}>
                          <MathText>{String(userAnswer || '未作答')}</MathText>
                        </div>
                      </div>
                      <div className={`${palette.mutedSoft} p-4`}>
                        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${palette.muted}`}>
                          标准答案
                        </div>
                        <div className={`mt-2 text-sm leading-7 ${palette.title}`}>
                          <MathText>{String(item?.correct_answer || question.answer || '未提供')}</MathText>
                        </div>
                      </div>
                    </div>

                    <div className={`${palette.mutedSoft} mt-4 p-4 sm:p-5`}>
                      <div className={`mb-3 text-sm font-semibold ${palette.title}`}>AI 解析</div>
                      <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
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
