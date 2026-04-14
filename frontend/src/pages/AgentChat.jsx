/**
 * Agent 对话界面 - 智学智能助手
 */
import React, { useState, useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';
import agentApi from '../api/agentApi';
import AgentStepViewer from '../components/AgentStepViewer';
import logger from '../utils/logger';

const AgentChat = () => {
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState('react');
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [tools, setTools] = useState([]);
  const [error, setError] = useState(null);

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    loadTools();
    loadSessions();
  }, []);

  const loadTools = async () => {
    try {
      const data = await agentApi.listTools();
      setTools(data.tools || []);
    } catch (err) {
      logger.error('加载工具列表失败', err);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await agentApi.getUserSessions(10, 0);
      setSessions(data.sessions || []);
    } catch (err) {
      logger.error('加载会话列表失败', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setLoading(true);
    setError(null);
    setCurrentSession(null);

    const tempSession = {
      goal: goal,
      session_type: mode,
      status: 'running',
      steps: [],
      tool_calls: []
    };
    setCurrentSession(tempSession);

    try {
      agentApi.createTaskStream(
        goal,
        mode,
        (event) => {
          setCurrentSession(prev => {
            if (!prev) return prev;

            const newSession = {
              ...prev,
              steps: [...prev.steps],
              tool_calls: [...prev.tool_calls]
            };

            switch (event.type) {
              case 'session_created':
                return { ...newSession, session_id: event.session_id };

              case 'goal':
                return {
                  ...newSession,
                  steps: [...newSession.steps, {
                    step_number: event.step_number,
                    step_type: 'goal',
                    content: event.content,
                    extra_data: {
                      trace_id: event.trace_id,
                    },
                    created_at: new Date().toISOString()
                  }]
                };

              case 'thought':
                return {
                  ...newSession,
                  steps: [...newSession.steps, {
                    step_number: event.step_number,
                    step_type: 'thought',
                    content: event.content,
                    extra_data: {
                      trace_id: event.trace_id,
                      quality_status: event.quality_status,
                      confidence: event.confidence,
                    },
                    created_at: new Date().toISOString()
                  }]
                };

              case 'action':
                return {
                  ...newSession,
                  steps: [...newSession.steps, {
                    step_number: event.step_number,
                    step_type: 'action',
                    content: `${event.tool_name}: ${JSON.stringify(event.tool_input)}`,
                    extra_data: {
                      trace_id: event.trace_id,
                      tool_name: event.tool_name,
                      tool_input: event.tool_input,
                    },
                    created_at: new Date().toISOString()
                  }],
                  tool_calls: [...newSession.tool_calls, {
                    tool_name: event.tool_name,
                    status: 'pending',
                    input_params: event.tool_input
                  }]
                };

              case 'observation': {
                const updatedToolCalls = [...newSession.tool_calls];
                if (updatedToolCalls.length > 0) {
                  updatedToolCalls[updatedToolCalls.length - 1] = {
                    ...updatedToolCalls[updatedToolCalls.length - 1],
                    status: event.result.success ? 'success' : 'failed',
                    output_result: event.result
                  };
                }
                return {
                  ...newSession,
                  steps: [...newSession.steps, {
                    step_number: event.step_number,
                    step_type: 'observation',
                    content: JSON.stringify(event.result),
                    extra_data: {
                      trace_id: event.trace_id,
                      ...event.result,
                    },
                    created_at: new Date().toISOString()
                  }],
                  tool_calls: updatedToolCalls
                };
              }

              case 'final_answer':
                return {
                  ...newSession,
                  steps: [...newSession.steps, {
                    step_number: event.step_number,
                    step_type: 'final_answer',
                    content: event.content,
                    extra_data: {
                      trace_id: event.trace_id,
                      quality_status: event.quality_status,
                      confidence: event.confidence,
                      evidence: event.evidence || [],
                      fallback_used: event.fallback_used || false,
                    },
                    created_at: new Date().toISOString()
                  }]
                };

              case 'completed':
                return { ...newSession, status: 'completed' };

              case 'failed':
                setError(event.error || '任务执行失败');
                return { ...newSession, status: 'failed' };

              case 'error':
                setError(event.error);
                return { ...newSession, status: 'failed' };

              default:
                return newSession;
            }
          });
        },
        () => {
          setLoading(false);
          loadSessions();
        },
        (err) => {
          setLoading(false);
          setError(err.message || '任务执行失败');
        }
      );
    } catch (err) {
      setLoading(false);
      setError(err.message || '任务执行失败');
    }
  };

  const handleLoadSession = async (sessionId) => {
    try {
      const session = await agentApi.getSession(sessionId);
      setCurrentSession(session);
    } catch (err) {
      setError('加载会话失败');
    }
  };

  const cardClass = `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg shadow-sm p-6`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            智学智能助手
          </h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            描述你的任务目标，智学助手将自主规划并执行多个步骤来完成任务
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：输入区域和工具列表 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 任务输入 */}
            <div className={cardClass}>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                创建任务
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    任务目标
                  </label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="例如：分析 test.pdf 并生成学习计划和测验"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    rows="4"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    执行模式
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    disabled={loading}
                  >
                    <option value="react">ReAct（推理+行动）</option>
                    <option value="cot">Chain of Thought（逐步思考）</option>
                    {/* Function Calling 模式后端已预留，未来计划实现 */}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !goal.trim()}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? '执行中...' : '开始执行'}
                </button>
              </form>
            </div>

            {/* 可用工具 */}
            <div className={cardClass}>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                可用工具
              </h2>
              <div className="space-y-2">
                {tools.map((tool, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 ${
                      isDark ? 'border-slate-700 bg-slate-700/30' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className={`font-medium text-sm ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      {tool.name}
                    </div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      {tool.description}
                    </div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      分类: {tool.category}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 历史会话 */}
            <div className={cardClass}>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                历史会话
              </h2>
              <div className="space-y-2">
                {sessions.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    暂无历史会话
                  </p>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.session_id}
                      onClick={() => handleLoadSession(session.session_id)}
                      className={`w-full text-left border rounded-lg p-3 transition-colors ${
                        isDark
                          ? 'border-slate-700 hover:bg-slate-700/60'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`text-sm font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                        {session.goal}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          session.status === 'completed' ? 'bg-green-100 text-green-800' :
                          session.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {session.status}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 右侧：执行过程展示 */}
          <div className="lg:col-span-2">
            <div className={cardClass}>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                执行过程
              </h2>

              {error && (
                <div className={`border rounded-lg p-4 mb-4 ${
                  isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start">
                    <svg className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
                        执行失败
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                      {error.includes('API 密钥') && (
                        <p className={`text-xs mt-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                          提示：请联系管理员检查 AI 模型配置
                        </p>
                      )}
                      {error.includes('频繁') && (
                        <button
                          onClick={() => setError(null)}
                          className="mt-3 text-xs text-red-500 hover:text-red-400 underline"
                        >
                          点击重试
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${
                      isDark ? 'border-blue-400' : 'border-blue-600'
                    }`}></div>
                    <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      智学助手正在思考和执行...
                    </p>
                  </div>
                </div>
              )}

              {!loading && !currentSession && !error && (
                <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  <p>输入任务目标并点击"开始执行"</p>
                  <p className="text-sm mt-2">或从左侧选择历史会话查看</p>
                </div>
              )}

              {currentSession && (
                <div>
                  <div className={`mb-6 pb-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                          {currentSession.goal}
                        </h3>
                        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                          模式: {currentSession.session_type} | 状态: {currentSession.status}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded text-sm ${
                        currentSession.status === 'completed' ? 'bg-green-100 text-green-800' :
                        currentSession.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {currentSession.status}
                      </span>
                    </div>
                  </div>
                  <AgentStepViewer
                    steps={currentSession.steps}
                    toolCalls={currentSession.tool_calls}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
