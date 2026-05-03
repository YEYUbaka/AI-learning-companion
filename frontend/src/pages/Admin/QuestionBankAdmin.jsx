import { useEffect, useMemo, useState } from 'react';
import api from '../../api/apiClient';
import AdminLayout from '../../components/AdminLayout';
import {
  createQuestionBankItem,
  deleteQuestionBankItem,
  importQuestionBankItems,
  listQuestionBankItems,
  updateQuestionBankItem,
  uploadQuestionBankAsset,
} from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';
import logger from '../../utils/logger';

const QUESTION_TYPE_OPTIONS = [
  { value: 'choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'fill', label: '填空题' },
  { value: 'judge', label: '判断题' },
  { value: 'essay', label: '简答题' },
  { value: 'calculation', label: '计算题' },
  { value: 'comprehensive', label: '综合题' },
  { value: 'composition', label: '作文题' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
];

const QUESTION_TYPE_LABELS = Object.fromEntries(
  QUESTION_TYPE_OPTIONS.map((item) => [item.value, item.label])
);

const DIFFICULTY_LABELS = Object.fromEntries(
  DIFFICULTY_OPTIONS.map((item) => [item.value, item.label])
);

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

function createEmptyOptionValues() {
  return Object.fromEntries(OPTION_KEYS.map((key) => [key, '']));
}

function createEmptyForm() {
  return {
    stem: '',
    question_type: 'choice',
    grade_level: '',
    subject: '',
    difficulty: 'medium',
    knowledge_points: '',
    answer: '',
    explanation: '',
    options: '',
    option_values: createEmptyOptionValues(),
    choice_answer: '',
    multiple_answers: [],
    judge_answer: '正确',
    source: '',
    status: 'active',
    expected_updated_at: null,
  };
}

const EMPTY_FORM = createEmptyForm();

function formatDateTime(value) {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

function getDisplayName(metadata, fallbackId) {
  if (metadata?.last_edited_by_name) {
    return metadata.last_edited_by_name;
  }
  if (metadata?.created_by_name) {
    return metadata.created_by_name;
  }
  if (fallbackId) {
    return `管理员 #${fallbackId}`;
  }
  return '未知';
}

function parseOptionText(option, fallbackKey) {
  const text = String(option || '').trim();
  const patterns = [
    new RegExp(`^${fallbackKey}[.、:\\s]+`, 'i'),
    /^[A-F][.、:\s]+/i,
  ];

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return text.replace(pattern, '').trim();
    }
  }

  return text;
}

function parseOptionValues(options) {
  const values = createEmptyOptionValues();
  (Array.isArray(options) ? options : []).slice(0, OPTION_KEYS.length).forEach((option, index) => {
    const key = OPTION_KEYS[index];
    values[key] = parseOptionText(option, key);
  });
  return values;
}

function normalizeChoiceAnswer(answer) {
  const text = String(Array.isArray(answer) ? answer[0] || '' : answer || '')
    .trim()
    .toUpperCase();
  const matched = OPTION_KEYS.find((key) => text.startsWith(key));
  return matched || '';
}

function normalizeMultipleAnswers(answer) {
  if (Array.isArray(answer)) {
    return answer
      .map((item) => normalizeChoiceAnswer(item))
      .filter(Boolean);
  }

  return String(answer || '')
    .split(/[,，、\s]+/)
    .map((item) => normalizeChoiceAnswer(item))
    .filter(Boolean);
}

function normalizeJudgeAnswer(answer) {
  const text = String(Array.isArray(answer) ? answer[0] || '' : answer || '').trim().toLowerCase();
  if (['错误', '错', 'false', '0', 'f', 'x'].includes(text)) {
    return '错误';
  }
  return '正确';
}

function getQuestionBankAssetUrl(asset) {
  if (!asset) {
    return null;
  }

  if (typeof asset === 'string') {
    return asset;
  }

  const rawValue =
    asset.preview_url ||
    asset.image_url ||
    asset.file_url ||
    asset.url ||
    asset.file_path;

  if (!rawValue) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(rawValue)) {
    return rawValue;
  }

  const normalizedPath = rawValue.startsWith('uploads/') ? `/${rawValue}` : rawValue;

  if (normalizedPath.startsWith('/')) {
    const apiBaseUrl = String(api.defaults.baseURL || '').replace(/\/$/, '');
    return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
  }

  return normalizedPath;
}

