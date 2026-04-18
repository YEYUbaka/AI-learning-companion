/**
 * 智能组卷组件
 * 目的：提供更贴合学科场景的组卷配置界面
 */
import { useEffect, useMemo, useState } from 'react';
import {
  listTemplates,
  createTemplate,
  getRecommendedTemplate,
  deleteTemplate,
  generatePaper as requestGeneratePaper,
} from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import { getUserId } from '../utils/auth';
import logger from '../utils/logger';

const GRADE_OPTIONS = ['小学', '初中', '高中', '大学'];
const ALL_QUESTION_TYPE_KEYS = ['choice', 'multiple_choice', 'fill', 'judge', 'essay', 'calculation', 'comprehensive', 'composition'];

const QUESTION_TYPES = [
  { key: 'choice', label: '单选题' },
  { key: 'multiple_choice', label: '多选题' },
  { key: 'fill', label: '填空题' },
  { key: 'judge', label: '判断题' },
  { key: 'essay', label: '简答题' },
  { key: 'calculation', label: '计算题' },
  { key: 'comprehensive', label: '综合题' },
  { key: 'composition', label: '作文题' },
];

const SUBJECT_OPTIONS_BY_GRADE = {
  小学: ['语文', '数学', '英语', '科学'],
  初中: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
  高中: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
  大学: ['高等数学', '大学英语', '计算机基础', '专业课'],
};

const MODE_OPTIONS = [
  { value: 'teacher', label: '教师卷', description: '更强调区分度、完整性和审核强度' },
  { value: 'practice', label: '练习卷', description: '更适合课后训练和阶段性练习' },
];

const SOURCE_POLICY_OPTIONS = [
  { value: 'knowledge_first', label: '知识库优先', description: '优先贴近知识库与样题风格' },
  { value: 'hybrid', label: '混合生成', description: '兼顾知识覆盖和灵活生成' },
];

const REVIEW_LEVEL_OPTIONS = [
  { value: 'strict', label: '严格审核', description: '更适合正式测评或教师出卷' },
  { value: 'normal', label: '常规审核', description: '更适合练习和日常训练' },
];

const SUBJECT_CATEGORY_PRESETS = {
  elementary: {
    label: '基础启蒙型',
    description: '更适合小学阶段，题目以识记和基础理解为主。',
    knowledgeLabel: '重点单元',
    knowledgePlaceholder: '例如：拼音、四则运算、自然常识',
    visibleQuestionTypes: ['choice', 'fill', 'judge'],
    weights: { choice: 0.6, fill: 0.25, judge: 0.15 },
    difficulty: { easy: 70, medium: 25, hard: 5 },
  },
  language: {
    label: '语言表达型',
    description: '适合语文等语言类科目，更强调阅读理解、表达与写作。',
    knowledgeLabel: '阅读/写作范围',
    knowledgePlaceholder: '例如：现代文阅读、文言文、写作表达',
    visibleQuestionTypes: ['choice', 'fill', 'essay', 'composition'],
    weights: { choice: 0.42, fill: 0.22, essay: 0.26, composition: 0.1 },
    difficulty: { easy: 30, medium: 50, hard: 20 },
  },
  english: {
    label: '语言应用型',
    description: '适合英语场景，更强调阅读、语法和表达能力。',
    knowledgeLabel: '语法/能力点',
    knowledgePlaceholder: '例如：阅读理解、时态语法、书面表达',
    visibleQuestionTypes: ['choice', 'fill', 'essay'],
    weights: { choice: 0.65, fill: 0.15, essay: 0.2 },
    difficulty: { easy: 30, medium: 50, hard: 20 },
  },
  math: {
    label: '计算推导型',
    description: '适合数学类学科，更强调运算、推理与综合解答。',
    knowledgeLabel: '章节/专题',
    knowledgePlaceholder: '例如：函数、导数、数列、立体几何',
    visibleQuestionTypes: ['choice', 'fill', 'calculation', 'comprehensive'],
    weights: { choice: 0.35, fill: 0.2, calculation: 0.3, comprehensive: 0.15 },
    difficulty: { easy: 25, medium: 50, hard: 25 },
  },
  science: {
    label: '理科综合型',
    description: '适合理化生与技术类学科，更强调概念辨析、运算和综合分析。',
    knowledgeLabel: '知识点/实验专题',
    knowledgePlaceholder: '例如：力学、电学、化学方程式、实验分析',
    visibleQuestionTypes: ['choice', 'multiple_choice', 'fill', 'calculation', 'comprehensive'],
    weights: { choice: 0.35, multiple_choice: 0.15, fill: 0.15, calculation: 0.15, comprehensive: 0.2 },
    difficulty: { easy: 25, medium: 50, hard: 25 },
  },
  humanities: {
    label: '文科论述型',
    description: '适合政史地等文科，更强调理解、辨析和论述能力。',
    knowledgeLabel: '主题/模块',
    knowledgePlaceholder: '例如：近代史、区域地理、时政专题、哲学原理',
    visibleQuestionTypes: ['choice', 'multiple_choice', 'essay'],
    weights: { choice: 0.5, multiple_choice: 0.15, essay: 0.35 },
    difficulty: { easy: 30, medium: 50, hard: 20 },
  },
  general: {
    label: '通用练习型',
    description: '适用于未细分科目的通用组卷，先给出一套均衡结构。',
    knowledgeLabel: '知识点范围',
    knowledgePlaceholder: '例如：函数、阅读理解、实验探究',
    visibleQuestionTypes: ['choice', 'fill', 'essay'],
    weights: { choice: 0.45, fill: 0.2, essay: 0.35 },
    difficulty: { easy: 30, medium: 50, hard: 20 },
  },
};

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const ensureCompleteDistribution = (distribution = {}) => {
  const next = {};
  ALL_QUESTION_TYPE_KEYS.forEach((key) => {
    next[key] = Math.max(0, Number(distribution[key]) || 0);
  });
  return next;
};

