/**
 * Agent 对话界面 - 智学智能助手
 */
import React, { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '../store/themeStore';
import agentApi from '../api/agentApi';
import apiClient from '../api/apiClient';
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
  const [streamRecovery, setStreamRecovery] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [mobileSections, setMobileSections] = useState({
    tools: false,
    history: false,
  });
  const fileInputRef = useRef(null);
  const activeStreamRef = useRef(null);
  const activeStreamRunIdRef = useRef(0);
  const userScrolledUpRef = useRef(false);

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    loadTools();
    loadSessions();

    return () => {
      cancelActiveStream();
    };
  }, []);

  const cancelActiveStream = () => {
    activeStreamRunIdRef.current += 1;
    activeStreamRef.current?.abort?.();
    activeStreamRef.current = null;
  };

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

  const handleFileUpload = async (file) => {
    if (!file) return;
    const allowedExt = ['.pdf', '.txt', '.md', '.markdown', '.docx', '.pptx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExt.includes(ext)) {
      setError(`不支持的文件类型: ${ext}，支持 PDF / DOCX / PPTX / TXT / MD`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/api/v1/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = response.data;
      setUploadedFile({
        file_name: data.file_name,
        file_path: data.file_path,
        text_length: data.text_length
      });
    } catch (err) {
      logger.error('文件上传失败', err);
      setError(err.response?.data?.detail || '文件上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
  };

  const handleGoalKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent?.isComposing) {
      return;
    }

    e.preventDefault();
    handleSubmit({ preventDefault: () => {} });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!goal.trim()) return;

    cancelActiveStream();
    // Freeze the active run id so stale SSE callbacks cannot mutate a newer task.
    const streamRunId = activeStreamRunIdRef.current;
    setLoading(true);
    setError(null);
    setStreamRecovery(null);
    setCurrentSession(null);

    const finalGoal = uploadedFile
      ? `${goal.trim()}

[Uploaded file path: ${uploadedFile.file_path}. You may use the parse_file tool to read and analyze it.]`
      : goal.trim();

    const tempSession = {
      goal: finalGoal,
      session_type: mode,
      status: 'running',
      steps: [],
      tool_calls: []
    };
    setCurrentSession(tempSession);

    // Stream task events into a local step timeline so the UI can replay progress.
    try {
      activeStreamRef.current = agentApi.createTaskStream(
        finalGoal,
        mode,
        (event) => {
          if (activeStreamRunIdRef.current !== streamRunId) {
            return;
          }

          setCurrentSession(prev => {
            if (!prev) return prev;

            // Keep an append-only step trace so the UI can replay the agent flow.
            const newSession = {
              ...prev,
              steps: [...prev.steps],
              tool_calls: [...prev.tool_calls]
            };

            switch (event.type) {
              case 'session_created':
                setStreamRecovery(null);
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
          if (activeStreamRunIdRef.current !== streamRunId) {
            return;
          }

          setLoading(false);
          setStreamRecovery(null);
          activeStreamRef.current = null;
          loadSessions();
        },
        (err) => {
          if (activeStreamRunIdRef.current !== streamRunId) {
            return;
          }

          setLoading(false);
          activeStreamRef.current = null;
          if (err?.sessionId) {
            setStreamRecovery({
              sessionId: err.sessionId,
              recoverable: Boolean(err.recoverable),
            });
            setCurrentSession(prev => (
              prev
                ? {
                    ...prev,
                    session_id: prev.session_id || err.sessionId,
                    status: prev.status === 'completed' ? prev.status : 'interrupted',
                  }
                : prev
            ));
          }
          setError(err.message || 'Task failed');
        }
      );
    } catch (err) {
      setLoading(false);
      activeStreamRef.current = null;
      setError(err.message || 'Task failed');
    }
  };

  const handleLoadSession = async (sessionId) => {
    try {
      cancelActiveStream();
      setLoading(false);
      const session = await agentApi.getSession(sessionId);
      setCurrentSession(session);
      setStreamRecovery(null);
      setError(null);
    } catch (err) {
      setError('Failed to load session');
    }
  };

  const handleResumeSession = async () => {
    if (!streamRecovery?.sessionId) return;
    await handleLoadSession(streamRecovery.sessionId);
    loadSessions();
  };

  const toggleMobileSection = (sectionKey) => {
    setMobileSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const getMobileSectionClass = (sectionKey) => (
    mobileSections[sectionKey] ? 'block lg:block' : 'hidden lg:block'
  );

  const isNearPageBottom = () => {
    if (typeof window === 'undefined') return true;
    const threshold = 120;
    const scrollElement = document.documentElement;
    return scrollElement.scrollHeight - (window.scrollY + window.innerHeight) < threshold;
  };

  const isMobileViewport = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  };

  const updateScrollToBottomVisibility = () => {
    const shouldShow = Boolean(currentSession) && !isNearPageBottom();
    userScrolledUpRef.current = shouldShow;
    setShowScrollToBottom(shouldShow);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (typeof window === 'undefined') return;
    userScrolledUpRef.current = false;
    setShowScrollToBottom(false);
    const scrollElement = document.documentElement;
    window.scrollTo({ top: scrollElement.scrollHeight, behavior });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleWindowScroll = () => {
      updateScrollToBottomVisibility();
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowScroll);
    requestAnimationFrame(handleWindowScroll);

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowScroll);
    };
  }, [currentSession?.session_id]);

  useEffect(() => {
    if (!currentSession) {
      userScrolledUpRef.current = false;
      setShowScrollToBottom(false);
      return;
    }

    if (!isMobileViewport()) {
      requestAnimationFrame(() => {
        updateScrollToBottomVisibility();
      });
      return;
    }

    if (!userScrolledUpRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom(loading ? 'auto' : 'smooth');
      });
      return;
    }

    requestAnimationFrame(() => {
      updateScrollToBottomVisibility();
    });
  }, [currentSession?.session_id, currentSession?.steps?.length, currentSession?.tool_calls?.length, loading]);

  const cardClass = `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-xl shadow-sm p-4 sm:p-6`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold mb-2 sm:text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
            智学智能助手
          </h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            描述你的任务目标，智学助手将自主规划并执行多个步骤来完成任务
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：输入区域和工具列表 */}
          <div className="order-2 space-y-6 lg:order-1 lg:col-span-1">
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
                    onKeyDown={handleGoalKeyDown}
                    placeholder="例如：分析上传的文件并生成学习计划和测验"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none transition-colors ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    rows="4"
                    disabled={loading}
                  />
                </div>

                {/* 文件上传区域 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    上传文件（可选）
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept=".pdf,.txt,.md,.markdown,.docx,.pptx"
                    className="hidden"
                    disabled={loading || uploading}
                  />
                  {!uploadedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleFileDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                        uploading
                          ? 'opacity-60 cursor-not-allowed'
                          : isDark
                            ? 'border-slate-600 hover:border-slate-400 text-slate-400'
                            : 'border-gray-300 hover:border-gray-400 text-gray-500'
                      }`}
                    >
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${isDark ? 'border-blue-400' : 'border-blue-600'}`}></div>
                          <span className="text-sm">上传中...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm">点击或拖拽文件到此处</p>
                          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                            支持 PDF / DOCX / PPTX / TXT / MD，最大 10MB
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className={`border rounded-lg p-3 flex items-center justify-between ${
                      isDark ? 'border-green-700 bg-green-900/20' : 'border-green-200 bg-green-50'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                            {uploadedFile.file_name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-green-500' : 'text-green-600'}`}>
                            已提取 {uploadedFile.text_length.toLocaleString()} 字符
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        disabled={loading}
                        className={`ml-2 flex-shrink-0 p-1 rounded transition-colors ${
                          isDark ? 'text-slate-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    执行模式
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none transition-colors ${
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    可用工具
                  </h2>
                  <p className={`mt-1 text-xs lg:hidden ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {tools.length > 0 ? `${tools.length} 个可用工具` : '暂无可用工具'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('tools')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors lg:hidden ${
                    isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'
                  }`}
                  aria-expanded={mobileSections.tools}
                  aria-controls="agent-tools-panel"
                >
                  <span>{mobileSections.tools ? '收起' : '展开'}</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${mobileSections.tools ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div id="agent-tools-panel" className={`${getMobileSectionClass('tools')} mt-4 space-y-2 lg:mt-4`}>
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    历史会话
                  </h2>
                  <p className={`mt-1 text-xs lg:hidden ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {sessions.length > 0 ? `${sessions.length} 条最近记录` : '暂无历史记录'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('history')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors lg:hidden ${
                    isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'
                  }`}
                  aria-expanded={mobileSections.history}
                  aria-controls="agent-history-panel"
                >
                  <span>{mobileSections.history ? '收起' : '展开'}</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${mobileSections.history ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div id="agent-history-panel" className={`${getMobileSectionClass('history')} mt-4 space-y-2 lg:mt-4`}>
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
                          session.status === 'interrupted' ? 'bg-orange-100 text-orange-800' :
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
          <div className="order-1 min-w-0 lg:order-2 lg:col-span-2">
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
                      {streamRecovery?.recoverable && (
                        <button
                          onClick={handleResumeSession}
                          className="mt-3 text-xs text-red-500 hover:text-red-400 underline"
                        >
                          重新加载会话
                        </button>
                      )}
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className={`break-words font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                          {currentSession.goal}
                        </h3>
                        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                          模式: {currentSession.session_type} | 状态: {currentSession.status}
                        </p>
                      </div>
                      <span className={`shrink-0 px-3 py-1 rounded text-sm ${
                        currentSession.status === 'completed' ? 'bg-green-100 text-green-800' :
                        currentSession.status === 'failed' ? 'bg-red-100 text-red-800' :
                        currentSession.status === 'interrupted' ? 'bg-orange-100 text-orange-800' :
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
      {showScrollToBottom && currentSession && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className={`fixed right-4 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg transition-all hover:scale-105 sm:right-6 ${
            isDark
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          aria-label="回到底部"
          title="回到底部"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>回到底部</span>
        </button>
      )}
    </div>
  );
};

export default AgentChat;
