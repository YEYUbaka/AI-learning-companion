import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  generateQuiz as requestQuizGenerate,
  submitQuiz as requestQuizSubmit,
  regeneratePaperQuestions as requestRegeneratePaperQuestions,
  exportPaper as requestExportPaper,
} from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import MathText from '../components/MathText';
import PaperGenerator from '../components/PaperGenerator';
import { getUserId } from '../utils/auth';
import logger from '../utils/logger';
import { normalizeQuizQuestion, normalizeQuizQuestions } from '../utils/quiz';

const PAPER_STORAGE_KEY = 'zhixueban_custom_paper';
const ANSWER_STORAGE_KEY = 'zhixueban_quiz_progress';

const SOURCE_TYPE_LABELS = {
  question_bank: '本地题库',
  ai_fallback: 'AI 补题',
};

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

const buildRegularDistribution = (total, choicePercent) => {
  const safeTotal = Math.max(3, Number(total) || 5);
  const safePercent = Math.max(0, Math.min(100, Number(choicePercent) || 60));
  const choice = Math.max(0, Math.round((safeTotal * safePercent) / 100));
  const fill = Math.max(0, safeTotal - choice);
  return { choice, fill };
};

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
};

const getOptionValue = (option, index) => {
  if (typeof option === 'string') {
    const matched = option.trim().match(/^([A-Z])[\.\)、]/i);
    if (matched) {
      return matched[1].toUpperCase();
    }
  }

  if (option && typeof option === 'object' && option.value) {
    return String(option.value).toUpperCase();
  }

  return String.fromCharCode(65 + index);
};

const getOptionLabel = (option, index) => {
  if (typeof option === 'string') {
    return option;
  }

  if (option && typeof option === 'object') {
    if (option.label) return option.label;
    if (option.text) return `${getOptionValue(option, index)}. ${option.text}`;
  }

  return `${getOptionValue(option, index)}. 选项 ${index + 1}`;
};

const parseMultipleChoiceAnswer = (answer = '') =>
  String(answer)
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

const isQuestionAnswered = (question, answer) => {
  if (!question) return false;
  const normalizedQuestion = normalizeQuizQuestion(question);

  if (['choice', 'judge'].includes(normalizedQuestion.type)) {
    return Boolean(String(answer || '').trim());
  }

  if (normalizedQuestion.type === 'multiple_choice') {
    return parseMultipleChoiceAnswer(answer).length > 0;
  }

  return Boolean(String(answer || '').trim());
};

const findFirstUnansweredIndex = (questions = [], answers = []) =>
  questions.findIndex((question, index) => !isQuestionAnswered(question, answers[index]));

const normalizeAssetList = (assets) => (Array.isArray(assets) ? assets.filter(Boolean) : []);

const resolveAssetUrl = (asset) => {
  if (!asset) return null;
  if (typeof asset === 'string') return asset;

  const rawValue =
    asset.preview_url ||
    asset.image_url ||
    asset.file_url ||
    asset.url ||
    asset.file_path;

  if (!rawValue) return null;
  if (/^(https?:|data:)/.test(rawValue)) return rawValue;
  if (rawValue.startsWith('/')) return rawValue;
  if (rawValue.startsWith('uploads/')) return `/${rawValue}`;
  return rawValue;
};