function normalizeQuestionImages(images) {
  return (Array.isArray(images) ? images : [])
    .map((image, index) => {
      const url = getQuestionBankAssetUrl(image);
      if (!url) {
        return null;
      }

      return {
        id: image?.id ?? `question-image-${index}`,
        key: `${image?.id || image?.file_path || image?.file_name || index}-${index}`,
        name: image?.file_name || image?.name || `题图 ${index + 1}`,
        url,
      };
    })
    .filter(Boolean);
}

function QuestionBankAdmin() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingItemId, setEditingItemId] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [previewAsset, setPreviewAsset] = useState(null);
  const [brokenAssetKeys, setBrokenAssetKeys] = useState({});
  const [qbConstants, setQbConstants] = useState({ grade_levels: [], subjects: [] });
  const isChoiceType = form.question_type === 'choice';
  const isMultipleChoiceType = form.question_type === 'multiple_choice';
  const isJudgeType = form.question_type === 'judge';
  const isObjectiveType = isChoiceType || isMultipleChoiceType || isJudgeType;

  const palette = useMemo(
    () =>
      isDark
        ? {
            shell: 'rounded-xl border border-slate-800 bg-slate-900/90',
            soft: 'rounded-lg border border-slate-800 bg-slate-950/60',
            text: 'text-slate-300',
            title: 'text-white',
            muted: 'text-slate-500',
            input:
              'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none',
            primary:
              'rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60',
            secondary:
              'rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60',
            danger:
              'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60',
          }
        : {
            shell: 'rounded-xl border border-slate-200 bg-white',
            soft: 'rounded-lg border border-slate-200 bg-slate-50',
            text: 'text-slate-600',
            title: 'text-slate-900',
            muted: 'text-slate-400',
            input:
              'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none',
            primary:
              'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60',
            secondary:
              'rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60',
            danger:
              'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60',
          },
    [isDark]
  );

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listQuestionBankItems({ limit: 50, keyword: keyword || undefined });
      setItems(response.data.items || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      logger.error('加载题库失败', err);
      setError(err.response?.data?.detail || '加载题库失败');
    } finally {
      setLoading(false);
    }
  };

  const loadConstants = async () => {
    try {
      const response = await api.get('/api/v1/question-bank/constants');
      if (response.data?.success) {
        setQbConstants({
          grade_levels: response.data.grade_levels || [],
          subjects: response.data.subjects || [],
        });
      }
    } catch (err) {
      logger.error('Failed to load question bank constants', err);
    }
  };

  useEffect(() => {
    void loadItems();
    void loadConstants();
  }, []);

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingItemId(null);
    setError('');
  };

  const markAssetBroken = (assetKey) => {
    setBrokenAssetKeys((current) => {
      if (current[assetKey]) {
        return current;
      }

      return {
        ...current,
        [assetKey]: true,
      };
    });
  };

  const buildPayload = () => {
    const payload = {
      stem: form.stem,
      question_type: form.question_type,
      grade_level: form.grade_level,
      subject: form.subject,
      difficulty: form.difficulty,
      knowledge_points: form.knowledge_points
        .split(/[,，、\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
      answer: form.answer,
      explanation: form.explanation,
      options: form.options,
      source: form.source,
      status: form.status,
    };

    if (isChoiceType || isMultipleChoiceType) {
      const filledOptions = OPTION_KEYS.map((key) => ({
        key,
        text: form.option_values[key]?.trim() || '',
      })).filter((item) => item.text);

      if (filledOptions.length < 2) {
        return { error: '选择题至少需要填写两个选项。' };
      }

      payload.options = filledOptions.map((item) => `${item.key}. ${item.text}`);

      if (isChoiceType) {
        if (!form.choice_answer) {
          return { error: '请选择单选题的正确答案。' };
        }
        const targetOption = filledOptions.find((item) => item.key === form.choice_answer);
        if (!targetOption) {
          return { error: '正确答案必须对应一个已填写的选项。' };
        }
        payload.answer = form.choice_answer;
      } else {
        const selectedAnswers = form.multiple_answers.filter((key) =>
          filledOptions.some((item) => item.key === key)
        );
        if (!selectedAnswers.length) {
          return { error: '请至少勾选一个多选题正确答案。' };
        }
        payload.answer = selectedAnswers;
      }
    } else if (isJudgeType) {
      payload.options = ['正确', '错误'];
      payload.answer = form.judge_answer || '正确';
    } else {
      payload.options = form.options;
      payload.answer = form.answer;
    }

    if (editingItemId && form.expected_updated_at) {
      payload.expected_updated_at = form.expected_updated_at;
    }

    return { payload };
  };

  const handleQuestionTypeChange = (questionType) => {
    setForm((current) => ({
      ...current,
      question_type: questionType,
      choice_answer: questionType === 'choice' ? current.choice_answer : '',
      multiple_answers: questionType === 'multiple_choice' ? current.multiple_answers : [],
      judge_answer: questionType === 'judge' ? current.judge_answer || '正确' : current.judge_answer,
    }));
  };

  const handleOptionValueChange = (key, value) => {
    setForm((current) => {
      const optionValues = {
        ...current.option_values,
        [key]: value,
      };

      const nextChoiceAnswer =
        current.choice_answer === key && !value.trim() ? '' : current.choice_answer;
      const nextMultipleAnswers = current.multiple_answers.filter(
        (answerKey) => answerKey !== key || value.trim()
      );

      return {
        ...current,
        option_values: optionValues,
        choice_answer: nextChoiceAnswer,
        multiple_answers: nextMultipleAnswers,
      };
    });
  };

  const toggleMultipleAnswer = (key) => {
    setForm((current) => {
      const alreadySelected = current.multiple_answers.includes(key);
      return {
        ...current,
        multiple_answers: alreadySelected
          ? current.multiple_answers.filter((item) => item !== key)
          : [...current.multiple_answers, key],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setStatusMessage('');

    try {
      const { payload, error: payloadError } = buildPayload();
      if (payloadError) {
        setError(payloadError);
        setSaving(false);
        return;
      }

      if (editingItemId) {
        await updateQuestionBankItem(editingItemId, payload);
        setStatusMessage('题目已更新。');
      } else {
        await createQuestionBankItem(payload);
        setStatusMessage('题目已创建。');
      }
      resetForm();
      await loadItems();
    } catch (err) {
      logger.error('保存题目失败', err);
      const detail = err.response?.data?.detail || '保存题目失败';
      if (err.response?.status === 409 || String(detail).includes('updated by another admin')) {
        setError('这道题已被其他管理员更新，请刷新列表后重新编辑，避免覆盖他人的修改。');
        await loadItems();
      } else {
        setError(detail);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    const questionType = item.question_type || 'choice';
    setEditingItemId(item.id);
    setStatusMessage('');
    setError('');
    setForm({
      stem: item.stem || '',
      question_type: questionType,
      grade_level: item.grade_level || '',
      subject: item.subject || '',
      difficulty: item.difficulty || 'medium',
      knowledge_points: (item.knowledge_points || []).join(', '),
      answer: Array.isArray(item.answer) ? item.answer.join(', ') : item.answer || '',
      explanation: item.explanation || '',
      options: Array.isArray(item.options) ? item.options.join('\n') : item.options || '',
      option_values: parseOptionValues(item.options),
      choice_answer: questionType === 'choice' ? normalizeChoiceAnswer(item.answer) : '',
      multiple_answers: questionType === 'multiple_choice' ? normalizeMultipleAnswers(item.answer) : [],
      judge_answer: questionType === 'judge' ? normalizeJudgeAnswer(item.answer) : '正确',
      source: item.source || '',
      status: item.status || 'active',
      expected_updated_at: item.updated_at || null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (itemId) => {
    const confirmed = window.confirm(
      '题库是共享的，删除后其他管理员也看不到这道题。确认继续删除吗？'
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteQuestionBankItem(itemId);
      setStatusMessage('题目已删除。');
      if (editingItemId === itemId) {
        resetForm();
      }
      await loadItems();
    } catch (err) {
      logger.error('删除题目失败', err);
      setError(err.response?.data?.detail || '删除题目失败');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setError('');
    setStatusMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await importQuestionBankItems(formData);
      const summary = response.data;
      setStatusMessage(
        `导入完成：新增 ${summary.created_count} 题，重复 ${summary.duplicate_count} 题，失败 ${summary.error_count} 题。`
      );
      await loadItems();
    } catch (err) {
      logger.error('导入题库失败', err);
      setError(err.response?.data?.detail || '导入题库失败');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleAssetUpload = async (itemId, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append('item_id', String(itemId));
      formData.append('asset_type', 'question_image');
      formData.append('file', file);
      await uploadQuestionBankAsset(formData);
      setStatusMessage('题目图片已上传。');
      await loadItems();
    } catch (err) {
      logger.error('上传题目图片失败', err);
      setError(err.response?.data?.detail || '上传题目图片失败');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        <div className={`${palette.shell} p-5 sm:p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${palette.title}`}>题库管理</h1>
              <p className={`mt-2 text-sm ${palette.text}`}>
                题库为共享题库，多位管理员可以协同维护。若编辑期间题目已被别人改动，系统会提示冲突，避免互相覆盖。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className={palette.secondary}>
                {importing ? '导入中...' : '导入 CSV / Excel'}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleImport}
                  disabled={importing}
                />
              </label>
              <button
                type="button"
                className={palette.secondary}
                onClick={() => void loadItems()}
                disabled={loading}
              >
                刷新列表
              </button>
            </div>
          </div>

          {false && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              isDark
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            录题字段已中文化，支持录入题目、学段、科目、难度、考点、答案、解析和题目图片。知识库文档仍是材料来源，不会直接当作题目。
          </div>

          )}
          {statusMessage ? (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
              {statusMessage}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className={`${palette.soft} p-4 sm:p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className={`text-lg font-semibold ${palette.title}`}>
                  {editingItemId ? '编辑题目' : '录入题目'}
                </h2>
                {editingItemId ? (
                  <button type="button" className={palette.secondary} onClick={resetForm}>
                    新建题目
                  </button>
                ) : null}
              </div>

              <form className="space-y-3" onSubmit={handleSubmit}>
                <textarea
                  className={`${palette.input} min-h-[120px]`}
                  value={form.stem}
                  onChange={(e) => setForm({ ...form, stem: e.target.value })}
                  placeholder="请输入题干"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className={palette.input}
                    value={form.grade_level}
                    onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                  >
                    <option value="">选择学段</option>
                    {qbConstants.grade_levels.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  <select
                    className={palette.input}
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  >
                    <option value="">选择科目</option>
                    {qbConstants.subjects.map((subj) => (
                      <option key={subj} value={subj}>{subj}</option>
                    ))}
                  </select>
                  <select
                    className={palette.input}
                    value={form.question_type}
                    onChange={(e) => handleQuestionTypeChange(e.target.value)}
                  >
                    {QUESTION_TYPE_OPTIONS.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={palette.input}
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  >
                    {DIFFICULTY_OPTIONS.map((difficulty) => (
                      <option key={difficulty.value} value={difficulty.value}>
                        {difficulty.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  className={palette.input}
                  value={form.knowledge_points}
                  onChange={(e) => setForm({ ...form, knowledge_points: e.target.value })}
                  placeholder="考点，多个考点可用逗号分隔"
                />

                {(isChoiceType || isMultipleChoiceType) && (
                  <div className={`${palette.soft} space-y-3 p-3`}>
                    <div>
                      <div className={`text-sm font-medium ${palette.title}`}>固定选项录入</div>
                      <div className={`mt-1 text-xs ${palette.text}`}>
                        直接填写选项内容即可，正确答案通过下方勾选，不需要手动输入 A/B/C/D。
                      </div>
                    </div>
                    <div className="space-y-2">
                      {OPTION_KEYS.map((key) => (
                        <div key={key} className="grid gap-2 sm:grid-cols-[52px_minmax(0,1fr)]">
                          <div
                            className={`flex items-center justify-center rounded-lg border text-sm font-semibold ${
                              isDark
                                ? 'border-slate-700 bg-slate-900 text-slate-200'
                                : 'border-slate-300 bg-white text-slate-700'
                            }`}
                          >
                            {key}
                          </div>
                          <input
                            className={palette.input}
                            value={form.option_values[key]}
                            onChange={(e) => handleOptionValueChange(key, e.target.value)}
                            placeholder={`请输入 ${key} 选项内容`}
                          />
                        </div>
                      ))}
                    </div>

                    {isChoiceType ? (
                      <div>
                        <div className={`text-sm font-medium ${palette.title}`}>正确答案</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {OPTION_KEYS.map((key) => {
                            const disabled = !form.option_values[key]?.trim();
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                  disabled
                                    ? isDark
                                      ? 'border-slate-800 bg-slate-950 text-slate-600'
                                      : 'border-slate-200 bg-slate-50 text-slate-400'
                                    : isDark
                                      ? 'border-slate-700 bg-slate-900 text-slate-200'
                                      : 'border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="choice-answer"
                                  checked={form.choice_answer === key}
                                  onChange={() => setForm({ ...form, choice_answer: key })}
                                  disabled={disabled}
                                />
                                选项 {key}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className={`text-sm font-medium ${palette.title}`}>正确答案</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {OPTION_KEYS.map((key) => {
                            const disabled = !form.option_values[key]?.trim();
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                  disabled
                                    ? isDark
                                      ? 'border-slate-800 bg-slate-950 text-slate-600'
                                      : 'border-slate-200 bg-slate-50 text-slate-400'
                                    : isDark
                                      ? 'border-slate-700 bg-slate-900 text-slate-200'
                                      : 'border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={form.multiple_answers.includes(key)}
                                  onChange={() => toggleMultipleAnswer(key)}
                                  disabled={disabled}
                                />
                                选项 {key}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isJudgeType && (
                  <div className={`${palette.soft} space-y-3 p-3`}>
                    <div>
                      <div className={`text-sm font-medium ${palette.title}`}>判断结果</div>
                      <div className={`mt-1 text-xs ${palette.text}`}>
                        判断题无需输入选项，直接勾选正确或错误即可。
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {['正确', '错误'].map((label) => (
                        <label
                          key={label}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-sm ${
                            isDark
                              ? 'border-slate-700 bg-slate-900 text-slate-200'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="judge-answer"
                            checked={form.judge_answer === label}
                            onChange={() => setForm({ ...form, judge_answer: label })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {!isObjectiveType && (
                  <>
                    <textarea
                      className={`${palette.input} min-h-[96px]`}
                      value={form.options}
                      onChange={(e) => setForm({ ...form, options: e.target.value })}
                      placeholder="选项内容，每行一项；主观题可留空"
                    />

                    <input
                      className={palette.input}
                      value={form.answer}
                      onChange={(e) => setForm({ ...form, answer: e.target.value })}
                      placeholder="标准答案"
                    />
                  </>
                )}

                <textarea
                  className={`${palette.input} min-h-[96px]`}
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                  placeholder="解析"
                />

                <input
                  className={palette.input}
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="来源，可选"
                />

                {editingItemId && form.expected_updated_at ? (
                  <div className={`text-xs ${palette.muted}`}>
                    当前编辑版本：{formatDateTime(form.expected_updated_at)}
                  </div>
                ) : null}

                <button type="submit" className={palette.primary} disabled={saving}>
                  {saving ? '保存中...' : editingItemId ? '更新题目' : '创建题目'}
                </button>
              </form>
            </section>

            <section className={`${palette.soft} p-4 sm:p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className={`text-lg font-semibold ${palette.title}`}>题目列表</h2>
                  <p className={`mt-1 text-sm ${palette.text}`}>当前共 {total} 道题</p>
                </div>
                <div className="flex gap-3">
                  <input
                    className={palette.input}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="搜索题干或解析"
                  />
                  <button type="button" className={palette.secondary} onClick={() => void loadItems()}>
                    搜索
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className={`rounded-lg px-4 py-6 text-sm ${palette.text}`}>加载中...</div>
                ) : null}
                {!loading && items.length === 0 ? (
                  <div className={`rounded-lg px-4 py-6 text-sm ${palette.text}`}>暂无题目</div>
                ) : null}

                {items.map((item) => {
                  const metadata = item.metadata || {};
                  const createdByName =
                    metadata.created_by_name ||
                    (item.created_by ? `管理员 #${item.created_by}` : '未知');
                  const lastEditedByName = getDisplayName(metadata, item.created_by);
                  const questionImages = normalizeQuestionImages(item.question_images);

                  return (
                    <article
                      key={item.id}
                      className={`rounded-lg border p-4 ${
                        isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-500">
                              {QUESTION_TYPE_LABELS[item.question_type] || item.question_type}
                            </span>
                            <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-slate-500">
                              {item.grade_level || '未设置学段'}
                            </span>
                            <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-slate-500">
                              {item.subject || '未设置科目'}
                            </span>
                            <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-slate-500">
                              {DIFFICULTY_LABELS[item.difficulty] || item.difficulty || '未设置难度'}
                            </span>
                          </div>

                          <div className={`mt-3 text-sm font-semibold leading-7 ${palette.title}`}>
                            {item.stem}
                          </div>

                          {item.knowledge_points?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.knowledge_points.map((point) => (
                                <span
                                  key={`${item.id}-${point}`}
                                  className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500"
                                >
                                  {point}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs ${palette.text}`}>
                            <span>创建人：{createdByName}</span>
                            <span>最近编辑人：{lastEditedByName}</span>
                            <span>最近更新时间：{formatDateTime(item.updated_at)}</span>
                          </div>

                          {questionImages.length ? (
                            <div className="mt-3 flex flex-wrap gap-3">
                              {questionImages.map((image) => {
                                const isBroken = Boolean(brokenAssetKeys[image.key]);

                                return (
                                  <button
                                    key={image.key}
                                    type="button"
                                    className={`group relative h-24 w-24 overflow-hidden rounded-xl border text-left transition ${
                                      isDark
                                        ? 'border-slate-800 bg-slate-950/80 hover:border-slate-600'
                                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                    }`}
                                    onClick={() => {
                                      if (!isBroken) {
                                        setPreviewAsset(image);
                                      }
                                    }}
                                    title={isBroken ? '题图加载失败' : `预览 ${image.name}`}
                                  >
                                    {isBroken ? (
                                      <div
                                        className={`flex h-full w-full items-center justify-center px-2 text-center text-xs ${
                                          isDark ? 'text-slate-400' : 'text-slate-500'
                                        }`}
                                      >
                                        题图加载失败
                                      </div>
                                    ) : (
                                      <>
                                        <img
                                          src={image.url}
                                          alt={image.name}
                                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                                          loading="lazy"
                                          onError={() => markAssetBroken(image.key)}
                                        />
                                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                                          点击预览
                                        </div>
                                      </>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <label className={palette.secondary}>
                            上传题图
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => void handleAssetUpload(item.id, event)}
                            />
                          </label>
                          <button type="button" className={palette.secondary} onClick={() => handleEdit(item)}>
                            编辑
                          </button>
                          <button type="button" className={palette.danger} onClick={() => void handleDelete(item.id)}>
                            删除
                          </button>
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
      {previewAsset ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/82 px-4 py-6"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className={`relative max-h-full w-full max-w-5xl overflow-hidden rounded-2xl border shadow-2xl ${
              isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`flex items-center justify-between gap-4 border-b px-4 py-3 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div className="min-w-0">
                <div className={`truncate text-sm font-semibold ${palette.title}`}>{previewAsset.name}</div>
                <div className={`mt-1 text-xs ${palette.text}`}>Click outside to close preview</div>
              </div>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isDark ? 'bg-slate-900 text-slate-200 hover:bg-slate-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => setPreviewAsset(null)}
              >
                关闭
              </button>
            </div>
            <div className={`max-h-[80vh] overflow-auto p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50/60'}`}>
              <img
                src={previewAsset.url}
                alt={previewAsset.name}
                className="mx-auto max-h-[72vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default QuestionBankAdmin;
