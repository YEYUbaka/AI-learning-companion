import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { generateQuiz as requestQuizGenerate, submitQuiz as requestQuizSubmit } from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import PaperGenerator from '../components/PaperGenerator';

const PAPER_STORAGE_KEY = 'zhixueban_custom_paper';
const ANSWER_STORAGE_KEY = 'zhixueban_quiz_progress';

function Quiz() {
  const [mode, setMode] = useState('regular'); // 'regular' 或 'custom'
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [choicePercent, setChoicePercent] = useState(60); // 选择题百分比
  const [questionTypeDistribution, setQuestionTypeDistribution] = useState({
    choice: 3,
    fill: 2
  });
  const [startTime, setStartTime] = useState(null); // 答题开始时间
  
  // 题型选项（常规测评模式支持的类型）
  const regularQuestionTypes = [
    { key: 'choice', label: '单选题' },
    { key: 'fill', label: '填空题' },
    { key: 'judge', label: '判断题' }
  ];
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paperData, setPaperData] = useState(null); // 智能组卷生成的试卷数据
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // 计算答题进度
  const answeredCount = useMemo(() => {
    return answers.filter((ans, idx) => {
      const q = questions[idx];
      if (!q) return false;
      if (q.type === 'fill' && ans?.trim()) return true;
      if (q.type === 'choice' && ans) return true;
      if (q.type === 'judge' && ans) return true;
      return false;
    }).length;
  }, [answers, questions]);

  const palette = useMemo(
    () =>
      isDark
        ? {
            page: 'min-h-screen bg-slate-900 text-white',
            card: 'bg-slate-800 border border-slate-700 rounded-2xl shadow-lg',
            textMuted: 'text-slate-400',
            input:
              'flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-white',
            gradientButton:
              'bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition',
            secondaryButton:
              'bg-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-600 transition text-sm',
            alert: 'p-4 rounded-xl bg-red-900/20 border border-red-500/40 text-red-200',
            questionCard: 'bg-slate-800 border border-slate-700 rounded-xl',
            choice:
              'flex items-center p-3 rounded-lg border-2 transition cursor-pointer text-white bg-slate-800',
            choiceActive: 'bg-blue-600 border-transparent text-white',
            choiceInactive: 'border-slate-700 hover:border-blue-500',
            inputSmall:
              'w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 text-white',
          }
        : {
            page: 'min-h-screen bg-gray-50 text-slate-900',
            card: 'bg-white rounded-2xl shadow-lg border border-gray-200',
            textMuted: 'text-gray-500',
            input:
              'flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            gradientButton:
              'bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition',
            secondaryButton:
              'bg-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm',
            alert: 'mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800',
            questionCard: 'bg-white border border-gray-200 rounded-xl',
            choice:
              'flex items-center p-3 rounded-lg cursor-pointer transition-colors bg-white border-2 border-gray-200',
            choiceActive: 'bg-blue-100 border-blue-500',
            choiceInactive: 'hover:border-blue-300',
            inputSmall:
              'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          },
    [isDark]
  );

  // 获取用户ID
  const getUserId = () => {
    // 优先从sessionStorage获取，如果没有则从localStorage（向后兼容）
    const userInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        return user.id;
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('请输入测验主题');
      return;
    }

    // 验证题型分布总和是否等于总题数
    const totalDistributed = Object.values(questionTypeDistribution).reduce((sum, count) => sum + count, 0);
    if (totalDistributed !== numQuestions) {
      setError(`题型分布总和（${totalDistributed}）必须等于总题数（${numQuestions}）`);
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessage('AI 正在生成测验题目，通常需要 10-30 秒，请耐心等待...');

    try {
      const response = await requestQuizGenerate({
        topic,
        num_questions: numQuestions,
        question_type_distribution: questionTypeDistribution,
      });

      if (response.data.success) {
        setQuestions(response.data.questions);
        setAnswers(new Array(response.data.questions.length).fill(''));
        setStartTime(Date.now());
        setError('');
        setStatusMessage('测验生成完成，可以开始答题。');
        setTimeout(() => setStatusMessage(''), 4000);
      } else {
        setError(response.data.message || '生成测验题目失败');
        setStatusMessage('');
      }
    } catch (err) {
      console.error('生成测验失败:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.message || '生成测验题目失败';
      setError(errorMsg);
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNumQuestionsChange = (value) => {
    const newValue = parseInt(value) || 5;
    setNumQuestions(newValue);

    // 根据百分比自动计算题型分布
    const choiceCount = Math.round(newValue * choicePercent / 100);
    const fillCount = newValue - choiceCount;
    setQuestionTypeDistribution({
      choice: choiceCount,
      fill: fillCount
    });
  };

  const handleChoicePercentChange = (value) => {
    const percent = parseInt(value) || 60;
    setChoicePercent(percent);

    // 自动计算题型分布
    const choiceCount = Math.round(numQuestions * percent / 100);
    const fillCount = numQuestions - choiceCount;
    setQuestionTypeDistribution({
      choice: choiceCount,
      fill: fillCount
    });
  };

  const handleAnswerChange = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);

    // 自动保存答题进度
    sessionStorage.setItem(ANSWER_STORAGE_KEY, JSON.stringify({
      topic,
      questions,
      answers: newAnswers,
      startTime
    }));
  };

  const handleSubmit = async () => {
    // 检查是否所有题目都已作答
    const unanswered = answers.some((ans, idx) => {
      const q = questions[idx];
      if (q.type === 'fill' && !ans.trim()) return true;
      if (q.type === 'choice' && !ans) return true;
      return false;
    });

    if (unanswered) {
      setError('请完成所有题目后再提交');
      return;
    }

    setSubmitting(true);
    setError('');
    setStatusMessage('AI 正在批改本次测验，通常需要 5-15 秒，请稍候...');

    try {
      const user_id = getUserId();
      const response = await requestQuizSubmit({
        user_id,
        topic,
        questions,
        answers,
      });

      if (response.data.success) {
        setStatusMessage('批改完成，正在跳转到结果页...');
        // 跳转到结果页面
        navigate('/quiz-result', {
          state: {
            score: response.data.score,
            explanations: response.data.explanations,
            questions: questions,
            answers: answers,
            topic: topic
          }
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || '提交测验失败');
      setSubmitting(false);
      setStatusMessage('');
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setAnswers([]);
    setTopic('');
    setError('');
    setPaperData(null);
    setNumQuestions(5);
    setChoicePercent(60);
    setQuestionTypeDistribution({ choice: 3, fill: 2 });
    setShowAdvancedConfig(false);
    setStartTime(null);
    sessionStorage.removeItem(ANSWER_STORAGE_KEY);
  };
  
  const handlePaperGenerated = (data) => {
    setPaperData(data);
    setQuestions(data.questions || []);
    setAnswers(new Array(data.questions?.length || 0).fill(''));
    // 智能组卷不进入答题模式，保持在custom模式用于预览和导出
    setMode('custom');
  };
  
  const handleExportPaper = async (format = 'pdf') => {
    if (!paperData) return;
    
    try {
      const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
      const userId = userInfo.id;
      
      const response = await api.get(
        `/api/v1/quiz/paper/${paperData.paper_id}/export?user_id=${userId}&format=${format}&include_answer=true`,
        { responseType: 'blob' }
      );
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // 修复文件后缀：word格式应该是docx
      const fileExt = format === 'word' ? 'docx' : format;
      link.setAttribute('download', `试卷_${paperData.paper_id}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('导出失败：' + (err.response?.data?.detail || err.message));
    }
  };

  // 载入本地存储的智能组卷
  useEffect(() => {
    const cached = sessionStorage.getItem(PAPER_STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.questions) {
          setPaperData(parsed);
          setQuestions(parsed.questions);
          setAnswers(new Array(parsed.questions.length).fill(''));
          setMode('custom');
        }
      } catch (error) {
        console.warn('加载缓存试卷失败:', error);
        sessionStorage.removeItem(PAPER_STORAGE_KEY);
      }
    }

    // 载入答题进度
    const savedProgress = sessionStorage.getItem(ANSWER_STORAGE_KEY);
    if (savedProgress && !cached) {
      try {
        const { topic: savedTopic, questions: savedQuestions, answers: savedAnswers, startTime: savedStartTime } = JSON.parse(savedProgress);
        if (savedQuestions && savedAnswers) {
          setTopic(savedTopic);
          setQuestions(savedQuestions);
          setAnswers(savedAnswers);
          setStartTime(savedStartTime);
          setMode('regular');
        }
      } catch (error) {
        // warn silenced
        sessionStorage.removeItem(ANSWER_STORAGE_KEY);
      }
    }
  }, []);

  // 同步缓存
  useEffect(() => {
    if (paperData) {
      sessionStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(paperData));
    } else {
      sessionStorage.removeItem(PAPER_STORAGE_KEY);
    }
  }, [paperData]);

  return (
    <div className={`${palette.page} py-10`}>
      <div className="max-w-4xl mx-auto px-4">
        <div className={`${palette.card} p-8`}>
        <h1 className="text-3xl font-bold mb-6">智学伴 · AI智能测评</h1>
        
        {/* 模式切换 */}
        {questions.length === 0 && !paperData && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('regular')}
              className={`px-6 py-2 rounded-lg transition ${
                mode === 'regular'
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-gray-700 text-white/60 hover:text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              常规测评
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-6 py-2 rounded-lg transition ${
                mode === 'custom'
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-gray-700 text-white/60 hover:text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              智能组卷
            </button>
          </div>
        )}
        
        {/* 智能组卷模式 */}
        {mode === 'custom' && questions.length === 0 && !paperData && (
          <PaperGenerator
            onPaperGenerated={handlePaperGenerated}
            onCancel={() => setMode('regular')}
          />
        )}

        {/* 常规测评模式 - 生成题目区域 */}
        {mode === 'regular' && questions.length === 0 && !paperData && (
          <div className="mb-6 space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                请输入测验主题
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：Python基础语法、JavaScript函数、数据结构与算法"
                  className={palette.input}
                  onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !topic.trim()}
                  className={palette.gradientButton}
                >
                  {loading ? '生成中...' : '生成测验'}
                </button>
              </div>
            </div>
            
            {/* 基础配置 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                题目数量：{numQuestions} 道
              </label>
              <input
                type="range"
                value={numQuestions}
                onChange={(e) => handleNumQuestionsChange(e.target.value)}
                min="3"
                max="30"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>3</span>
                <span>30</span>
              </div>
            </div>

            {/* 题型配置 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                选择题占比：{choicePercent}%（{questionTypeDistribution.choice} 道选择题 + {questionTypeDistribution.fill} 道填空题）
              </label>
              <input
                type="range"
                value={choicePercent}
                onChange={(e) => handleChoicePercentChange(e.target.value)}
                min="0"
                max="100"
                step="10"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* 状态提示 */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl border ${
              isDark
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-100'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <p className="text-sm">{statusMessage}</p>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className={`${palette.alert}`}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* 题目列表 */}
        {questions.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {paperData ? paperData.title : `测验主题：${topic}`}
                </h2>
                {paperData ? (
                  <p className={`text-sm ${palette.textMuted} mt-1`}>
                    {paperData.total_questions}道题 · 总分{paperData.total_score}分
                  </p>
                ) : (
                  <p className={`text-sm ${palette.textMuted} mt-1`}>
                    答题进度：{answeredCount}/{questions.length}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {paperData && (
                  <>
                    <button
                      onClick={() => handleExportPaper('pdf')}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        isDark
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      导出PDF
                    </button>
                    <button
                      onClick={() => handleExportPaper('word')}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        isDark
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      导出Word
                    </button>
                  </>
                )}
                <button
                  onClick={handleReset}
                  className={palette.secondaryButton}
                >
                  {paperData ? '返回' : '重新生成'}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className={`${palette.questionCard} p-6 shadow-md`}
                >
                  <p className="font-semibold text-lg mb-4">
                    {i + 1}. {q.question}
                    <span className={`ml-2 text-sm ${palette.textMuted}`}>
                      ({q.type === 'choice' ? '选择题' : q.type === 'fill' ? '填空题' : q.type === 'judge' ? '判断题' : q.type === 'essay' ? '简答题' : '其他题型'})
                    </span>
                    {q.points && (
                      <span className={`ml-2 text-sm ${palette.textMuted}`}>
                        ({q.points}分)
                      </span>
                    )}
                  </p>

                  {/* 智能组卷模式：只显示预览，不显示答题选项 */}
                  {paperData && mode === 'custom' ? (
                    <div className={`space-y-2 ${isDark ? 'text-white/80' : 'text-gray-600'}`}>
                      {q.type === 'choice' && q.options ? (
                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-lg ${isDark ? 'bg-[#0f172a] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}
                            >
                              <span className={isDark ? 'text-white' : 'text-gray-700'}>
                                {typeof opt === 'string' ? opt : opt}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : q.type === 'fill' ? (
                        <div className={`p-3 rounded-lg ${isDark ? 'bg-[#0f172a] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                          <span className={isDark ? 'text-white/60' : 'text-gray-500'}>填空题</span>
                        </div>
                      ) : (
                        <div className={`p-3 rounded-lg ${isDark ? 'bg-[#0f172a] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                          <span className={isDark ? 'text-white/60' : 'text-gray-500'}>其他题型</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 常规测评模式：显示答题选项 */
                    <>
                      {q.type === 'choice' ? (
                        <div className="space-y-2">
                          {q.options && q.options.map((opt, optIdx) => (
                            <label
                              key={optIdx}
                              className={`${palette.choice} ${
                                answers[i] === opt[0] ? palette.choiceActive : palette.choiceInactive
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q${i}`}
                                value={opt[0]}
                                checked={answers[i] === opt[0]}
                                onChange={() => handleAnswerChange(i, opt[0])}
                                className="mr-3"
                              />
                              <span className={isDark ? 'text-white' : 'text-gray-700'}>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={answers[i] || ''}
                          onChange={(e) => handleAnswerChange(i, e.target.value)}
                          placeholder="请输入答案"
                          className={palette.inputSmall}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* 提交按钮 - 只在常规测评模式显示 */}
            {!paperData || mode === 'regular' ? (
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || answeredCount < questions.length}
                  className={`px-8 py-3 rounded-xl shadow-lg font-medium transition ${
                    submitting || answeredCount < questions.length
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {submitting ? '提交中...' : `提交测验 (${answeredCount}/${questions.length})`}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default Quiz;