const renderAssetGallery = (assets, palette, title = '题目图片') => {
  const normalizedAssets = normalizeAssetList(assets)
    .map((asset, index) => ({
      key: `${typeof asset === 'string' ? asset : asset.id || asset.file_path || index}-${index}`,
      url: resolveAssetUrl(asset),
      label:
        typeof asset === 'string'
          ? `${title} ${index + 1}`
          : asset.file_name || asset.name || `${title} ${index + 1}`,
    }))
    .filter((item) => item.url);

  if (!normalizedAssets.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className={`mb-2 text-xs font-medium ${palette.text}`}>{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {normalizedAssets.map((asset) => (
          <div key={asset.key} className="overflow-hidden rounded-md border border-black/10 bg-black/5">
            <img src={asset.url} alt={asset.label} className="max-h-80 w-full object-contain" />
          </div>
        ))}
      </div>
    </div>
  );
};

function Quiz() {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState('regular');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(8);
  const [choicePercent, setChoicePercent] = useState(60);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [paperData, setPaperData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submitSnapshot, setSubmitSnapshot] = useState(null);
  const [showQuestionOverview, setShowQuestionOverview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const regularDistribution = useMemo(
    () => buildRegularDistribution(numQuestions, choicePercent),
    [numQuestions, choicePercent]
  );

  const answeredCount = useMemo(
    () => questions.filter((question, index) => isQuestionAnswered(question, answers[index])).length,
    [answers, questions]
  );

  const unansweredCount = Math.max(questions.length - answeredCount, 0);
  const currentQuestion = questions[currentQuestionIndex] || null;
  const sourceStats = paperData?.source_stats || {};
  const coverageReport = paperData?.coverage_report || {};
  const missingRequirements = paperData?.missing_requirements || [];
  const isRegularSetupView = mode === 'regular' && questions.length === 0 && !paperData;
  const isRegularExamView = mode === 'regular' && questions.length > 0 && !paperData;

  const palette = useMemo(
    () =>
      isDark
        ? {
            page: 'min-h-screen bg-slate-950 text-white',
            shell: 'rounded-xl border border-slate-800 bg-slate-900/88 shadow-[0_24px_90px_rgba(2,6,23,0.45)]',
            soft: 'rounded-lg border border-slate-800 bg-slate-900/78',
            mutedSoft: 'rounded-md border border-slate-800 bg-slate-950/65',
            input:
              'w-full rounded-md border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-[#5b85a5] focus:ring-2 focus:ring-[#5b85a5]/25',
            primary:
              'rounded-md bg-[#325a79] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d6b8f] disabled:cursor-not-allowed disabled:opacity-60',
            secondary:
              'rounded-md border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800',
            title: 'text-slate-50',
            text: 'text-slate-300',
            muted: 'text-slate-500',
            info: 'border-sky-700/40 bg-sky-500/10 text-sky-200',
            warning: 'border-amber-700/40 bg-amber-500/10 text-amber-200',
            error: 'border-red-700/40 bg-red-500/10 text-red-200',
            optionIdle: 'border-slate-700 bg-slate-950/70 text-slate-100 hover:border-[#5b85a5] hover:bg-slate-900',
            optionActive: 'border-[#5b85a5] bg-[#132334] text-white shadow-[0_12px_30px_rgba(29,78,216,0.18)]',
            navIdle: 'border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-900',
            navCurrent: 'border-[#5b85a5] bg-[#132334] text-white',
            navDone: 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200',
            progressTrack: 'bg-slate-800',
            progressBar: 'bg-[#4d82a7]',
          }
        : {
            page: 'min-h-screen bg-slate-100 text-slate-900',
            shell: 'rounded-xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]',
            soft: 'rounded-lg border border-slate-200 bg-white',
            mutedSoft: 'rounded-md border border-slate-200 bg-slate-50/85',
            input:
              'w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15',
            primary:
              'rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60',
            secondary:
              'rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50',
            title: 'text-slate-900',
            text: 'text-slate-600',
            muted: 'text-slate-400',
            info: 'border-blue-200 bg-blue-50 text-blue-700',
            warning: 'border-amber-200 bg-amber-50 text-amber-700',
            error: 'border-red-200 bg-red-50 text-red-700',
            optionIdle: 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50/45',
            optionActive: 'border-blue-500 bg-blue-50 text-blue-700 shadow-[0_12px_30px_rgba(37,99,235,0.10)]',
            navIdle: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            navCurrent: 'border-blue-500 bg-blue-600 text-white',
            navDone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            progressTrack: 'bg-slate-200',
            progressBar: 'bg-blue-600',
          },
    [isDark]
  );

  const getElapsedSecondsSnapshot = (anchorStartTime = startTime, fallbackElapsedSeconds = elapsedSeconds) => {
    if (anchorStartTime) {
      return Math.max(0, Math.floor((Date.now() - anchorStartTime) / 1000));
    }

    return Math.max(0, Math.floor(fallbackElapsedSeconds || 0));
  };

  const syncProgress = (
    nextAnswers,
    nextIndex = currentQuestionIndex,
    nextStartTime = startTime,
    nextElapsedSeconds = getElapsedSecondsSnapshot(nextStartTime)
  ) => {
    if (!isRegularExamView) return;

    sessionStorage.setItem(
      ANSWER_STORAGE_KEY,
      JSON.stringify({
        topic,
        questions,
        answers: nextAnswers,
        startTime: nextStartTime,
        elapsedSeconds: nextElapsedSeconds,
        currentQuestionIndex: nextIndex,
      })
    );
  };

  const handleAnswerChange = (index, value) => {
    const nextAnswers = [...answers];
    nextAnswers[index] = value;
    setAnswers(nextAnswers);
    syncProgress(nextAnswers, currentQuestionIndex, startTime, getElapsedSecondsSnapshot());
  };

  const handleToggleMultipleChoice = (index, optionValue) => {
    const currentValues = new Set(parseMultipleChoiceAnswer(answers[index]));
    if (currentValues.has(optionValue)) {
      currentValues.delete(optionValue);
    } else {
      currentValues.add(optionValue);
    }
    const nextValue = Array.from(currentValues).sort().join(',');
    handleAnswerChange(index, nextValue);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      const message = '测评知识点不能为空';
      setError(message);
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessage('AI 正在生成本次测评，请稍候...');

    try {
      const response = await requestQuizGenerate({
        topic,
        num_questions: numQuestions,
        question_type_distribution: regularDistribution,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || '生成测评失败');
      }

      const nextQuestions = normalizeQuizQuestions(response.data.questions || []);
      const nextAnswers = new Array(nextQuestions.length).fill('');
      const nextStartTime = Date.now();

      setQuestions(nextQuestions);
      setAnswers(nextAnswers);
      setStartTime(nextStartTime);
      setElapsedSeconds(0);
      setSubmitSnapshot(null);
      setCurrentQuestionIndex(0);
      setShowQuestionOverview(false);
      setStatusMessage('测评已生成，可以开始作答了。');
      sessionStorage.removeItem(PAPER_STORAGE_KEY);
      sessionStorage.setItem(
        ANSWER_STORAGE_KEY,
        JSON.stringify({
          topic,
          questions: nextQuestions,
          answers: nextAnswers,
          startTime: nextStartTime,
          elapsedSeconds: 0,
          currentQuestionIndex: 0,
        })
      );
    } catch (err) {
      logger.error('生成测评失败', err);
      setError(err.response?.data?.detail || err.response?.data?.message || err.message || '生成测评失败');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const firstUnanswered = findFirstUnansweredIndex(questions, answers);
    if (firstUnanswered !== -1) {
      const confirmed = window.confirm(`还有 ${unansweredCount} 题未作答，确定现在交卷吗？`);
      if (!confirmed) {
        setCurrentQuestionIndex(firstUnanswered);
        setShowQuestionOverview(true);
        return;
      }
    }

    const frozenElapsedSeconds = getElapsedSecondsSnapshot();
    const previousStartTime = startTime;

    setElapsedSeconds(frozenElapsedSeconds);
    setStartTime(null);
    setSubmitSnapshot({
      frozenElapsedSeconds,
      previousStartTime,
    });
    setSubmitting(true);
    setError('');
    setStatusMessage('AI 正在统一批改并生成复盘建议...');

    try {
      const response = await requestQuizSubmit({
        user_id: getUserId(),
        topic,
        questions,
        answers,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || '提交测评失败');
      }

      sessionStorage.removeItem(ANSWER_STORAGE_KEY);
      setSubmitSnapshot(null);
      navigate('/quiz-result', {
        state: {
          score: response.data.score,
          totalScore: response.data.total_score,
          correctCount: response.data.correct_count,
          totalCount: response.data.total_count,
          explanations: response.data.explanations,
          summary: response.data.summary,
          weakPoints: response.data.weak_points,
          nextSteps: response.data.next_steps,
          questions,
          answers,
          topic,
          durationSeconds: frozenElapsedSeconds,
          submittedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.error('提交测评失败', err);
      setError(err.response?.data?.detail || err.response?.data?.message || err.message || '提交测评失败');
      setSubmitting(false);
      setStatusMessage('');
    }
  };

  const handleReset = () => {
    setMode('regular');
    setTopic('');
    setNumQuestions(8);
    setChoicePercent(60);
    setQuestions([]);
    setAnswers([]);
    setPaperData(null);
    setCurrentQuestionIndex(0);
    setStartTime(null);
    setElapsedSeconds(0);
    setSubmitSnapshot(null);
    setShowQuestionOverview(false);
    setError('');
    setStatusMessage('');
    sessionStorage.removeItem(ANSWER_STORAGE_KEY);
    sessionStorage.removeItem(PAPER_STORAGE_KEY);
  };

  const handlePaperGenerated = (data) => {
    const nextQuestions = normalizeQuizQuestions(data.questions || []);
    setPaperData(data);
    setQuestions(nextQuestions);
    setAnswers(new Array(nextQuestions.length).fill(''));
    setMode('custom');
    setError('');
    setStatusMessage('试卷已生成，可以继续预览、导出或重生不合格题目。');
  };

  const handleExportPaper = async (format = 'pdf') => {
    if (!paperData?.paper_id) return;

    try {
      const userId = getUserId();
      const response = await requestExportPaper(paperData.paper_id, userId, format, true);

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const extension = format === 'word' ? 'docx' : format;
      link.href = blobUrl;
      link.setAttribute('download', `试卷_${paperData.paper_id}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      logger.error('导出试卷失败', err);
      setError(err.response?.data?.detail || err.message || '导出试卷失败');
    }
  };

  const handleRegenerateFailedQuestions = async () => {
    if (!paperData?.paper_id) return;

    const failedQuestionIds = [
      ...new Set(
        (paperData.quality_report?.warnings || [])
          .map((warning) => warning.question_id)
          .filter(Boolean)
      ),
    ];

    if (failedQuestionIds.length === 0) {
      setStatusMessage('当前没有需要重生的题目。');
      return;
    }

    try {
      setRegenerating(true);
      setError('');
      setStatusMessage('正在重生审核不通过的题目...');
      const response = await requestRegeneratePaperQuestions(paperData.paper_id, {
        user_id: getUserId(),
        question_ids: failedQuestionIds,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || '重生题目失败');
      }

      const normalizedQuestions = normalizeQuizQuestions(response.data.questions || []);
      setPaperData(response.data);
      setQuestions(normalizedQuestions);
      setStatusMessage(
        response.data.regenerated_question_ids?.length
          ? `已重生题目：${response.data.regenerated_question_ids.join('、')}`
          : '审核结果已刷新。'
      );
    } catch (err) {
      logger.error('重生题目失败', err);
      setError(err.response?.data?.detail || err.response?.data?.message || err.message || '重生题目失败');
      setStatusMessage('');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    const cachedPaper = sessionStorage.getItem(PAPER_STORAGE_KEY);
    if (cachedPaper) {
      try {
        const parsed = JSON.parse(cachedPaper);
        if (parsed?.questions) {
          setPaperData(parsed);
          const normalizedQuestions = normalizeQuizQuestions(parsed.questions);
          setQuestions(normalizedQuestions);
          setAnswers(new Array(normalizedQuestions.length).fill(''));
          setMode('custom');
          return;
        }
      } catch (err) {
        logger.warn('加载缓存试卷失败', err);
        sessionStorage.removeItem(PAPER_STORAGE_KEY);
      }
    }

    const savedProgress = sessionStorage.getItem(ANSWER_STORAGE_KEY);
    if (!savedProgress) return;

    try {
      const parsed = JSON.parse(savedProgress);
      if (parsed?.questions?.length) {
        const normalizedQuestions = normalizeQuizQuestions(parsed.questions || []);
        const hasInvalidChoiceOptions = normalizedQuestions.some(
          (question) =>
            ['choice', 'multiple_choice'].includes(question?.type) &&
            (!Array.isArray(question.options) || question.options.length === 0)
        );

        if (hasInvalidChoiceOptions) {
          sessionStorage.removeItem(ANSWER_STORAGE_KEY);
          setStatusMessage('检测到旧试题缓存不可继续作答，请重新生成本次测评。');
          return;
        }

        setMode('regular');
        setTopic(parsed.topic || '');
        setQuestions(normalizedQuestions);
        setAnswers(parsed.answers || new Array(normalizedQuestions.length).fill(''));
        const restoredElapsedSeconds = Math.max(0, Number(parsed.elapsedSeconds) || 0);
        const restoredStartTime =
          parsed.startTime || Date.now() - restoredElapsedSeconds * 1000;
        setElapsedSeconds(restoredElapsedSeconds);
        setStartTime(restoredStartTime);
        setSubmitSnapshot(null);
        setCurrentQuestionIndex(Math.min(parsed.currentQuestionIndex || 0, Math.max(normalizedQuestions.length - 1, 0)));
      }
    } catch (err) {
      logger.warn('加载答题进度失败', err);
      sessionStorage.removeItem(ANSWER_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (paperData) {
      sessionStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(paperData));
    } else {
      sessionStorage.removeItem(PAPER_STORAGE_KEY);
    }
  }, [paperData]);

  useEffect(() => {
    if (!isRegularExamView || !startTime) return undefined;

    setElapsedSeconds(getElapsedSecondsSnapshot(startTime));
    const timer = window.setInterval(() => {
      setElapsedSeconds(getElapsedSecondsSnapshot(startTime));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRegularExamView, startTime]);

  useEffect(() => {
    if (!isRegularExamView) return;
    syncProgress(answers, currentQuestionIndex, startTime, getElapsedSecondsSnapshot());
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (submitting || !submitSnapshot || startTime || !error) return;

    const resumedStartTime =
      submitSnapshot.previousStartTime ||
      Date.now() - Math.max(0, submitSnapshot.frozenElapsedSeconds) * 1000;

    setElapsedSeconds(submitSnapshot.frozenElapsedSeconds);
    setStartTime(resumedStartTime);
    syncProgress(answers, currentQuestionIndex, resumedStartTime, submitSnapshot.frozenElapsedSeconds);
    setSubmitSnapshot(null);
  }, [answers, currentQuestionIndex, error, startTime, submitSnapshot, submitting]);

  const renderQuestionInput = (question, index) => {
    if (!question) return null;
    const normalizedQuestion = normalizeQuizQuestion(question);

    if (
      ['choice', 'multiple_choice'].includes(normalizedQuestion.type) &&
      (!Array.isArray(normalizedQuestion.options) || normalizedQuestion.options.length === 0)
    ) {
      return (
        <div className={`rounded-md border px-4 py-4 text-sm leading-7 ${palette.warning}`}>
          这道题的选项未能正常加载，请返回测评首页重新生成本次测评。
        </div>
      );
    }

    if (normalizedQuestion.type === 'choice') {
      return (
        <div className="space-y-3">
          {(normalizedQuestion.options || []).map((option, optionIndex) => {
            const optionValue = getOptionValue(option, optionIndex);
            const active = answers[index] === optionValue;
            return (
              <button
                key={`${optionValue}-${optionIndex}`}
                type="button"
                onClick={() => handleAnswerChange(index, optionValue)}
                className={`flex w-full items-start gap-3 rounded-md border px-4 py-4 text-left transition ${active ? palette.optionActive : palette.optionIdle}`}
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-sm font-semibold">
                  {optionValue}
                </span>
                <MathText className="text-sm leading-7">{getOptionLabel(option, optionIndex)}</MathText>
              </button>
            );
          })}
        </div>
      );
    }

    if (normalizedQuestion.type === 'multiple_choice') {
      const selectedValues = new Set(parseMultipleChoiceAnswer(answers[index]));
      return (
        <div className="space-y-3">
          {(normalizedQuestion.options || []).map((option, optionIndex) => {
            const optionValue = getOptionValue(option, optionIndex);
            const active = selectedValues.has(optionValue);
            return (
              <button
                key={`${optionValue}-${optionIndex}`}
                type="button"
                onClick={() => handleToggleMultipleChoice(index, optionValue)}
                className={`flex w-full items-start gap-3 rounded-md border px-4 py-4 text-left transition ${active ? palette.optionActive : palette.optionIdle}`}
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-sm font-semibold">
                  {optionValue}
                </span>
                <MathText className="text-sm leading-7">{getOptionLabel(option, optionIndex)}</MathText>
              </button>
            );
          })}
        </div>
      );
    }

    if (normalizedQuestion.type === 'judge') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {['正确', '错误'].map((value) => {
            const active = answers[index] === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleAnswerChange(index, value)}
                className={`rounded-md border px-4 py-4 text-left text-sm font-semibold transition ${active ? palette.optionActive : palette.optionIdle}`}
              >
                {value}
              </button>
            );
          })}
        </div>
      );
    }

    const isLongForm = ['essay', 'calculation', 'comprehensive', 'composition'].includes(normalizedQuestion.type);
    return isLongForm ? (
      <textarea
        value={answers[index] || ''}
        onChange={(event) => handleAnswerChange(index, event.target.value)}
        rows={8}
        placeholder="请输入你的答案"
        className={`${palette.input} resize-y`}
      />
    ) : (
      <input
        type="text"
        value={answers[index] || ''}
        onChange={(event) => handleAnswerChange(index, event.target.value)}
        placeholder="请输入你的答案"
        className={palette.input}
      />
    );
  };

  return (
    <div className={`${palette.page} py-6 sm:py-10`}>
      <div className="mx-auto max-w-7xl px-4">
        <div className={`${palette.shell} overflow-hidden p-4 sm:p-6 lg:p-8`}>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {questions.length === 0 && !paperData ? (
              <>
                <button type="button" onClick={() => setMode('regular')} className={mode === 'regular' ? palette.primary : palette.secondary}>
                  常规测评
                </button>
                <button type="button" onClick={() => setMode('custom')} className={mode === 'custom' ? palette.primary : palette.secondary}>
                  智能组卷
                </button>
              </>
            ) : (
              <button type="button" onClick={handleReset} className={palette.secondary}>
                返回测评首页
              </button>
            )}
          </div>

          {statusMessage ? <div className={`mb-5 rounded-md border px-4 py-3 text-sm ${palette.info}`}>{statusMessage}</div> : null}
          {error ? <div className={`mb-5 rounded-md border px-4 py-3 text-sm ${palette.error}`}>{error}</div> : null}

          {mode === 'custom' && questions.length === 0 && !paperData ? (
            <PaperGenerator onPaperGenerated={handlePaperGenerated} onCancel={() => setMode('regular')} />
          ) : null}

          {isRegularSetupView ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
              <section className={`${palette.soft} p-5 sm:p-7`}>
                <div className="max-w-2xl">
                  <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>常规测评</div>
                  <h1 className={`mt-3 text-3xl font-bold sm:text-4xl ${palette.title}`}>开始测评</h1>
                  <p className={`mt-4 text-sm leading-7 sm:text-base ${palette.text}`}>
                    输入测评知识点后生成试题，完成作答即可查看结果与解析。
                  </p>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className={`mb-2 block text-sm font-medium ${palette.title}`}>测评知识点</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleGenerate();
                        }
                      }}
                      placeholder="例如：高一函数基础、Python 面向对象、英语时态综合训练"
                      className={palette.input}
                    />
                  </div>

                  <div className={`${palette.mutedSoft} p-4 sm:p-5`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={palette.title}>题目数量</span>
                      <span className="font-semibold">{numQuestions} 题</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="20"
                      value={numQuestions}
                      onChange={(event) => setNumQuestions(parseInt(event.target.value, 10) || 8)}
                      className="mt-3 w-full"
                    />
                  </div>

                  <div className={`${palette.mutedSoft} p-4 sm:p-5`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={palette.title}>选择题占比</span>
                      <span className="font-semibold">{choicePercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="10"
                      value={choicePercent}
                      onChange={(event) => setChoicePercent(parseInt(event.target.value, 10) || 60)}
                      className="mt-3 w-full"
                    />
                    <p className={`mt-3 text-xs ${palette.text}`}>
                      当前结构：单选题 {regularDistribution.choice} 道，填空/主观题 {regularDistribution.fill} 道。
                    </p>
                  </div>

                  <button type="button" onClick={handleGenerate} disabled={loading} className={palette.primary}>
                    {loading ? '正在生成测评...' : '开始测评'}
                  </button>
                </div>
              </section>

              <aside className={`${palette.mutedSoft} p-5 sm:p-6`}>
                <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>完成后可查看</div>
                <div className="mt-4 space-y-4">
                  {[
                    { title: '测评得分', desc: '包含正确率与用时' },
                    { title: '错题解析', desc: '逐题查看答案与讲解' },
                    { title: '学习建议', desc: '根据表现生成复习方向' },
                  ].map((item, index) => (
                    <div key={item.title} className={`${palette.soft} flex items-start gap-3 p-4`}>
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{index + 1}</span>
                      <div>
                        <div className={`text-sm font-semibold ${palette.title}`}>{item.title}</div>
                        <p className={`mt-1 text-xs leading-6 ${palette.text}`}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          ) : null}

          {isRegularExamView ? (
            <div className="space-y-5">
              <section className={`${palette.soft} p-4 sm:p-5`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>考试进行中</div>
                    <h2 className={`mt-2 text-2xl font-bold ${palette.title}`}>{topic}</h2>
                    <p className={`mt-2 text-sm ${palette.text}`}>已完成 {answeredCount}/{questions.length} 题，当前第 {currentQuestionIndex + 1} 题。</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                    <div className={`${palette.mutedSoft} p-3`}>
                      <div className={`text-xs ${palette.muted}`}>完成进度</div>
                      <div className={`mt-1 text-lg font-semibold ${palette.title}`}>{Math.round((answeredCount / questions.length) * 100) || 0}%</div>
                    </div>
                    <div className={`${palette.mutedSoft} p-3`}>
                      <div className={`text-xs ${palette.muted}`}>已用时间</div>
                      <div className={`mt-1 text-lg font-semibold ${palette.title}`}>{formatDuration(elapsedSeconds)}</div>
                    </div>
                    <div className={`${palette.mutedSoft} p-3`}>
                      <div className={`text-xs ${palette.muted}`}>未作答</div>
                      <div className={`mt-1 text-lg font-semibold ${palette.title}`}>{unansweredCount} 题</div>
                    </div>
                  </div>
                </div>

                <div className={`mt-4 h-2 overflow-hidden rounded-full ${palette.progressTrack}`}>
                  <div className={`h-full rounded-full ${palette.progressBar}`} style={{ width: `${(answeredCount / questions.length) * 100 || 0}%` }} />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setShowQuestionOverview((prev) => !prev)} className={`${palette.secondary} lg:hidden`}>
                    {showQuestionOverview ? '收起题号面板' : '查看题号面板'}
                  </button>
                  <button type="button" onClick={handleSubmit} disabled={submitting} className={palette.primary}>
                    {submitting ? '正在交卷...' : '提交并生成复盘'}
                  </button>
                </div>
              </section>

              {showQuestionOverview ? (
                <section className={`${palette.mutedSoft} p-4 lg:hidden`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`text-sm font-semibold ${palette.title}`}>题号导航</div>
                    <div className={`text-xs ${palette.text}`}>已答题会高亮</div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((question, index) => {
                      const answered = isQuestionAnswered(question, answers[index]);
                      const activeClass = index === currentQuestionIndex ? palette.navCurrent : answered ? palette.navDone : palette.navIdle;
                      return (
                        <button
                          key={`mobile-nav-${index}`}
                          type="button"
                          onClick={() => {
                            setCurrentQuestionIndex(index);
                            setShowQuestionOverview(false);
                          }}
                          className={`rounded-sm border px-3 py-3 text-sm font-semibold transition ${activeClass}`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <section className={`${palette.soft} p-5 sm:p-7`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-sm border px-3 py-1 text-xs font-semibold ${palette.info}`}>{QUESTION_TYPE_LABELS[currentQuestion?.type] || '题目'}</span>
                    <span className={`text-sm ${palette.text}`}>第 {currentQuestionIndex + 1} / {questions.length} 题</span>
                  </div>

                  <div className={`mt-5 text-xl font-semibold leading-9 sm:text-2xl ${palette.title}`}>
                    <MathText>{currentQuestion?.question || currentQuestion?.stem || '题目加载中'}</MathText>
                  </div>

                  {renderAssetGallery(currentQuestion?.question_images, palette)}
                  <div className="mt-6">{renderQuestionInput(currentQuestion, currentQuestionIndex)}</div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={currentQuestionIndex === 0}
                      className={palette.secondary}
                    >
                      上一题
                    </button>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={handleSubmit} disabled={submitting} className={palette.secondary}>
                        {submitting ? '交卷中...' : '现在交卷'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentQuestionIndex === questions.length - 1) {
                            void handleSubmit();
                            return;
                          }
                          setCurrentQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1));
                        }}
                        className={palette.primary}
                      >
                        {currentQuestionIndex === questions.length - 1 ? '完成并交卷' : '下一题'}
                      </button>
                    </div>
                  </div>
                </section>

                <aside className={`${palette.mutedSoft} hidden h-fit p-4 lg:block lg:sticky lg:top-6`}>
                  <div className={`text-sm font-semibold ${palette.title}`}>题号导航</div>
                  <p className={`mt-1 text-xs leading-6 ${palette.text}`}>点击题号可直接切换到对应题目。</p>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {questions.map((question, index) => {
                      const answered = isQuestionAnswered(question, answers[index]);
                      const activeClass = index === currentQuestionIndex ? palette.navCurrent : answered ? palette.navDone : palette.navIdle;
                      return (
                        <button
                          key={`desktop-nav-${index}`}
                          type="button"
                          onClick={() => setCurrentQuestionIndex(index)}
                          className={`rounded-sm border px-3 py-3 text-sm font-semibold transition ${activeClass}`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </div>
          ) : null}

          {paperData ? (
            <div className="space-y-5">
              <section className={`${palette.soft} p-5 sm:p-6`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${palette.muted}`}>智能组卷工作台</div>
                    <h2 className={`mt-2 text-2xl font-bold ${palette.title}`}>{paperData.title || '试卷预览'}</h2>
                    <p className={`mt-2 text-sm ${palette.text}`}>{paperData.total_questions || questions.length} 道题 · 总分 {paperData.total_score || '--'} 分</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => handleExportPaper('pdf')} className={palette.primary}>
                      导出 PDF
                    </button>
                    <button type="button" onClick={() => handleExportPaper('word')} className={palette.secondary}>
                      导出 Word
                    </button>
                  </div>
                </div>
              </section>

              {paperData.blueprint ? (
                <section className={`${palette.mutedSoft} p-5 sm:p-6`}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className={`text-xs ${palette.muted}`}>组卷模式</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{paperData.blueprint.mode || '--'}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${palette.muted}`}>来源策略</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{paperData.blueprint.source_policy || '--'}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${palette.muted}`}>考试时长</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{paperData.blueprint.time_limit || '--'} 分钟</div>
                    </div>
                  </div>
                  {paperData.blueprint.knowledge_points?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {paperData.blueprint.knowledge_points.map((item, index) => (
                        <span key={`${item}-${index}`} className={`rounded-sm border px-3 py-1.5 text-sm ${palette.info}`}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {(paperData.source_stats || paperData.coverage_report) ? (
                <section className={`${palette.mutedSoft} p-5 sm:p-6`}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className={`text-xs ${palette.muted}`}>本地题数量</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{sourceStats.local_question_bank ?? 0}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${palette.muted}`}>AI 兜底数量</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{sourceStats.ai_fallback ?? 0}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${palette.muted}`}>考点覆盖率</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>
                        {coverageReport.requested_knowledge_points?.length
                          ? `${coverageReport.covered_knowledge_points?.length || 0}/${coverageReport.requested_knowledge_points.length}`
                          : '--'}
                      </div>
                    </div>
                  </div>

                  {sourceStats.by_source_type && Object.keys(sourceStats.by_source_type).length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(sourceStats.by_source_type).map(([key, value]) => (
                        <span key={key} className={`rounded-sm border px-3 py-1.5 text-sm ${palette.info}`}>
                          {SOURCE_TYPE_LABELS[key] || key}: {value}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {coverageReport.covered_knowledge_points?.length ? (
                    <div className="mt-4">
                      <div className={`mb-2 text-xs ${palette.muted}`}>已覆盖考点</div>
                      <div className="flex flex-wrap gap-2">
                        {coverageReport.covered_knowledge_points.map((item, index) => (
                          <span key={`covered-${item}-${index}`} className={`rounded-sm border px-3 py-1.5 text-sm ${palette.info}`}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {coverageReport.missing_knowledge_points?.length ? (
                    <div className="mt-4">
                      <div className={`mb-2 text-xs ${palette.muted}`}>仍需补足的考点</div>
                      <div className="flex flex-wrap gap-2">
                        {coverageReport.missing_knowledge_points.map((item, index) => (
                          <span key={`missing-point-${item}-${index}`} className={`rounded-sm border px-3 py-1.5 text-sm ${palette.warning}`}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {missingRequirements.length ? (
                <section className={`${palette.mutedSoft} p-5 sm:p-6`}>
                  <div className={`text-lg font-semibold ${palette.title}`}>缺口说明</div>
                  <div className="mt-4 space-y-2">
                    {missingRequirements.slice(0, 8).map((item, index) => (
                      <div key={`missing-${item.question_id || index}`} className={`rounded-md border px-4 py-3 text-sm ${palette.warning}`}>
                        {(item.question_id || `缺口 ${index + 1}`)} · {item.question_type || 'unknown'} · {item.difficulty || 'medium'}
                        {item.knowledge_points?.length ? ` · ${item.knowledge_points.join(' / ')}` : ''}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {paperData.quality_report ? (
                <section className={`${palette.mutedSoft} p-5 sm:p-6`}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className={`text-xs ${palette.muted}`}>质量状态</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{paperData.quality_report.quality_status || '待审核'}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${palette.muted}`}>质量分</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{paperData.quality_report.score ?? '--'}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${palette.muted}`}>重复率</div>
                      <div className={`mt-1 text-xl font-semibold ${palette.title}`}>{paperData.quality_report.duplicate_rate ?? '--'}</div>
                    </div>
                  </div>

                  {paperData.quality_report.warnings?.length ? (
                    <div className="mt-4 space-y-2">
                      {paperData.quality_report.warnings.slice(0, 6).map((warning, index) => (
                        <div key={`warning-${index}`} className={`rounded-md border px-4 py-3 text-sm ${palette.warning}`}>
                          {warning.question_id ? `[${warning.question_id}] ` : ''}
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {paperData.quality_report?.warnings?.some((warning) => warning.question_id) ? (
                    <button type="button" onClick={handleRegenerateFailedQuestions} disabled={regenerating} className={`mt-4 ${palette.primary}`}>
                      {regenerating ? '重生中...' : '重生不合格题目'}
                    </button>
                  ) : null}
                </section>
              ) : null}

              {questions.length ? (
                <section className={`${palette.soft} p-5 sm:p-6`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className={`text-lg font-semibold ${palette.title}`}>试卷题目预览</div>
                      <p className={`mt-1 text-sm ${palette.text}`}>保留题目浏览，方便你检查结构、题型和导出前的整体观感。</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {questions.map((question, index) => (
                      <div key={`paper-question-${index}`} className={`${palette.mutedSoft} p-4`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-sm border px-3 py-1 text-xs font-semibold ${palette.info}`}>
                            {QUESTION_TYPE_LABELS[question.type] || '题目'}
                          </span>
                          {question.points ? <span className={`text-xs ${palette.text}`}>{question.points} 分</span> : null}
                        </div>
                        <div className={`mt-3 text-sm font-semibold leading-7 ${palette.title}`}>
                          {index + 1}. <MathText>{question.question || question.stem || '题目'}</MathText>
                        </div>
                        {renderAssetGallery(question.question_images, palette)}
                        {question.options?.length ? (
                          <div className="mt-3 grid gap-2">
                            {question.options.map((option, optionIndex) => (
                              <div key={`paper-option-${index}-${optionIndex}`} className={`rounded-sm border px-4 py-3 text-sm ${palette.info}`}>
                                <MathText>{getOptionLabel(option, optionIndex)}</MathText>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Quiz;
