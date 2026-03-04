import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useThemeStore } from '../store/themeStore';

function QuizResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { score, explanations, questions, answers, topic } = location.state || {};
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  if (!score && !explanations) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <p className="text-gray-600 mb-4">未找到测评结果</p>
          <button
            onClick={() => navigate('/quiz')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回测评
          </button>
        </div>
      </div>
    );
  }

  // 计算正确率
  const correctCount = explanations?.filter(exp => exp.correct).length || 0;
  const totalCount = explanations?.length || 0;
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  // 根据得分显示不同的颜色和评价
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreText = (score) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 60) return '及格';
    return '任需努力';
  };

  const baseCard = isDark
    ? 'bg-[#0f172a] text-white rounded-2xl shadow-2xl border border-white/10'
    : 'bg-white rounded-xl shadow-lg text-gray-800';
  const resultContainer = isDark
    ? 'bg-[#05060a] text-white min-h-screen'
    : 'bg-gray-50 text-gray-800 min-h-screen';
  const aiBlock = isDark
    ? 'bg-[#0a0f1f] border border-white/10 text-white/80'
    : 'bg-white border border-gray-200 text-gray-700';

  return (
    <div className={`${resultContainer} py-10`}>
      <div className="max-w-4xl mx-auto px-4">
        <div className={`${baseCard} p-8`}>
        {/* 头部信息 */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">{'测评结果'}</h2>
          {topic && (
            <p className="text-gray-600 mb-4">测验主题：{topic}</p>
          )}
          
          {/* 得分展示 */}
          <div className="inline-block bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-4">
            <div className={`text-6xl font-bold ${getScoreColor(score)} mb-2`}>
              {score}
            </div>
            <div className="text-gray-600 text-sm">分</div>
            <div className={`text-lg font-semibold ${getScoreColor(score)} mt-2`}>
              {getScoreText(score)}
            </div>
          </div>

          {/* 统计信息 */}
          <div className={`flex justify-center gap-6 text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
            <div>
              <span className="font-semibold">正确：</span>
              <span className="text-green-600 font-bold">{correctCount}</span> / {totalCount}
            </div>
            <div>
              <span className="font-semibold">正确率：</span>
              <span className="text-blue-600 font-bold">{percentage}%</span>
            </div>
          </div>
        </div>

        {/* 题目讲解 */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-4">{'详细讲解'}</h3>
          
          {explanations && explanations.map((exp, i) => {
            const question = questions && questions[i];
            const userAnswer = answers && answers[i];
            
            return (
              <div
                key={i}
                className={`rounded-xl p-6 border-2 ${
                  exp.correct
                    ? isDark
                      ? 'bg-green-500/10 border-green-400/40'
                      : 'bg-green-50 border-green-200'
                    : isDark
                    ? 'bg-red-500/10 border-red-400/40'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-lg">
                        {i + 1}. {exp.question || (question?.question || '')}
                      </span>
                      {exp.correct ? (
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          ✓ 正确
                        </span>
                      ) : (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          ✗ 错误
                        </span>
                      )}
                    </div>
                    
                    {question && (
                        <div className={`text-sm mb-2 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                        {question.type === 'choice' && question.options && (
                          <div className="mb-1">
                            <span className="font-semibold">选项：</span>
                            {question.options.join(', ')}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">标准答案：</span>
                          <span className="text-green-700 font-medium">{question.answer}</span>
                        </div>
                        {userAnswer && (
                          <div>
                            <span className="font-semibold">你的答案：</span>
                            <span className={exp.correct ? 'text-green-700' : 'text-red-700'}>{userAnswer}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI讲解 */}
                <div className={`mt-4 p-4 rounded-lg ${aiBlock}`}>
                  <div className="text-sm font-semibold mb-2">AI讲解：</div>
                  <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {exp.explanation || '暂无讲解'}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部操作 */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate('/quiz')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            再次测评
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            返回首页
          </button>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>Powered by 智学伴 · AI个性化学习与测评助手</p>
        </div>
        </div>
      </div>
    </div>
  );
}

export default QuizResult;

