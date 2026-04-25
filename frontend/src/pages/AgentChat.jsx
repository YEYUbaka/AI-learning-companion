import React, { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../store/themeStore';
import agentApi from '../api/agentApi';
import apiClient from '../api/apiClient';
import AgentStepViewer from '../components/AgentStepViewer';
import logger from '../utils/logger';

const ACCEPTED_FILE_TYPES = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.markdown,.docx,.pptx';

const isImageAttachment = (attachment) =>
  attachment?.file_type === 'image' || attachment?.type === 'image';

const getAttachmentPreview = (attachment) =>
  attachment?.image_url || attachment?.file_url || attachment?.preview_url || null;

const buildAttachmentFromResponse = (data) => {
  const attachment = data?.attachment || {};
  return {
    ...attachment,
    name: attachment.name || data?.file_name || 'attachment',
    file_name: attachment.file_name || data?.file_name || 'attachment',
    file_path: attachment.file_path || data?.file_path,
    file_type: attachment.file_type || data?.file_type || 'file',
    mime_type: attachment.mime_type || data?.mime_type,
    preview_url: attachment.preview_url || data?.preview_url,
    image_url: attachment.image_url || data?.preview_url || attachment.file_url,
    text_length: data?.text_length || 0,
  };
};

const mergeAttachments = (previous, nextAttachment) => {
  const uniqueKey = nextAttachment.file_path || nextAttachment.file_name || nextAttachment.name;
  const filtered = previous.filter((item) => {
    const currentKey = item.file_path || item.file_name || item.name;
    return currentKey !== uniqueKey;
  });
  return [...filtered, nextAttachment];
};

const AgentChat = () => {
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState('react');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tools, setTools] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState(null);
  const [streamRecovery, setStreamRecovery] = useState(null);
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
    void loadTools();
    void loadSessions();

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
      logger.error('Failed to load agent tools', err);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await agentApi.getUserSessions(10, 0);
      setSessions(data.sessions || []);
    } catch (err) {
      logger.error('Failed to load agent sessions', err);
    }
  };

  const handleFilesUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/api/v1/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const normalizedAttachment = buildAttachmentFromResponse(response.data);
        setAttachments((previous) => mergeAttachments(previous, normalizedAttachment));
      }
    } catch (err) {
      logger.error('Failed to upload agent attachment', err);
      setError(err.response?.data?.detail || '附件上传失败，请稍后重试');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploading(false);
    }
  };

  const handleFileDrop = async (event) => {
    event.preventDefault();
    if (loading || uploading) {
      return;
    }
    await handleFilesUpload(event.dataTransfer.files);
  };

  const handleFileInputChange = async (event) => {
    await handleFilesUpload(event.target.files);
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((previous) => previous.filter((_, index) => index !== indexToRemove));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGoalKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) {
      return;
    }

    event.preventDefault();
    void handleSubmit({ preventDefault: () => {} });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!goal.trim()) {
      return;
    }

    cancelActiveStream();
    const streamRunId = activeStreamRunIdRef.current;
    const finalGoal = goal.trim();
    const requestContext = attachments.length ? { attachments } : null;

    setLoading(true);
    setError(null);
    setStreamRecovery(null);

    const tempSession = {
      goal: finalGoal,
      session_type: mode,
      status: 'running',
      steps: [],
      tool_calls: [],
      context: requestContext,
    };
    setCurrentSession(tempSession);

    try {
      activeStreamRef.current = agentApi.createTaskStream(
        finalGoal,
        mode,
        requestContext,
        (eventPayload) => {
          if (activeStreamRunIdRef.current !== streamRunId) {
            return;
          }

          setCurrentSession((previous) => {
            if (!previous) {
              return previous;
            }

            const nextSession = {
              ...previous,
              steps: [...(previous.steps || [])],
              tool_calls: [...(previous.tool_calls || [])],
            };

            switch (eventPayload.type) {
              case 'session_created':
                setStreamRecovery(null);
                return { ...nextSession, session_id: eventPayload.session_id };
              case 'goal':
                nextSession.steps.push({
                  step_number: eventPayload.step_number,
                  step_type: 'goal',
                  content: eventPayload.content,
                  extra_data: {
                    trace_id: eventPayload.trace_id,
                  },
                  created_at: new Date().toISOString(),
                });
                return nextSession;
              case 'thought':
                nextSession.steps.push({
                  step_number: eventPayload.step_number,
                  step_type: 'thought',
                  content: eventPayload.content,
                  extra_data: {
                    trace_id: eventPayload.trace_id,
                    quality_status: eventPayload.quality_status,
                    confidence: eventPayload.confidence,
                  },
                  created_at: new Date().toISOString(),
                });
                return nextSession;
              case 'action':
                nextSession.steps.push({
                  step_number: eventPayload.step_number,
                  step_type: 'action',
                  content: `${eventPayload.tool_name}: ${JSON.stringify(eventPayload.tool_input)}`,
                  extra_data: {
                    trace_id: eventPayload.trace_id,
                    tool_name: eventPayload.tool_name,
                    tool_input: eventPayload.tool_input,
                  },
                  created_at: new Date().toISOString(),
                });
                nextSession.tool_calls.push({
                  tool_name: eventPayload.tool_name,
                  status: 'pending',
                  input_params: eventPayload.tool_input,
                });
                return nextSession;
              case 'observation': {
                const updatedToolCalls = [...nextSession.tool_calls];
                if (updatedToolCalls.length > 0) {
                  updatedToolCalls[updatedToolCalls.length - 1] = {
                    ...updatedToolCalls[updatedToolCalls.length - 1],
                    status: eventPayload.result?.success ? 'success' : 'failed',
                    output_result: eventPayload.result,
                  };
                }

                nextSession.steps.push({
                  step_number: eventPayload.step_number,
                  step_type: 'observation',
                  content: JSON.stringify(eventPayload.result),
                  extra_data: {
                    trace_id: eventPayload.trace_id,
                    ...(eventPayload.result || {}),
                  },
                  created_at: new Date().toISOString(),
                });
                nextSession.tool_calls = updatedToolCalls;
                return nextSession;
              }
              case 'final_answer':
                nextSession.steps.push({
                  step_number: eventPayload.step_number,
                  step_type: 'final_answer',
                  content: eventPayload.content,
                  extra_data: {
                    trace_id: eventPayload.trace_id,
                    quality_status: eventPayload.quality_status,
                    confidence: eventPayload.confidence,
                    evidence: eventPayload.evidence || [],
                    fallback_used: eventPayload.fallback_used || false,
                  },
                  created_at: new Date().toISOString(),
                });
                return nextSession;
              case 'completed':
                return { ...nextSession, status: 'completed' };
              case 'failed':
                setError(eventPayload.error || '任务执行失败');
                return { ...nextSession, status: 'failed' };
              case 'error':
                setError(eventPayload.error || '任务执行失败');
                return { ...nextSession, status: 'failed' };
              default:
                return nextSession;
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
          void loadSessions();
        },
        (streamError) => {
          if (activeStreamRunIdRef.current !== streamRunId) {
            return;
          }

          setLoading(false);
          activeStreamRef.current = null;
          if (streamError?.sessionId) {
            setStreamRecovery({
              sessionId: streamError.sessionId,
              recoverable: Boolean(streamError.recoverable),
            });
            setCurrentSession((previous) => (
              previous
                ? {
                    ...previous,
                    session_id: previous.session_id || streamError.sessionId,
                    status: previous.status === 'completed' ? previous.status : 'interrupted',
                  }
                : previous
            ));
          }
          setError(streamError.message || '任务执行失败');
        }
      );
    } catch (err) {
      logger.error('Failed to start agent task stream', err);
      setLoading(false);
      activeStreamRef.current = null;
      setError(err.message || '任务执行失败');
    }
  };

  const handleLoadSession = async (sessionId) => {
    try {
      cancelActiveStream();
      setLoading(false);
      setError(null);
      setStreamRecovery(null);
      const session = await agentApi.getSession(sessionId);
      setCurrentSession(session);
      setAttachments(session?.context?.attachments || []);
    } catch (err) {
      logger.error('Failed to load agent session', err);
      setError('会话加载失败');
    }
  };

  const handleResumeSession = async () => {
    if (!streamRecovery?.sessionId) {
      return;
    }
    await handleLoadSession(streamRecovery.sessionId);
    await loadSessions();
  };

  const toggleMobileSection = (sectionKey) => {
    setMobileSections((previous) => ({
      ...previous,
      [sectionKey]: !previous[sectionKey],
    }));
  };

  const getMobileSectionClass = (sectionKey) =>
    mobileSections[sectionKey] ? 'block lg:block' : 'hidden lg:block';

  const isNearPageBottom = () => {
    if (typeof window === 'undefined') {
      return true;
    }
    const threshold = 120;
    const scrollElement = document.documentElement;
    return scrollElement.scrollHeight - (window.scrollY + window.innerHeight) < threshold;
  };

  const isMobileViewport = () => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < 1024;
  };

  const updateScrollToBottomVisibility = () => {
    const shouldShow = Boolean(currentSession) && !isNearPageBottom();
    userScrolledUpRef.current = shouldShow;
    setShowScrollToBottom(shouldShow);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (typeof window === 'undefined') {
      return;
    }
    userScrolledUpRef.current = false;
    setShowScrollToBottom(false);
    const scrollElement = document.documentElement;
    window.scrollTo({ top: scrollElement.scrollHeight, behavior });
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

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
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">
        <div className="mb-8">
          <h1 className={`mb-2 text-2xl font-bold sm:text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
            智学智能助手
          </h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            支持文本任务、文档附件和图片理解。图片会直接作为多模态上下文提交给支持视觉的模型。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="order-2 space-y-6 lg:order-1 lg:col-span-1">
            <div className={cardClass}>
              <h2 className={`mb-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                创建任务
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`mb-2 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    任务目标
                  </label>
                  <textarea
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    onKeyDown={handleGoalKeyDown}
                    placeholder="例如：分析这张几何题图片并给出解题思路；或结合附件总结学习重点。"
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none ${
                      isDark
                        ? 'border-slate-600 bg-slate-700 text-white placeholder-slate-500'
                        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
                    }`}
                    rows={4}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={`mb-2 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    附件
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={loading || uploading}
                  />
                  <div
                    onClick={() => {
                      if (!loading && !uploading) {
                        fileInputRef.current?.click();
                      }
                    }}
                    onDrop={(event) => {
                      void handleFileDrop(event);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                      uploading
                        ? 'cursor-not-allowed opacity-60'
                        : isDark
                          ? 'border-slate-600 text-slate-400 hover:border-slate-400'
                          : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className={`h-4 w-4 animate-spin rounded-full border-b-2 ${isDark ? 'border-blue-400' : 'border-blue-600'}`} />
                        <span className="text-sm">附件上传中...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto mb-2 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="text-sm">点击或拖拽上传图片、PDF、DOCX、PPTX、TXT、MD</p>
                        <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                          单个文件最大 10MB。图片不会被静默忽略，模型不支持视觉时会明确报错。
                        </p>
                      </>
                    )}
                  </div>

                  {attachments.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {attachments.map((attachment, index) => {
                        const preview = getAttachmentPreview(attachment);
                        const isImage = isImageAttachment(attachment);
                        return (
                          <div
                            key={`${attachment.file_path || attachment.file_name || attachment.name}-${index}`}
                            className={`rounded-lg border p-3 ${
                              isDark ? 'border-slate-700 bg-slate-700/30' : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className={`truncate text-sm font-medium ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                                  {attachment.file_name || attachment.name}
                                </div>
                                <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                  {isImage ? '图片附件' : '文档附件'}
                                  {attachment.mime_type ? ` · ${attachment.mime_type}` : ''}
                                  {!isImage && attachment.text_length
                                    ? ` · 已提取 ${Number(attachment.text_length).toLocaleString()} 字`
                                    : ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(index)}
                                disabled={loading}
                                className={`rounded p-1 transition-colors ${
                                  isDark ? 'text-slate-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
                                }`}
                                aria-label="删除附件"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            {isImage && preview ? (
                              <div className="mt-3 overflow-hidden rounded-lg border border-black/5">
                                <img src={preview} alt={attachment.file_name || attachment.name} className="max-h-56 w-full object-contain bg-black/5" />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className={`mb-2 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    执行模式
                  </label>
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none ${
                      isDark ? 'border-slate-600 bg-slate-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                    }`}
                    disabled={loading}
                  >
                    <option value="react">ReAct</option>
                    <option value="cot">Chain of Thought</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !goal.trim()}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? '执行中...' : '开始执行'}
                </button>
              </form>
            </div>

            <div className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>可用工具</h2>
                  <p className={`mt-1 text-xs lg:hidden ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {tools.length ? `${tools.length} 个工具可用` : '暂无可用工具'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('tools')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm lg:hidden ${
                    isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span>{mobileSections.tools ? '收起' : '展开'}</span>
                  <svg className={`h-4 w-4 transition-transform ${mobileSections.tools ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className={`${getMobileSectionClass('tools')} mt-4 space-y-2`}>
                {tools.map((tool, index) => (
                  <div
                    key={`${tool.name}-${index}`}
                    className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-700/30' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{tool.name}</div>
                    <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{tool.description}</div>
                    <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>分类: {tool.category}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>历史会话</h2>
                  <p className={`mt-1 text-xs lg:hidden ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {sessions.length ? `${sessions.length} 条最近记录` : '暂无历史记录'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('history')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm lg:hidden ${
                    isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span>{mobileSections.history ? '收起' : '展开'}</span>
                  <svg className={`h-4 w-4 transition-transform ${mobileSections.history ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className={`${getMobileSectionClass('history')} mt-4 space-y-2`}>
                {sessions.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>暂无历史会话</p>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.session_id}
                      onClick={() => {
                        void handleLoadSession(session.session_id);
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isDark ? 'border-slate-700 hover:bg-slate-700/60' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`truncate text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                        {session.goal}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            session.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : session.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : session.status === 'interrupted'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
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

          <div className="order-1 min-w-0 lg:order-2 lg:col-span-2">
            <div className={cardClass}>
              <h2 className={`mb-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>执行过程</h2>

              {error ? (
                <div className={`mb-4 rounded-lg border p-4 ${isDark ? 'border-red-700 bg-red-900/20' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start">
                    <svg className={`mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-red-400' : 'text-red-800'}`}>执行失败</h3>
                      <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                      {streamRecovery?.recoverable ? (
                        <button onClick={() => void handleResumeSession()} className="mt-3 text-xs text-red-500 underline hover:text-red-400">
                          重新加载会话
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className={`mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 ${isDark ? 'border-blue-400' : 'border-blue-600'}`} />
                    <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>智能助手正在思考和执行...</p>
                  </div>
                </div>
              ) : null}

              {!loading && !currentSession && !error ? (
                <div className={`py-12 text-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  <p>输入任务目标并点击开始执行。</p>
                  <p className="mt-2 text-sm">也可以从左侧打开历史会话继续查看。</p>
                </div>
              ) : null}

              {currentSession ? (
                <div>
                  <div className={`mb-6 border-b pb-4 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className={`break-words font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{currentSession.goal}</h3>
                        <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                          模式: {currentSession.session_type} | 状态: {currentSession.status}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded px-3 py-1 text-sm ${
                          currentSession.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : currentSession.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : currentSession.status === 'interrupted'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
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
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showScrollToBottom && currentSession ? (
        <button
          onClick={() => scrollToBottom('smooth')}
          className={`fixed right-4 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 sm:right-6 ${
            isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
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
      ) : null}
    </div>
  );
};

export default AgentChat;