const buildDistributionFromWeights = (weights, totalQuestions) => {
  const safeTotal = Math.max(1, Number(totalQuestions) || 1);
  const next = ensureCompleteDistribution();
  const entries = Object.entries(weights || {}).filter(([, weight]) => weight > 0);

  if (entries.length === 0) {
    next.choice = safeTotal;
    return next;
  }

  const scaled = entries.map(([key, weight]) => [key, safeTotal * weight]);
  let currentSum = 0;

  scaled.forEach(([key, rawValue]) => {
    next[key] = Math.floor(rawValue);
    currentSum += next[key];
  });

  let diff = safeTotal - currentSum;
  const sorted = [...scaled].sort((a, b) => (b[1] - Math.floor(b[1])) - (a[1] - Math.floor(a[1])));
  let index = 0;

  while (diff > 0 && sorted.length > 0) {
    const [targetKey] = sorted[index % sorted.length];
    next[targetKey] += 1;
    diff -= 1;
    index += 1;
  }

  return next;
};

const detectSubjectCategory = (gradeLevel, subject) => {
  const normalized = (subject || '').trim();

  if (gradeLevel === '小学' && !normalized) return 'elementary';
  if (['语文', '中文', '大学语文'].includes(normalized)) return 'language';
  if (['英语', '大学英语'].includes(normalized)) return 'english';
  if (['数学', '高等数学', '线性代数', '概率论'].includes(normalized)) return 'math';
  if (['物理', '化学', '生物', '科学', '信息技术', '计算机基础', '专业课'].includes(normalized)) return 'science';
  if (['历史', '地理', '政治', '道德与法治'].includes(normalized)) return 'humanities';

  return gradeLevel === '小学' ? 'elementary' : 'general';
};

const getSubjectPreset = (gradeLevel, subject) => {
  const category = detectSubjectCategory(gradeLevel, subject);
  return SUBJECT_CATEGORY_PRESETS[category] || SUBJECT_CATEGORY_PRESETS.general;
};

