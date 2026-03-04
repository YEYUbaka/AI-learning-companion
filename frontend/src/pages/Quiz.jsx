import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { generateQuiz as requestQuizGenerate, submitQuiz as requestQuizSubmit } from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import PaperGenerator from '../components/PaperGenerator';

const PAPER_STORAGE_KEY = 'zhixueban_custom_paper';

function Quiz() {
  const [mode, setMode] = useState('regular'); // 'regular' 或 'custom'
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questionTypeDistribution, setQuestionTypeDistribution] = useState({
    choice: 3,
    fill: 2
  });
  
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

  const palette = useMemo(
    () =>
      isDark
        ? {
            page: 'min-h-screen bg-gradient-to-b from-[#05060a] via-[#0a0f1e] to-[#08101f] text-white',
            card: 'bg-[#101529] border border-white/10 rounded-3xl shadow-2xl shadow-black/30',
            textMuted: 'text-white/60',
            input:
              'flex-1 px-4 py-3 rounded-2xl bg-[#0f172a] border border-white/10 focus:ring-2 focus:ring-cyan-400 focus:border-transparent placeholder:text-white/40 text-white',
            gradientButton:
              'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white px-6 py-3 rounded-2xl shadow-lg shadow-fuchsia-900/40 hover:shadow-fuchsia-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition',
            alert: 'p-4 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-100',
            questionCard: 'bg-[#131b33] border border-white/10 rounded-2xl',
            choice:
              'flex items-center p-3 rounded-xl border-2 transition cursor-pointer text-white bg-[#0f1425]',
            choiceActive: 'bg-gradient-to-r from-blue-600 to-cyan-500 border-transparent text-white',
            choiceInactive: 'border-white/10 hover:border-blue-500/60',
            inputSmall:
              'w-full px-4 py-3 rounded-2xl bg-[#0f172a] border border-white/10 focus:ring-2 focus:ring-blue-400 placeholder:text-white/40 text-white',
          }
        : {
            page: 'min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900',
            card: 'bg-white rounded-3xl shadow-xl border border-slate-100',
            textMuted: 'text-gray-500',
            input:
              'flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            gradientButton:
              'bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg shadow-lg shadow-blue-200 hover:shadow-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition',
            alert: 'mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800',
            questionCard: 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl',
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
    
    // 自动调整题型分布
    const currentTotal = Object.values(questionTypeDistribution).reduce((sum, count) => sum + count, 0);
    if (currentTotal > 0) {
      // 按比例调整
      const ratio = newValue / currentTotal;
      setQuestionTypeDistribution({
        choice: Math.max(1, Math.round((questionTypeDistribution.choice || 0) * ratio)),
        fill: Math.max(0, newValue - Math.max(1, Math.round((questionTypeDistribution.choice || 0) * ratio)))
      });
    } else {
      // 默认分布：60%选择题，40%填空题
      setQuestionTypeDistribution({
        choice: Math.max(1, Math.round(newValue * 0.6)),
        fill: newValue - Math.max(1, Math.round(newValue * 0.6))
      });
    }
  };
  
  const handleTypeDistributionChange = (type, value) => {
    const newValue = parseInt(value) || 0;
    setQuestionTypeDistribution({
      ...questionTypeDistribution,
      [type]: Math.max(0, newValue)
    });
  };

  const handleAnswerChange = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
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
    setQuestionTypeDistribution({ choice: 3, fill: 2 });
    setShowAdvancedConfig(false);
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
                    ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
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
                    ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                  题目数量
                </label>
                <input
                  type="number"
                  value={numQuestions}
                  onChange={(e) => handleNumQuestionsChange(e.target.value)}
                  min="1"
                  max="50"
                  className={palette.input}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                  className={`text-sm ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  {showAdvancedConfig ? '收起' : '展开'}高级配置
                </button>
              </div>
            </div>
            
            {/* 高级配置 - 题型分布 */}
            {showAdvancedConfig && (
              <div className={`${isDark ? 'bg-[#0f172a]' : 'bg-gray-50'} p-4 rounded-xl border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                  题型分布（总和必须等于题目数量）
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {regularQuestionTypes.map((type) => (
                    <div key={type.key}>
                      <label className={`block text-xs mb-1 ${palette.textMuted}`}>{type.label}</label>
                      <input
                        type="number"
                        value={questionTypeDistribution[type.key] || 0}
                        onChange={(e) => handleTypeDistributionChange(type.key, e.target.value)}
                        min="0"
                        max={numQuestions}
                        className={palette.input}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <p className={`text-xs ${palette.textMuted}`}>
                    当前分布：
                    {regularQuestionTypes.map((type, idx) => (
                      <span key={type.key}>
                        {type.label} {questionTypeDistribution[type.key] || 0} 道
                        {idx < regularQuestionTypes.length - 1 && '，'}
                      </span>
                    ))}
                    {Object.values(questionTypeDistribution).reduce((sum, count) => sum + count, 0) !== numQuestions && (
                      <span className={`ml-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        （总和：{Object.values(questionTypeDistribution).reduce((sum, count) => sum + count, 0)}，需要：{numQuestions}）
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
            
            {!showAdvancedConfig && (
              <p className={`text-xs ${palette.textMuted}`}>
                将生成 {numQuestions} 道测验题（默认：{Math.round(numQuestions * 0.6)} 道选择题 + {numQuestions - Math.round(numQuestions * 0.6)} 道填空题）
              </p>
            )}
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
                {paperData && (
                  <p className={`text-sm ${palette.textMuted} mt-1`}>
                    {paperData.total_questions}道题 · 总分{paperData.total_score}分
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
                  className={`text-sm ${palette.textMuted} hover:opacity-80`}
                >
                  {paperData ? '返回' : '重新生成'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
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
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-8 py-3 rounded-2xl shadow-lg shadow-emerald-900/40 hover:shadow-emerald-900/60 disabled:opacity-50"
                >
                  {submitting ? '提交中...' : '提交测验'}
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