function PaperGenerator({ onPaperGenerated, onCancel }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(() => (
    isDark
      ? {
          shell: 'overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90 shadow-[0_18px_48px_rgba(2,6,23,0.28)] backdrop-blur',
          section: 'border-b border-slate-800/80 bg-transparent last:border-b-0',
          soft: 'rounded-md border border-slate-800 bg-slate-950/40',
          input: 'w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-[#5b85a5] focus:outline-none focus:ring-2 focus:ring-[#5b85a5]/15',
          title: 'text-slate-50',
          text: 'text-slate-300',
          muted: 'text-slate-500',
          label: 'text-sm font-medium text-slate-200',
          primaryButton: 'rounded-md bg-[#325a79] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3b688c]',
          secondaryButton: 'rounded-md border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800',
          chip: 'rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800',
          chipActive: 'rounded-md border border-[#5b85a5] bg-[#183049] px-3 py-1.5 text-sm text-white',
          success: 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200',
          warning: 'border-amber-700/40 bg-amber-500/10 text-amber-200',
          info: 'border-sky-700/40 bg-sky-500/10 text-sky-200',
        }
      : {
          shell: 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]',
          section: 'border-b border-gray-200 bg-transparent last:border-b-0',
          soft: 'rounded-md border border-slate-200 bg-white',
          input: 'w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/12',
          title: 'text-slate-900',
          text: 'text-slate-600',
          muted: 'text-slate-400',
          label: 'text-sm font-medium text-slate-700',
          primaryButton: 'rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700',
          secondaryButton: 'rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-gray-50',
          chip: 'rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-200/80',
          chipActive: 'rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm',
          success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
          warning: 'border-amber-200 bg-amber-50 text-amber-700',
          info: 'border-blue-200 bg-blue-50 text-blue-700',
        }
  ), [isDark]);

  const optionCardClass = (active) => (
    active
      ? (isDark
          ? 'border-[#5b85a5] bg-[#132334] text-white'
          : 'border-blue-500 bg-blue-50 text-blue-700')
      : (isDark
          ? 'border-slate-700 bg-slate-900/70 text-slate-300'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')
  );

  const getDefaultDistribution = (gradeLevel, totalQuestions, subject = '') => {
    const preset = getSubjectPreset(gradeLevel, subject);
    return buildDistributionFromWeights(preset.weights, totalQuestions);
  };

  const getDefaultDifficultyDistribution = (gradeLevel, subject = '') => {
    const preset = getSubjectPreset(gradeLevel, subject);
    return preset.difficulty || SUBJECT_CATEGORY_PRESETS.general.difficulty;
  };

  const [config, setConfig] = useState({
    title: '',
    subject: '',
    grade_level: '高中',
    total_questions: 20,
    difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
    question_type_distribution: ensureCompleteDistribution(getDefaultDistribution('高中', 20, '')),
    knowledge_points: [],
    time_limit: 90,
    total_score: 100,
    use_template: false,
    mode: 'teacher',
    source_policy: 'knowledge_first',
    review_level: 'strict',
    blueprint_only: false,
  });

  const [userTemplates, setUserTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [knowledgePointInput, setKnowledgePointInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showAllQuestionTypes, setShowAllQuestionTypes] = useState(false);

  const subjectOptions = useMemo(
    () => SUBJECT_OPTIONS_BY_GRADE[config.grade_level] || [],
    [config.grade_level]
  );

  const subjectPreset = useMemo(
    () => getSubjectPreset(config.grade_level, config.subject),
    [config.grade_level, config.subject]
  );

  const visibleQuestionTypeKeys = useMemo(() => {
    if (showAllQuestionTypes) return ALL_QUESTION_TYPE_KEYS;

    const recommendedKeys = QUESTION_TYPES
      .filter(({ key }) => (config.question_type_distribution[key] || 0) > 0)
      .map(({ key }) => key);

    return Array.from(new Set([
      ...(subjectPreset.visibleQuestionTypes || []),
      ...recommendedKeys,
    ]));
  }, [config.question_type_distribution, showAllQuestionTypes, subjectPreset]);

  const visibleQuestionTypes = useMemo(
    () => QUESTION_TYPES.filter(({ key }) => visibleQuestionTypeKeys.includes(key)),
    [visibleQuestionTypeKeys]
  );

  const distributionSum = Object.values(config.question_type_distribution).reduce((sum, count) => sum + count, 0);
  const hiddenQuestionTypeCount = QUESTION_TYPES.length - visibleQuestionTypes.length;

  const fetchTemplates = async () => {
    try {
      const userId = getUserId();
      if (!userId) return;
      const response = await listTemplates(userId);
      if (response.data.success) {
        setUserTemplates(response.data.templates || []);
      }
    } catch (err) {
      logger.error('获取模板列表失败', err);
    }
  };

  const requestRecommendation = async ({ gradeLevel, subject, totalQuestions, timeLimit, title }) => {
    const fallback = {
      total_questions: totalQuestions,
      question_type_distribution: getDefaultDistribution(gradeLevel, totalQuestions, subject),
      difficulty_distribution: getDefaultDifficultyDistribution(gradeLevel, subject),
      time_limit: timeLimit,
      total_score: config.total_score,
    };

    try {
      const response = await getRecommendedTemplate(
        gradeLevel,
        subject || null,
        totalQuestions || null,
        null,
        timeLimit || null,
        title || null
      );

      if (response?.data?.success && response?.data?.recommendation) {
        return {
          ...fallback,
          ...response.data.recommendation,
          question_type_distribution: ensureCompleteDistribution(
            response.data.recommendation.question_type_distribution || fallback.question_type_distribution
          ),
          difficulty_distribution: {
            easy: clampPercentage(response.data.recommendation.difficulty_distribution?.easy ?? fallback.difficulty_distribution.easy),
            medium: clampPercentage(response.data.recommendation.difficulty_distribution?.medium ?? fallback.difficulty_distribution.medium),
            hard: clampPercentage(response.data.recommendation.difficulty_distribution?.hard ?? fallback.difficulty_distribution.hard),
          },
        };
      }
    } catch (err) {
      logger.error('获取推荐模板失败', err);
    }

    return fallback;
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    const initRecommendation = async () => {
      const recommendation = await requestRecommendation({
        gradeLevel: '高中',
        subject: '',
        totalQuestions: 20,
        timeLimit: 90,
        title: '',
      });

      setConfig((prev) => ({
        ...prev,
        question_type_distribution: ensureCompleteDistribution(recommendation.question_type_distribution),
        difficulty_distribution: recommendation.difficulty_distribution,
        time_limit: recommendation.time_limit || prev.time_limit,
        total_score: recommendation.total_score || prev.total_score,
      }));
    };

    void initRecommendation();
  }, []);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template.id);
    setConfig((prev) => ({
      ...prev,
      title: template.paper_title || prev.title,
      subject: template.subject || prev.subject,
      grade_level: template.grade_level || prev.grade_level,
      total_questions: template.total_questions || prev.total_questions,
      difficulty_distribution: {
        easy: clampPercentage(template.difficulty_distribution?.easy ?? prev.difficulty_distribution.easy),
        medium: clampPercentage(template.difficulty_distribution?.medium ?? prev.difficulty_distribution.medium),
        hard: clampPercentage(template.difficulty_distribution?.hard ?? prev.difficulty_distribution.hard),
      },
      question_type_distribution: ensureCompleteDistribution(template.question_type_distribution || prev.question_type_distribution),
      knowledge_points: template.knowledge_points || prev.knowledge_points,
      time_limit: template.time_limit || prev.time_limit,
      total_score: template.total_score || prev.total_score,
      use_template: true,
    }));
    setError('');
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      setDeletingTemplateId(templateId);
      setError('');
      const userId = getUserId();

      if (!userId) {
        setError('请先登录');
        return;
      }

      const response = await deleteTemplate(templateId, userId);
      if (response.data.success) {
        setUserTemplates((prev) => prev.filter((item) => item.id !== templateId));
        if (selectedTemplate === templateId) {
          setSelectedTemplate(null);
        }
      } else {
        setError(response.data.message || '删除模板失败');
      }
    } catch (err) {
      logger.error('删除模板失败', err);
      setError(err.response?.data?.detail || err.message || '删除模板失败');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('请输入模板名称');
      return;
    }

    setSavingTemplate(true);
    setError('');

    try {
      const userId = getUserId();
      if (!userId) {
        setError('请先登录');
        return;
      }

      const response = await createTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        subject: config.subject || undefined,
        grade_level: config.grade_level || undefined,
        total_questions: config.total_questions,
        difficulty_distribution: config.difficulty_distribution,
        question_type_distribution: config.question_type_distribution,
        knowledge_points: config.knowledge_points?.length ? config.knowledge_points : undefined,
        time_limit: config.time_limit || undefined,
        total_score: config.total_score,
        paper_title: config.title || undefined,
        user_id: userId,
      });

      if (response.data.success) {
        await fetchTemplates();
        setShowSaveTemplateModal(false);
        setTemplateName('');
        setTemplateDescription('');
        alert('模板保存成功');
      } else {
        setError(response.data.message || '保存模板失败');
      }
    } catch (err) {
      logger.error('保存模板失败', err);
      setError(err.response?.data?.detail || err.message || '保存模板失败');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleTotalQuestionsChange = async (value) => {
    const nextTotal = Math.max(5, Math.min(100, parseInt(value, 10) || config.total_questions));
    const recommendation = await requestRecommendation({
      gradeLevel: config.grade_level,
      subject: config.subject,
      totalQuestions: nextTotal,
      timeLimit: config.time_limit,
      title: config.title,
    });

    setConfig((prev) => ({
      ...prev,
      total_questions: nextTotal,
      question_type_distribution: ensureCompleteDistribution(recommendation.question_type_distribution),
      difficulty_distribution: recommendation.difficulty_distribution,
      time_limit: recommendation.time_limit || prev.time_limit,
      total_score: recommendation.total_score || prev.total_score,
    }));
  };

  const handleGradeLevelChange = async (newGradeLevel) => {
    const nextSubject = (SUBJECT_OPTIONS_BY_GRADE[newGradeLevel] || []).includes(config.subject) ? config.subject : '';
    const recommendation = await requestRecommendation({
      gradeLevel: newGradeLevel,
      subject: nextSubject,
      totalQuestions: config.total_questions,
      timeLimit: config.time_limit,
      title: config.title,
    });

    setConfig((prev) => ({
      ...prev,
      grade_level: newGradeLevel,
      subject: nextSubject,
      question_type_distribution: ensureCompleteDistribution(recommendation.question_type_distribution),
      difficulty_distribution: recommendation.difficulty_distribution,
      time_limit: recommendation.time_limit || prev.time_limit,
      total_score: recommendation.total_score || prev.total_score,
    }));

    setShowAllQuestionTypes(false);
    setError('');
  };

  const handleSubjectChange = async (nextSubject) => {
    const normalized = nextSubject.trim();
    const recommendation = await requestRecommendation({
      gradeLevel: config.grade_level,
      subject: normalized,
      totalQuestions: config.total_questions,
      timeLimit: config.time_limit,
      title: config.title,
    });

    setConfig((prev) => ({
      ...prev,
      subject: normalized,
      question_type_distribution: ensureCompleteDistribution(recommendation.question_type_distribution),
      difficulty_distribution: recommendation.difficulty_distribution,
      time_limit: recommendation.time_limit || prev.time_limit,
      total_score: recommendation.total_score || prev.total_score,
    }));

    setShowAllQuestionTypes(false);
    setError('');
  };

  const handleQuestionTypeChange = (key, value) => {
    const nextValue = Math.max(0, Math.min(config.total_questions, parseInt(value, 10) || 0));
    setConfig((prev) => ({
      ...prev,
      question_type_distribution: {
        ...prev.question_type_distribution,
        [key]: nextValue,
      },
    }));
  };

  const handleAutoBalance = () => {
    if (distributionSum === config.total_questions) return;

    const nextDistribution = { ...config.question_type_distribution };
    const targetKeys = visibleQuestionTypes.map(({ key }) => key);
    const editableKeys = targetKeys.length > 0 ? targetKeys : ALL_QUESTION_TYPE_KEYS;
    const diff = config.total_questions - distributionSum;

    if (diff > 0) {
      const targetKey = editableKeys[0];
      nextDistribution[targetKey] = (nextDistribution[targetKey] || 0) + diff;
    } else {
      let remain = Math.abs(diff);
      for (const key of editableKeys) {
        if (remain <= 0) break;
        const current = nextDistribution[key] || 0;
        const reduceBy = Math.min(current, remain);
        nextDistribution[key] = current - reduceBy;
        remain -= reduceBy;
      }
    }

    setConfig((prev) => ({
      ...prev,
      question_type_distribution: ensureCompleteDistribution(nextDistribution),
    }));
  };

  const handleRecommendTypes = async () => {
    try {
      setLoading(true);
      setError('');
      const recommendation = await requestRecommendation({
        gradeLevel: config.grade_level,
        subject: config.subject,
        totalQuestions: config.total_questions,
        timeLimit: config.time_limit,
        title: config.title,
      });

      setConfig((prev) => ({
        ...prev,
        question_type_distribution: ensureCompleteDistribution(recommendation.question_type_distribution),
        difficulty_distribution: recommendation.difficulty_distribution,
        time_limit: recommendation.time_limit || prev.time_limit,
        total_score: recommendation.total_score || prev.total_score,
      }));
    } catch (err) {
      logger.error('刷新推荐失败', err);
      setError('刷新推荐失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const addKnowledgePoint = () => {
    const value = knowledgePointInput.trim();
    if (!value) return;
    setConfig((prev) => ({
      ...prev,
      knowledge_points: [...prev.knowledge_points, value],
    }));
    setKnowledgePointInput('');
  };

  const removeKnowledgePoint = (index) => {
    setConfig((prev) => ({
      ...prev,
      knowledge_points: prev.knowledge_points.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleGenerate = async () => {
    if (!config.title.trim()) {
      setError('请输入试卷标题');
      return;
    }

    if (distributionSum !== config.total_questions) {
      setError(`当前题型总和为 ${distributionSum}，需要和总题数 ${config.total_questions} 保持一致`);
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessage('正在生成试卷，请保持页面开启。题量较大时可能需要几十秒到几分钟。');

    try {
      const userId = getUserId();
      if (!userId) {
        setError('请先登录');
        return;
      }

      const response = await requestGeneratePaper({
        ...config,
        user_id: userId,
      });

      if (response.data.success) {
        onPaperGenerated(response.data);
        setStatusMessage('试卷生成完成，可以继续预览或导出。');
        setTimeout(() => setStatusMessage(''), 5000);
      } else {
        setError(response.data.message || '生成试卷失败');
        setStatusMessage('');
      }
    } catch (err) {
      logger.error('生成试卷失败', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.message || '生成试卷失败';
      if (typeof errorMsg === 'string' && (errorMsg.includes('timeout') || errorMsg.includes('超时'))) {
        setError('生成试卷超时，建议减少题量后再试一次。');
      } else {
        setError(errorMsg);
      }
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={palette.shell}>
      <section className={`${palette.section} p-4 sm:p-6`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold ${palette.info}`}>
              智能组卷
            </div>
            <h3 className={`mt-3 text-2xl font-bold ${palette.title}`}>一页式完成组卷配置</h3>
            <p className={`mt-2 max-w-3xl text-sm leading-7 ${palette.text}`}>
              先定学段、科目和标题，系统会压缩为当前学科最常用的参数。非常用配置统一折叠到下方，移动端也尽量保持在一页内完成选择。
            </p>
          </div>

          <div className={`${palette.soft} p-4 xl:max-w-[340px]`}>
            <div className={`text-sm font-semibold ${palette.title}`}>{subjectPreset.label}</div>
            <p className={`mt-2 text-sm leading-6 ${palette.text}`}>
              {config.grade_level}{config.subject ? ` · ${config.subject}` : ''} 当前会优先展示更贴近该学科的题型与难度结构。
            </p>
          </div>
        </div>
      </section>

      {(statusMessage || error) && (
        <div className="space-y-3 px-4 pt-4 sm:px-6 sm:pt-5">
          {statusMessage && (
            <div className={`rounded-md border px-4 py-3 text-sm ${palette.info}`}>
              {statusMessage}
            </div>
          )}

          {error && (
            <div className={`rounded-md border px-4 py-3 text-sm ${isDark ? 'border-red-700/40 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <div className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className={`rounded-lg px-2 py-1 text-xs ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-100'}`}
                >
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <section className={`${palette.section} p-4 sm:p-6`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className={`text-lg font-semibold ${palette.title}`}>已保存模板</h4>
            <p className={`mt-1 text-sm ${palette.text}`}>先套用常用配置，再按当前场景压缩微调。</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSaveTemplateModal(true)}
            className={palette.secondaryButton}
          >
            保存当前配置为模板
          </button>
        </div>

        {userTemplates.length > 0 ? (
          <div className="mt-4 grid grid-flow-col auto-cols-[minmax(250px,82vw)] gap-3 overflow-x-auto pb-1 md:grid-flow-row md:auto-cols-auto md:grid-cols-2 md:overflow-visible">
            {userTemplates.map((template) => (
              <div
                key={template.id}
                className={`relative rounded-lg border p-4 transition-colors ${optionCardClass(selectedTemplate === template.id)}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  disabled={loading}
                  className={`w-full pr-10 text-left ${loading ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <div className={`text-sm font-semibold ${selectedTemplate === template.id ? (isDark ? 'text-white' : 'text-blue-700') : palette.title}`}>
                    {template.name}
                  </div>
                  {template.paper_title && (
                    <div className={`mt-1 text-xs ${palette.text}`}>试卷标题：{template.paper_title}</div>
                  )}
                  {template.description && (
                    <div className={`mt-2 text-xs leading-6 ${palette.text}`}>{template.description}</div>
                  )}
                  <div className={`mt-3 flex flex-wrap gap-2 text-xs ${palette.muted}`}>
                    {[template.grade_level, template.subject, `${template.total_questions}题`].filter(Boolean).map((item) => (
                      <span key={item} className={`rounded-md border px-2.5 py-1 ${selectedTemplate === template.id ? palette.info : (isDark ? 'border-slate-700 bg-slate-900/70 text-slate-300' : 'border-slate-200 bg-white text-slate-500')}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (window.confirm(`确定删除模板“${template.name}”吗？`)) {
                      handleDeleteTemplate(template.id);
                    }
                  }}
                  disabled={loading || deletingTemplateId === template.id}
                  className={`absolute right-3 top-3 rounded-lg px-2 py-1 text-xs ${isDark ? 'text-red-300 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}
                  title="删除模板"
                >
                  {deletingTemplateId === template.id ? '...' : '删除'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={`mt-4 rounded-md border border-dashed p-4 text-sm ${palette.text} ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-gray-300 bg-gray-50/80'}`}>
            还没有已保存模板。先完成一次组卷后保存，后面可以直接复用。
          </div>
        )}
      </section>

      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`${palette.shell} w-full max-w-md`}>
            <div className="p-5 sm:p-6">
              <h4 className={`text-lg font-semibold ${palette.title}`}>保存为模板</h4>
              <div className="mt-4 space-y-4">
                <div>
                  <label className={palette.label}>模板名称</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="例如：高中数学月考卷"
                    className={`${palette.input} mt-2`}
                  />
                </div>
                <div>
                  <label className={palette.label}>模板说明</label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows={3}
                    placeholder="描述这个模板适合什么场景"
                    className={`${palette.input} mt-2`}
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveTemplateModal(false);
                    setTemplateName('');
                    setTemplateDescription('');
                    setError('');
                  }}
                  className={palette.secondaryButton}
                  disabled={savingTemplate}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className={palette.primaryButton}
                  disabled={savingTemplate}
                >
                  {savingTemplate ? '保存中...' : '保存模板'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className={`${palette.section} p-4 sm:p-6`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="space-y-4">
            <div>
              <h4 className={`text-lg font-semibold ${palette.title}`}>基础信息</h4>
              <p className={`mt-1 text-sm ${palette.text}`}>标题、学段和科目确定后，下面题型会按当前学科自动收紧。</p>
            </div>

            <div>
              <label className={palette.label}>试卷标题</label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例如：高一数学函数单元测评"
                className={`${palette.input} mt-2`}
              />
            </div>

            <div>
              <label className={palette.label}>学段</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {GRADE_OPTIONS.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => { void handleGradeLevelChange(grade); }}
                    className={config.grade_level === grade ? palette.chipActive : palette.chip}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={palette.label}>科目</label>
              <input
                type="text"
                value={config.subject}
                onChange={(e) => setConfig((prev) => ({ ...prev, subject: e.target.value }))}
                onBlur={(e) => { void handleSubjectChange(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSubjectChange(e.currentTarget.value);
                  }
                }}
                placeholder="可直接输入科目，也可点下面快捷选项"
                className={`${palette.input} mt-2`}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {subjectOptions.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => { void handleSubjectChange(subject); }}
                    className={config.subject === subject ? palette.chipActive : palette.chip}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className={`${palette.soft} p-4`}>
                <label className={palette.label}>总题数</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={config.total_questions}
                  onChange={(e) => { void handleTotalQuestionsChange(e.target.value); }}
                  className={`${palette.input} mt-2 text-center font-semibold`}
                />
              </div>

              <div className={`${palette.soft} p-4`}>
                <label className={palette.label}>考试时长（分钟）</label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  value={config.time_limit}
                  onChange={(e) => setConfig((prev) => ({
                    ...prev,
                    time_limit: Math.max(30, Math.min(300, parseInt(e.target.value, 10) || prev.time_limit)),
                  }))}
                  className={`${palette.input} mt-2 text-center font-semibold`}
                />
              </div>

              <div className={`${palette.soft} p-4 sm:col-span-2 xl:col-span-1`}>
                <label className={palette.label}>总分</label>
                <input
                  type="number"
                  min="20"
                  max="300"
                  value={config.total_score}
                  onChange={(e) => setConfig((prev) => ({
                    ...prev,
                    total_score: Math.max(20, Math.min(300, parseInt(e.target.value, 10) || prev.total_score)),
                  }))}
                  className={`${palette.input} mt-2 text-center font-semibold`}
                />
              </div>
            </div>

            <div className={`${palette.soft} p-4`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className={`text-sm font-semibold ${palette.title}`}>组卷模式</div>
                  <p className={`mt-1 text-xs leading-6 ${palette.text}`}>
                    {MODE_OPTIONS.find((option) => option.value === config.mode)?.description}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[280px]">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({
                        ...prev,
                        mode: option.value,
                        review_level: option.value === 'teacher' ? 'strict' : prev.review_level,
                      }))}
                      className={`rounded-md border px-4 py-3 text-left transition-colors ${optionCardClass(config.mode === option.value)}`}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className={`mt-1 text-xs ${config.mode === option.value ? (isDark ? 'text-slate-200' : 'text-blue-600') : palette.muted}`}>
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`${palette.soft} overflow-hidden`}>
            <div className={`grid sm:grid-cols-3 xl:grid-cols-1 ${isDark ? 'divide-slate-800' : 'divide-slate-200'} divide-y sm:divide-y-0 sm:divide-x xl:divide-x-0 xl:divide-y`}>
              <div className="p-4">
                <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${palette.muted}`}>当前场景</div>
                <div className={`mt-2 text-xl font-bold ${palette.title}`}>
                  {config.grade_level}{config.subject ? ` · ${config.subject}` : ''}
                </div>
                <p className={`mt-2 text-sm leading-6 ${palette.text}`}>{subjectPreset.description}</p>
              </div>

              <div className="p-4">
                <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${palette.muted}`}>当前展示</div>
                <div className={`mt-2 text-sm ${palette.text}`}>只保留更常用的题型，特殊卷型再展开全部题型。</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleQuestionTypes.slice(0, 6).map((type) => (
                    <span key={type.key} className={`rounded-md border px-2.5 py-1 text-xs ${palette.info}`}>
                      {type.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4">
                <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${palette.muted}`}>题量校验</div>
                <div className={`mt-2 text-2xl font-bold ${palette.title}`}>{distributionSum} / {config.total_questions}</div>
                <p className={`mt-2 text-sm ${distributionSum === config.total_questions ? palette.text : (isDark ? 'text-amber-200' : 'text-amber-700')}`}>
                  {distributionSum === config.total_questions ? '题型总数已匹配，可直接生成。' : '题型总数未对齐，建议先自动平衡。'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${palette.section} p-4 sm:p-6`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className={`text-lg font-semibold ${palette.title}`}>题型配置</h4>
              <p className={`mt-1 text-sm ${palette.text}`}>
                这里只展示 {config.grade_level}{config.subject ? ` · ${config.subject}` : ''} 常用题型，避免所有参数同时堆满屏幕。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRecommendTypes}
                disabled={loading}
                className={palette.secondaryButton}
              >
                {loading ? '刷新中...' : '重新推荐'}
              </button>
              <button
                type="button"
                onClick={handleAutoBalance}
                className={palette.secondaryButton}
              >
                自动平衡
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {visibleQuestionTypes.map((type) => {
              const count = config.question_type_distribution[type.key] || 0;
              const percentage = config.total_questions > 0 ? Math.round((count / config.total_questions) * 100) : 0;
              return (
                <div key={type.key} className={`${palette.soft} p-3 sm:p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className={`text-sm font-medium ${palette.title}`}>{type.label}</div>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] ${count > 0 ? palette.info : (isDark ? 'border-slate-700 bg-slate-900/70 text-slate-400' : 'border-slate-200 bg-white text-slate-400')}`}>
                      {percentage}%
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={config.total_questions}
                    value={count}
                    onChange={(e) => handleQuestionTypeChange(type.key, e.target.value)}
                    className={`${palette.input} mt-3 px-3 py-2.5 text-center text-base font-semibold`}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${distributionSum === config.total_questions ? palette.text : (isDark ? 'text-amber-200' : 'text-amber-700')}`}>
              当前题型总和：{distributionSum} / {config.total_questions}
            </p>
            {hiddenQuestionTypeCount > 0 && !showAllQuestionTypes && (
              <p className={`text-xs ${palette.muted}`}>
                另有 {hiddenQuestionTypeCount} 类非常用题型已隐藏，可在高级参数中展开
              </p>
            )}
          </div>
      </section>

      <section className={`${palette.section} p-4 sm:p-6`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div className={`${palette.soft} p-4 sm:p-5`}>
            <h4 className={`text-lg font-semibold ${palette.title}`}>知识点范围</h4>
            <p className={`mt-1 text-sm ${palette.text}`}>
              {subjectPreset.knowledgeLabel}会直接影响命题覆盖范围，建议按章节、专题或能力点拆开填写。
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={knowledgePointInput}
                onChange={(e) => setKnowledgePointInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKnowledgePoint();
                  }
                }}
                placeholder={subjectPreset.knowledgePlaceholder}
                className={`${palette.input} flex-1`}
              />
              <button
                type="button"
                onClick={addKnowledgePoint}
                className={palette.secondaryButton}
              >
                添加
              </button>
            </div>

            {config.knowledge_points.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {config.knowledge_points.map((point, index) => (
                  <span
                    key={`${point}-${index}`}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${palette.info}`}
                  >
                    {point}
                    <button
                      type="button"
                      onClick={() => removeKnowledgePoint(index)}
                      className="text-xs opacity-70 hover:opacity-100"
                    >
                      删除
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className={`mt-4 rounded-md border border-dashed p-4 text-sm ${palette.text} ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white/80'}`}>
                还没有添加知识点。建议至少放入 2-4 个章节或专题，生成结果会更稳定。
              </div>
            )}
          </div>

          <div className={`${palette.soft} p-4 sm:p-5`}>
            <h4 className={`text-lg font-semibold ${palette.title}`}>难度分布</h4>
            <p className={`mt-1 text-sm ${palette.text}`}>保持默认比例通常更稳，明确要偏基础或拔高时再调。</p>
            <div className="mt-4 space-y-3">
              {[
                { key: 'easy', label: '基础题' },
                { key: 'medium', label: '中档题' },
                { key: 'hard', label: '提升题' },
              ].map((item) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={palette.label}>{item.label}</span>
                    <span className={palette.muted}>{config.difficulty_distribution[item.key]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.difficulty_distribution[item.key]}
                    onChange={(e) => setConfig((prev) => ({
                      ...prev,
                      difficulty_distribution: {
                        ...prev.difficulty_distribution,
                        [item.key]: clampPercentage(e.target.value),
                      },
                    }))}
                    className="mt-2 w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${palette.section} p-4 sm:p-6`}>
          <button
            type="button"
            onClick={() => setShowAdvancedSettings((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <h4 className={`text-lg font-semibold ${palette.title}`}>高级参数</h4>
              <p className={`mt-1 text-sm ${palette.text}`}>来源策略、审核级别和非常用题型统一折叠在这里。</p>
            </div>
            <span className={`text-sm ${palette.muted}`}>{showAdvancedSettings ? '收起' : '展开'}</span>
          </button>

          {showAdvancedSettings && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className={`${palette.soft} p-4`}>
                <label className={palette.label}>来源策略</label>
                <div className="mt-3 space-y-2">
                  {SOURCE_POLICY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, source_policy: option.value }))}
                      className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${optionCardClass(config.source_policy === option.value)}`}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className={`mt-1 text-xs ${config.source_policy === option.value ? (isDark ? 'text-slate-200' : 'text-blue-600') : palette.muted}`}>
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${palette.soft} p-4`}>
                <label className={palette.label}>审核级别</label>
                <div className="mt-3 space-y-2">
                  {REVIEW_LEVEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, review_level: option.value }))}
                      className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${optionCardClass(config.review_level === option.value)}`}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className={`mt-1 text-xs ${config.review_level === option.value ? (isDark ? 'text-slate-200' : 'text-blue-600') : palette.muted}`}>
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${palette.soft} p-4`}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={config.blueprint_only}
                    onChange={(e) => setConfig((prev) => ({ ...prev, blueprint_only: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    <span className={`block text-sm font-medium ${palette.title}`}>仅生成蓝图，不直接出题</span>
                    <span className={`mt-1 block text-xs ${palette.text}`}>适合先确认命题结构，再进入正式出卷。</span>
                  </span>
                </label>
              </div>

              <div className={`${palette.soft} p-4`}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={showAllQuestionTypes}
                    onChange={(e) => setShowAllQuestionTypes(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className={`block text-sm font-medium ${palette.title}`}>显示全部题型</span>
                    <span className={`mt-1 block text-xs ${palette.text}`}>需要做特殊卷型时再打开，平时只保留常用题型即可。</span>
                  </span>
                </label>
              </div>
            </div>
          )}
      </section>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:justify-end sm:p-6">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !config.title.trim()}
          className={`${palette.primaryButton} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? '生成中...' : '生成试卷'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={palette.secondaryButton}
        >
          取消
        </button>
      </div>
    </div>
  );
}

export default PaperGenerator;
