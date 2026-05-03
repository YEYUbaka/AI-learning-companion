import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatSender } from '@tdesign-react/chat';
import '@tdesign-react/chat/es/style/index.js';
import agentApi from '../api/agentApi';
import apiClient from '../api/apiClient';
import AgentStepViewer from '../components/AgentStepViewer';
import { useThemeStore } from '../store/themeStore';
import logger from '../utils/logger';
import {
  applyStreamEventToTimeline,
  buildOptimisticAssistantMessage,
  buildOptimisticUserMessage,
  getNextTurnIndex,
  normalizeSession,
} from '../utils/agentTimeline';

const ACCEPTED_FILE_TYPES = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.markdown,.docx,.pptx';
const DOC_UPLOAD_ERROR = '暂不支持 .doc 格式上传，请将文件另存为 .docx 后重新上传。';

const SUGGESTED_PROMPTS = [
  '帮我把这份资料整理成复习提纲',
  '看图解答这道数学题并给出步骤',
  '根据上传的文件生成一套练习题',
];

const statusLabelMap = {
  running: '进行中',
  completed: '已完成',
  failed: '失败',
  interrupted: '已中断',
};

const getStatusTone = (status, isDark) => {
  const toneMap = {
    running: isDark ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-50 text-amber-700',
    completed: isDark ? 'bg-emerald-400/15 text-emerald-200' : 'bg-emerald-50 text-emerald-700',
    failed: isDark ? 'bg-rose-400/15 text-rose-200' : 'bg-rose-50 text-rose-700',
    interrupted: isDark ? 'bg-orange-400/15 text-orange-200' : 'bg-orange-50 text-orange-700',
  };

  return toneMap[status] || toneMap.running;
};

const formatSessionDate = (value) => {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const getSessionInitial = (title = '') => {
  const cleanTitle = String(title).trim();
  if (!cleanTitle) return 'A';
  return cleanTitle.slice(0, 1).toUpperCase();
};

const buildAttachmentIdentity = (attachment = {}) =>
  attachment.local_key
  || attachment.file_path
  || `${attachment.file_name || attachment.name || 'attachment'}-${attachment.size || attachment.text_length || 0}`;

const getFileExtension = (fileName = '') => {
  const parts = String(fileName).split('.');
  return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
};

const buildAttachmentFromResponse = (data, originalFile) => {
  const attachment = data?.attachment || {};
  const localKey = originalFile
    ? `${originalFile.name}-${originalFile.size}-${originalFile.lastModified}`
    : attachment.file_path || attachment.file_name || attachment.name || `attachment-${Date.now()}`;

  return {
    ...attachment,
    local_key: localKey,
    size: attachment.size || originalFile?.size || data?.text_length || 0,
    name: attachment.name || data?.file_name || originalFile?.name || 'attachment',
    file_name: attachment.file_name || data?.file_name || originalFile?.name || 'attachment',
    file_path: attachment.file_path || data?.file_path,
    file_type: attachment.file_type || data?.file_type || 'file',
    mime_type: attachment.mime_type || data?.mime_type || originalFile?.type,
    preview_url: attachment.preview_url || data?.preview_url,
    image_url: attachment.image_url || data?.preview_url || attachment.file_url,
    text_length: data?.text_length || 0,
    text_content: data?.text_content || '',
    text_preview: data?.text_preview || '',
    upload_status: 'parsed',
    raw: originalFile || null,
  };
};

const mergeAttachments = (previous, nextAttachment) => {
  const nextKey = buildAttachmentIdentity(nextAttachment);
  const filtered = previous.filter((item) => buildAttachmentIdentity(item) !== nextKey);
  return [...filtered, nextAttachment];
};

const extractFilesFromClipboardEvent = (event) => {
  const clipboardItems = Array.from(event.clipboardData?.items || []);
  const clipboardFiles = clipboardItems
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean);

  if (clipboardFiles.length > 0) {
    return clipboardFiles;
  }

  return Array.from(event.clipboardData?.files || []);
};

const inferAttachmentType = (attachment) => {
  if (attachment?.file_type === 'image' || String(attachment?.mime_type || '').startsWith('image/')) {
    return 'image';
  }

  const extension = String(attachment?.file_name || attachment?.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();

  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'doc';
  if (extension === 'ppt' || extension === 'pptx') return 'ppt';
  if (extension === 'txt' || extension === 'md' || extension === 'markdown') return 'txt';

  return 'txt';
};

const toSenderAttachment = (attachment) => ({
  key: buildAttachmentIdentity(attachment),
  name: attachment.file_name || attachment.name,
  url: attachment.image_url || attachment.preview_url || attachment.file_url,
  size: attachment.size || attachment.text_length || 0,
  status: attachment.upload_status === 'uploading' ? 'progress' : 'success',
  type: attachment.mime_type,
  fileType: inferAttachmentType(attachment),
  raw: attachment.raw || null,
  response: attachment,
});

const buildOptimisticSession = ({ message, mode, attachments, existingSession }) => {
  const now = new Date().toISOString();
  const baseTimeline = Array.isArray(existingSession?.timeline) ? existingSession.timeline : [];
  const nextTurnIndex = getNextTurnIndex(baseTimeline);
  const userMessage = buildOptimisticUserMessage(message, attachments, nextTurnIndex);
  const assistantMessage = buildOptimisticAssistantMessage(nextTurnIndex);

  return normalizeSession({
    ...(existingSession || {}),
    title: existingSession?.title || message.slice(0, 80),
    goal: existingSession?.goal || message,
    session_type: mode,
    status: 'running',
    created_at: existingSession?.created_at || now,
    updated_at: now,
    timeline: [...baseTimeline, userMessage, assistantMessage],
  });
};

const BrandMark = ({ isDark, className = 'h-10 w-10' }) => (
  <div
    className={`flex ${className} items-center justify-center rounded-2xl border ${
      isDark
        ? 'border-white/10 bg-white/[0.06] text-slate-100'
        : 'border-slate-200 bg-white text-slate-900'
    }`}
  >
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M8 7h8M8 12h5m-5 5h8M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
      />
    </svg>
  </div>
);

const SidebarToggleIcon = ({ collapsed }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={`h-[18px] w-[18px] transition-transform duration-200 ${collapsed ? 'scale-x-[-1]' : ''}`}
    aria-hidden="true"
  >
    <rect x="3.5" y="4" width="17" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8.5 4.75v14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13.5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15.5 10l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AttachmentPlusIcon = ({ active = false }) => (
  <span
    className={`flex size-4 items-center justify-center text-current transition-transform duration-300 ease-out ${
      active ? 'rotate-45' : 'rotate-0'
    }`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="size-4">
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.457"
        d="M7.5 8.5V15h1V8.5H15v-1H8.5V1h-1v6.5H1v1z"
      />
    </svg>
  </span>
);

const SenderAttachmentTrigger = ({ isDark, active, onClick, slot = 'footer-prefix' }) => (
  <button
    slot={slot}
    type="button"
    onClick={onClick}
    className={`agent-chat-attachment-trigger inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
      isDark
        ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
    aria-label="添加附件"
    title="添加附件"
  >
    <AttachmentPlusIcon active={active} />
  </button>
);

const SessionListItem = ({ session, isActive, isDark, collapsed, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full overflow-hidden rounded-2xl text-left transition ${
      isActive
        ? isDark
          ? 'bg-white/10 text-white'
          : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
        : isDark
          ? 'text-slate-300 hover:bg-white/[0.06]'
          : 'text-slate-700 hover:bg-white hover:shadow-sm'
    } ${collapsed ? 'flex h-12 items-center justify-center p-0' : 'px-3 py-3'}`}
    title={session.title || session.goal}
  >
    {collapsed ? (
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
          isActive
            ? isDark
              ? 'bg-cyan-400/15 text-cyan-200'
              : 'bg-cyan-100 text-cyan-700'
            : isDark
              ? 'bg-white/[0.06] text-slate-200'
              : 'bg-slate-100 text-slate-600'
        }`}
      >
        <span className="text-sm font-semibold">
          {getSessionInitial(session.title || session.goal)}
        </span>
      </div>
    ) : (
      <>
        <div className="truncate text-sm font-medium">{session.title || session.goal}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] ${getStatusTone(session.status, isDark)}`}>
            {statusLabelMap[session.status] || session.status}
          </span>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {formatSessionDate(session.updated_at || session.created_at)}
          </span>
        </div>
      </>
    )}
  </button>
);

const ModeSwitch = ({ mode, setMode, isDark, disabled }) => (
  <div
    className={`inline-flex items-center rounded-full border p-1 ${
      isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'
    }`}
  >
    {[
      { value: 'react', label: 'ReAct' },
      { value: 'cot', label: 'CoT' },
    ].map((item) => {
      const active = mode === item.value;
      return (
        <button
          key={item.value}
          type="button"
          disabled={disabled}
          onClick={() => setMode(item.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            active
              ? isDark
                ? 'bg-white text-slate-950'
                : 'bg-slate-900 text-white'
              : isDark
                ? 'text-slate-300 hover:bg-white/[0.06]'
                : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          {item.label}
        </button>
      );
    })}
  </div>
);

const AgentChat = () => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [draftMessage, setDraftMessage] = useState('');
  const [mode, setMode] = useState('react');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isComposerDragActive, setIsComposerDragActive] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState(null);
  const [streamRecovery, setStreamRecovery] = useState(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [attachmentActionActive, setAttachmentActionActive] = useState(false);
  const [expandedAttachments, setExpandedAttachments] = useState({});

  const fileInputRef = useRef(null);
  const senderWrapperRef = useRef(null);
  const messageListRef = useRef(null);
  const activeStreamRef = useRef(null);
  const activeStreamRunIdRef = useRef(0);
  const userScrolledUpRef = useRef(false);
  const answerAnimationRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add('agent-chat-page');
    document.body.classList.add('agent-chat-page');

    return () => {
      document.documentElement.classList.remove('agent-chat-page');
      document.body.classList.remove('agent-chat-page');
    };
  }, []);

  useEffect(() => {
    void loadSessions();
    return () => {
      cancelActiveStream();
    };
  }, []);

  const cancelActiveStream = () => {
    activeStreamRunIdRef.current += 1;
    activeStreamRef.current?.abort?.();
    activeStreamRef.current = null;
    if (answerAnimationRef.current) {
      window.clearInterval(answerAnimationRef.current);
      answerAnimationRef.current = null;
    }
  };

  const loadSessions = async () => {
    try {
      const data = await agentApi.getUserSessions(20, 0);
      setSessions((data.sessions || []).map(normalizeSession));
    } catch (err) {
      logger.error('Failed to load agent sessions', err);
    }
  };

  const handleFilesUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (files.some((file) => getFileExtension(file.name) === '.doc')) {
      setError(DOC_UPLOAD_ERROR);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const pendingAttachment = {
          local_key: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          file_name: file.name,
          size: file.size,
          file_type: inferAttachmentType({ mime_type: file.type }),
          mime_type: file.type,
          upload_status: 'uploading',
          raw: file,
        };
        setAttachments((previous) => mergeAttachments(previous, pendingAttachment));

        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/api/v1/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const normalizedAttachment = buildAttachmentFromResponse(response.data, file);
        setAttachments((previous) => mergeAttachments(previous, normalizedAttachment));
      }
    } catch (err) {
      logger.error('Failed to upload agent attachment', err);
      setError(err.response?.data?.detail || '附件上传失败，请稍后重试。');
    } finally {
      setAttachmentActionActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploading(false);
    }
  };

  const handleComposerPaste = async (event) => {
    if (loading || uploading) return;
    const clipboardFiles = extractFilesFromClipboardEvent(event);
    if (!clipboardFiles.length) return;

    event.preventDefault();
    await handleFilesUpload(clipboardFiles);
  };

  const handleFileDrop = async (event) => {
    event.preventDefault();
    setIsComposerDragActive(false);
    if (loading || uploading) return;
    await handleFilesUpload(event.dataTransfer.files);
  };

  const handleComposerDragEnter = (event) => {
    event.preventDefault();
    if (loading || uploading) return;
    setIsComposerDragActive(true);
  };

  const handleComposerDragLeave = (event) => {
    event.preventDefault();
    if (!senderWrapperRef.current?.contains(event.relatedTarget)) {
      setIsComposerDragActive(false);
    }
  };

  const handleSenderFileRemove = (event) => {
    const restItems = Array.isArray(event?.detail) ? event.detail : [];
    const restKeys = new Set(restItems.map((item) => item.key || `${item.name}-${item.size || 0}`));
    setAttachments((previous) => previous.filter((item) => restKeys.has(buildAttachmentIdentity(item))));
  };

  const toggleAttachmentPreview = (attachmentKey) => {
    setExpandedAttachments((prev) => ({
      ...prev,
      [attachmentKey]: !prev[attachmentKey],
    }));
  };

  const triggerAttachmentPicker = () => {
    setAttachmentActionActive(true);
    fileInputRef.current?.click();
    window.setTimeout(() => {
      setAttachmentActionActive(false);
    }, 260);
  };

  const handleStopStream = () => {
    cancelActiveStream();
    setLoading(false);
    setCurrentSession((previous) => (
      previous
        ? normalizeSession({
            ...previous,
            status: previous.status === 'completed' ? previous.status : 'interrupted',
          })
        : previous
    ));
  };

  const scrollToBottom = (behavior = 'smooth') => {
    const container = messageListRef.current;
    if (!container) return;
    userScrolledUpRef.current = false;
    setShowScrollToBottom(false);
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const updateScrollToBottomVisibility = () => {
    const container = messageListRef.current;
    if (!container) return;

    const threshold = 120;
    const nearBottom = container.scrollHeight - (container.scrollTop + container.clientHeight) < threshold;
    userScrolledUpRef.current = !nearBottom;
    setShowScrollToBottom(!nearBottom);
  };

  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return undefined;

    const handleScroll = () => {
      updateScrollToBottomVisibility();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    requestAnimationFrame(handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [currentSession?.session_id, currentSession?.timeline?.length]);

  useEffect(() => {
    if (!currentSession) return;

    if (!userScrolledUpRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom(loading ? 'auto' : 'smooth');
      });
    }
  }, [currentSession?.timeline?.length, currentSession?.status, loading]);

  const appendStreamEvent = (eventPayload) => {
    setCurrentSession((previous) => {
      if (!previous) return previous;

      return normalizeSession({
        ...previous,
        status: eventPayload.type === 'completed' ? 'completed' : previous.status,
        timeline: applyStreamEventToTimeline(previous.timeline || [], eventPayload),
      });
    });
  };

  const animateFinalAnswer = (eventPayload) => {
    if (answerAnimationRef.current) {
      window.clearInterval(answerAnimationRef.current);
      answerAnimationRef.current = null;
    }

    const fullText = eventPayload.content || '';
    const chunks = fullText.match(/[\s\S]{1,28}/g) || [''];
    let chunkIndex = 0;
    let nextContent = '';

    setCurrentSession((previous) => {
      if (!previous) return previous;

      return normalizeSession({
        ...previous,
        timeline: applyStreamEventToTimeline(previous.timeline || [], {
          ...eventPayload,
          content: '',
        }),
      });
    });

    answerAnimationRef.current = window.setInterval(() => {
      nextContent += chunks[chunkIndex] || '';
      chunkIndex += 1;

      setCurrentSession((previous) => {
        if (!previous) return previous;

        return normalizeSession({
          ...previous,
          timeline: (previous.timeline || []).map((item) => (
            item.role === 'assistant' && item.turn_index === eventPayload.turn_index
              ? {
                  ...item,
                  content: nextContent,
                  quality_status: eventPayload.quality_status,
                  confidence: eventPayload.confidence,
                  evidence: eventPayload.evidence || [],
                  fallback_used: eventPayload.fallback_used || false,
                }
              : item
          )),
        });
      });

      if (chunkIndex >= chunks.length) {
        window.clearInterval(answerAnimationRef.current);
        answerAnimationRef.current = null;
        appendStreamEvent(eventPayload);
      }
    }, 18);
  };

  const submitCurrentMessage = async () => {
    const message = draftMessage.trim();
    if (!message) return;

    cancelActiveStream();
    const streamRunId = activeStreamRunIdRef.current;
    const requestAttachments = [...attachments];
    const requestContext = { attachments: requestAttachments };
    const nextSession = buildOptimisticSession({
      message,
      mode,
      attachments: requestAttachments,
      existingSession: currentSession,
    });

    setCurrentSession(nextSession);
    setDraftMessage('');
    setAttachments([]);
    setLoading(true);
    setError(null);
    setStreamRecovery(null);

    try {
      activeStreamRef.current = agentApi.createTaskStream({
        message,
        mode,
        context: requestContext,
        sessionId: currentSession?.session_id || null,
        onMessage: (eventPayload) => {
          if (activeStreamRunIdRef.current !== streamRunId) return;

          switch (eventPayload.type) {
            case 'session_created':
            case 'session_resumed':
              setCurrentSession((previous) => (
                previous
                  ? normalizeSession({
                      ...previous,
                      session_id: eventPayload.session_id,
                      status: 'running',
                    })
                  : previous
              ));
              return;
            case 'user_message':
              return;
            case 'completed':
              setCurrentSession((previous) => (
                previous
                  ? normalizeSession({ ...previous, status: 'completed' })
                  : previous
              ));
              return;
            case 'failed':
            case 'error':
              setError(eventPayload.error || '任务执行失败。');
              setCurrentSession((previous) => (
                previous
                  ? normalizeSession({ ...previous, status: 'failed' })
                  : previous
              ));
              return;
            case 'final_answer':
              animateFinalAnswer(eventPayload);
              return;
            default:
              appendStreamEvent(eventPayload);
          }
        },
        onComplete: () => {
          if (activeStreamRunIdRef.current !== streamRunId) return;
          setLoading(false);
          setStreamRecovery(null);
          activeStreamRef.current = null;
          void loadSessions();
        },
        onError: (streamError) => {
          if (activeStreamRunIdRef.current !== streamRunId) return;

          setLoading(false);
          activeStreamRef.current = null;
          if (streamError?.sessionId) {
            setStreamRecovery({
              sessionId: streamError.sessionId,
              recoverable: Boolean(streamError.recoverable),
            });
            setCurrentSession((previous) => (
              previous
                ? normalizeSession({
                    ...previous,
                    session_id: previous.session_id || streamError.sessionId,
                    status: previous.status === 'completed' ? previous.status : 'interrupted',
                  })
                : previous
            ));
          }
          setError(streamError.message || '任务执行失败。');
        },
      });
    } catch (err) {
      logger.error('Failed to start agent task stream', err);
      setLoading(false);
      activeStreamRef.current = null;
      setError(err.message || '任务执行失败。');
    }
  };

  const handleLoadSession = async (sessionId) => {
    try {
      cancelActiveStream();
      setLoading(false);
      setError(null);
      setStreamRecovery(null);
      setAttachments([]);
      const session = await agentApi.getSession(sessionId);
      setCurrentSession(normalizeSession(session));
      setMode(session?.session_type || 'react');
      setMobileSidebarOpen(false);
    } catch (err) {
      logger.error('Failed to load agent session', err);
      setError('会话加载失败。');
    }
  };

  const handleResumeSession = async () => {
    if (!streamRecovery?.sessionId) return;
    await handleLoadSession(streamRecovery.sessionId);
    await loadSessions();
  };

  const handleNewChat = () => {
    cancelActiveStream();
    setCurrentSession(null);
    setDraftMessage('');
    setAttachments([]);
    setError(null);
    setLoading(false);
    setStreamRecovery(null);
    setMobileSidebarOpen(false);
  };

  const handleToggleThinking = (messageId) => {
    setCurrentSession((previous) => (
      previous
        ? normalizeSession({
            ...previous,
            timeline: (previous.timeline || []).map((item) => (
              item.id === messageId
                ? { ...item, thinking_expanded: !item.thinking_expanded }
                : item
            )),
          })
        : previous
    ));
  };

  const filteredSessions = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    if (!keyword) return sessions;

    return sessions.filter((session) =>
      [session.title, session.goal]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [historyQuery, sessions]);

  const senderAttachments = useMemo(
    () => attachments.map(toSenderAttachment),
    [attachments],
  );
  const buildSenderActions = (presets = []) => presets.map((item) => {
    if (item.name !== 'attachment') {
      return item;
    }

    return {
      ...item,
      render: (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            triggerAttachmentPicker();
          }}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
            isDark
              ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          aria-label="添加附件"
          title="添加附件"
        >
          <AttachmentPlusIcon active={attachmentActionActive} />
        </button>
      ),
    };
  });

  const activeSessionId = currentSession?.session_id;
  const hasConversation = Boolean((currentSession?.timeline || []).length);
  const desktopSidebarWidth = desktopSidebarCollapsed ? 0 : 280;
  const pageBackground = isDark ? 'bg-[#0a0f18]' : 'bg-[#fbfcff]';
  const sidebarScrollbarClass = isDark ? 'scrollbar-qw-dark' : 'scrollbar-qw-light';
  const sidebarSurface = isDark
    ? 'border-white/8 bg-[#0d1420] text-white'
    : 'border-slate-200 bg-[#f8f9fb] text-slate-900';
  const panelSurface = isDark
    ? 'border-white/10 bg-[#0f1724]'
    : 'border-slate-200 bg-white';

  return (
    <div className={`agent-chat-page-shell h-[calc(100vh-4rem)] overflow-hidden ${pageBackground}`}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(event) => {
          void handleFilesUpload(event.target.files || []);
        }}
      />

      <div
        className="hidden h-full transition-[grid-template-columns] duration-300 ease-out lg:grid"
        style={{ gridTemplateColumns: `${desktopSidebarWidth}px minmax(0, 1fr)` }}
      >
        <aside
          className={`min-w-0 overflow-hidden transition-all duration-300 ease-out ${
            desktopSidebarCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          aria-hidden={desktopSidebarCollapsed}
        >
          <div className={`flex h-full min-h-0 flex-col border-r ${sidebarSurface}`}>
            <div className="px-4 pb-3 pt-4">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandMark isDark={isDark} className="h-10 w-10" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">Agent 助手</div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>历史会话</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDesktopSidebarCollapsed(true)}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    isDark
                      ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                  aria-label="收起侧边栏"
                  title="收起侧边栏"
                >
                  <SidebarToggleIcon collapsed={false} />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-3">
              <button
                type="button"
                onClick={handleNewChat}
                className={`flex w-full items-center gap-2 rounded-[20px] border px-4 py-3 transition ${
                  isDark
                    ? 'border-white/10 bg-white/[0.08] text-slate-100 hover:bg-white/[0.12]'
                    : 'border-slate-300 bg-slate-200 text-slate-800 hover:bg-slate-300'
                }`}
                title="新建对话"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">新建对话</span>
              </button>

              <div className={`flex items-center rounded-2xl border px-3 ${panelSurface}`}>
                <svg className={`h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="搜索会话"
                  className={`h-11 w-full bg-transparent px-3 text-sm outline-none ${
                    isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>

            <div className={`mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-5 ${sidebarScrollbarClass}`}>
              <div className={`mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.18em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                最近
              </div>

              <div className="space-y-2">
                {filteredSessions.length === 0 ? (
                  <div className={`rounded-2xl px-4 py-5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    暂无会话记录
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <SessionListItem
                      key={session.session_id}
                      session={session}
                      isDark={isDark}
                      collapsed={false}
                      isActive={Boolean(activeSessionId && session.session_id === activeSessionId)}
                      onClick={() => {
                        void handleLoadSession(session.session_id);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          <header className="flex h-16 items-center justify-between px-6">
            <div className="flex min-w-0 items-center gap-3">
              {desktopSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setDesktopSidebarCollapsed(false)}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    isDark
                      ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                  aria-label="展开侧边栏"
                  title="展开侧边栏"
                >
                  <SidebarToggleIcon collapsed />
                </button>
              ) : null}

              <div className="min-w-0">
                {hasConversation ? (
                  <>
                    <div className={`truncate text-sm font-semibold sm:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {currentSession?.title || 'Agent 助手'}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>多轮对话进行中</div>
                  </>
                ) : (
                  <div className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Agent 助手
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentSession?.status ? (
                <span className={`hidden rounded-full px-3 py-1 text-xs sm:inline-flex ${getStatusTone(currentSession.status, isDark)}`}>
                  {statusLabelMap[currentSession.status] || currentSession.status}
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleNewChat}
                className={`inline-flex h-10 items-center rounded-full px-4 text-sm ${
                  isDark
                    ? 'bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]'
                    : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                新对话
              </button>
            </div>
          </header>

          {error ? (
            <div className={`mx-auto mb-4 w-full max-w-[820px] rounded-lg px-4 py-3 text-sm ${
              isDark ? 'bg-rose-500/10 text-rose-200' : 'bg-rose-50 text-rose-700'
            }`}>
              <div className="font-medium">当前任务执行失败</div>
              <div className="mt-1 leading-7">{error}</div>
              {streamRecovery?.recoverable ? (
                <button
                  type="button"
                  onClick={() => void handleResumeSession()}
                  className="mt-2 text-xs font-medium underline"
                >
                  重新加载该会话
                </button>
              ) : null}
            </div>
          ) : null}

          {hasConversation ? (
            <div className="relative min-h-0 flex-1">
              <div ref={messageListRef} className={`h-full overflow-y-auto ${isDark ? 'scrollbar-qw-dark' : 'scrollbar-qw-light'}`}>
                <div className="mx-auto w-full max-w-[820px] px-6 pb-[220px] pt-3">
                  <AgentStepViewer
                    timeline={currentSession?.timeline || []}
                    isDark={isDark}
                    loading={loading}
                    onToggleThinking={handleToggleThinking}
                  />
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-6 pb-5">
                <div className="mx-auto w-full max-w-[820px]">
                  <div className="pointer-events-auto mb-3 flex items-center justify-end px-1">
                    <ModeSwitch mode={mode} setMode={setMode} isDark={isDark} disabled={loading} />
                  </div>

                  {attachments.filter((a) => a.file_type === 'document' && a.text_preview).length > 0 && (
                    <div
                      className={`pointer-events-auto mx-auto mb-3 w-full max-w-[820px] rounded-lg border p-3 ${
                        isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      {attachments
                        .filter((a) => a.file_type === 'document' && a.text_preview)
                        .map((att) => {
                          const key = buildAttachmentIdentity(att);
                          const isExpanded = expandedAttachments[key];
                          return (
                            <div key={key} className="text-xs">
                              <div className="flex items-center justify-between">
                                <span className={`truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                  {att.file_name} ({att.text_length || 0} 字符已解析)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleAttachmentPreview(key)}
                                  className="ml-2 shrink-0 text-sky-500 hover:text-sky-400"
                                >
                                  {isExpanded ? '收起' : '展开预览'}
                                </button>
                              </div>
                              {isExpanded && (
                                <div
                                  className={`mt-2 max-h-40 overflow-y-auto rounded border p-2 text-xs leading-relaxed whitespace-pre-wrap ${
                                    isDark
                                      ? 'border-white/10 bg-white/[0.06] text-slate-300'
                                      : 'border-slate-200 bg-white text-slate-600'
                                  }`}
                                >
                                  {att.text_preview}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <div
                    ref={senderWrapperRef}
                    onPaste={(event) => { void handleComposerPaste(event); }}
                    onDrop={(event) => { void handleFileDrop(event); }}
                    onDragEnter={handleComposerDragEnter}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!loading && !uploading) setIsComposerDragActive(true);
                    }}
                    onDragLeave={handleComposerDragLeave}
                    className={`pointer-events-auto overflow-hidden rounded-[24px] border backdrop-blur-2xl transition ${
                      isComposerDragActive
                        ? isDark
                          ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                          : 'border-cyan-400 bg-cyan-50 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                        : isDark
                          ? 'border-white/10 bg-[#0f1724]/92 shadow-[0_18px_50px_rgba(2,6,23,0.42)]'
                          : 'border-slate-200/90 bg-white/95 shadow-[0_14px_44px_rgba(15,23,42,0.10)]'
                    }`}
                  >
                    <ChatSender
                      className="agent-chat-sender"
                      value={draftMessage}
                      placeholder="给 Agent 发送消息"
                      loading={loading || uploading}
                      actions={(presets) => presets.filter((item) => item.name !== 'attachment')}
                      autosize={{ minRows: 3, maxRows: 8 }}
                      readyToSend={(value) => Boolean(String(value || '').trim())}
                      attachmentsProps={{
                        items: senderAttachments,
                        overflow: 'scrollX',
                        removable: true,
                      }}
                      onChange={(event) => setDraftMessage(event.detail || '')}
                      onSend={() => {
                        void submitCurrentMessage();
                      }}
                      onStop={handleStopStream}
                      onFileRemove={handleSenderFileRemove}
                    >
                      <SenderAttachmentTrigger
                        isDark={isDark}
                        active={attachmentActionActive}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          triggerAttachmentPicker();
                        }}
                      />
                    </ChatSender>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-12">
              <div className="w-full max-w-[900px]">
                <div className="mb-8 text-center">
                  <h1 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    今天想让 Agent 帮你做什么？
                  </h1>
                  <p className={`mx-auto mt-4 max-w-2xl text-sm leading-7 sm:text-base ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    支持文本、图片、文件、多轮追问、思考过程和工具调用，都会留在同一条会话里。
                  </p>
                </div>

                <div className="mx-auto max-w-[820px]">
                  <div className="mb-3 flex items-center justify-end">
                    <ModeSwitch mode={mode} setMode={setMode} isDark={isDark} disabled={loading} />
                  </div>

                  <div
                    ref={senderWrapperRef}
                    onPaste={(event) => { void handleComposerPaste(event); }}
                    onDrop={(event) => { void handleFileDrop(event); }}
                    onDragEnter={handleComposerDragEnter}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!loading && !uploading) setIsComposerDragActive(true);
                    }}
                    onDragLeave={handleComposerDragLeave}
                    className={`overflow-hidden rounded-[24px] border transition ${
                      isComposerDragActive
                        ? isDark
                          ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                          : 'border-cyan-400 bg-cyan-50 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                        : panelSurface
                    }`}
                  >
                    <ChatSender
                      className="agent-chat-sender"
                      value={draftMessage}
                      placeholder="给 Agent 发送消息"
                      loading={loading || uploading}
                      actions={(presets) => presets.filter((item) => item.name !== 'attachment')}
                      autosize={{ minRows: 4, maxRows: 8 }}
                      readyToSend={(value) => Boolean(String(value || '').trim())}
                      attachmentsProps={{
                        items: senderAttachments,
                        overflow: 'scrollX',
                        removable: true,
                      }}
                      onChange={(event) => setDraftMessage(event.detail || '')}
                      onSend={() => {
                        void submitCurrentMessage();
                      }}
                      onStop={handleStopStream}
                      onFileRemove={handleSenderFileRemove}
                    >
                      <SenderAttachmentTrigger
                        isDark={isDark}
                        active={attachmentActionActive}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          triggerAttachmentPicker();
                        }}
                      />
                    </ChatSender>
                  </div>
                </div>

                <div className="mx-auto mt-5 flex max-w-[820px] flex-wrap justify-center gap-2.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setDraftMessage(prompt)}
                      className={`rounded-lg px-3.5 py-2 text-sm transition ${
                        isDark
                          ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.09]'
                          : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showScrollToBottom && hasConversation ? (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className={`fixed bottom-40 right-6 z-30 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
                isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-900 hover:bg-slate-700'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>回到底部</span>
            </button>
          ) : null}
        </main>
      </div>

      <div className="flex h-full flex-col lg:hidden">
        <div className={`fixed inset-y-14 left-0 z-50 w-[286px] border-r transition-transform duration-300 ${sidebarSurface} ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <BrandMark isDark={isDark} className="h-10 w-10" />
              <div>
                <div className="text-sm font-semibold">Agent 助手</div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>历史会话</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-white'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 px-3">
            <button
              type="button"
              onClick={handleNewChat}
              className={`flex w-full items-center justify-center gap-2 rounded-[20px] border px-4 py-3 transition ${
                isDark
                  ? 'border-white/10 bg-white/[0.08] text-slate-100 hover:bg-white/[0.12]'
                  : 'border-slate-300 bg-slate-200 text-slate-800 hover:bg-slate-300'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">新建对话</span>
            </button>

            <div className={`flex items-center rounded-2xl border px-3 ${panelSurface}`}>
              <svg className={`h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="搜索会话"
                className={`h-11 w-full bg-transparent px-3 text-sm outline-none ${
                  isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>

          <div className={`mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-5 ${sidebarScrollbarClass}`}>
            <div className="space-y-2">
              {filteredSessions.length === 0 ? (
                <div className={`rounded-2xl px-4 py-5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  暂无会话记录
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <SessionListItem
                    key={session.session_id}
                    session={session}
                    isDark={isDark}
                    collapsed={false}
                    isActive={Boolean(activeSessionId && session.session_id === activeSessionId)}
                    onClick={() => {
                      void handleLoadSession(session.session_id);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {mobileSidebarOpen ? (
          <button
            type="button"
            aria-label="关闭历史侧栏"
            className="fixed inset-0 z-40 bg-slate-950/45"
            onClick={() => setMobileSidebarOpen(false)}
          />
        ) : null}

        <header className="flex h-16 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
              isDark ? 'text-white hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-white'
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleNewChat}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm ${
              isDark ? 'bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
            }`}
          >
            新对话
          </button>
        </header>

        <div className="min-h-0 flex-1">
          {hasConversation ? (
            <div className="relative h-full">
              <div ref={messageListRef} className={`h-full overflow-y-auto ${isDark ? 'scrollbar-qw-dark' : 'scrollbar-qw-light'}`}>
                <div className="mx-auto w-full max-w-[820px] px-4 pb-[210px] pt-3">
                  <AgentStepViewer
                    timeline={currentSession?.timeline || []}
                    isDark={isDark}
                    loading={loading}
                    onToggleThinking={handleToggleThinking}
                  />
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4">
                <div>
                  <div className="pointer-events-auto mb-3 flex items-center justify-end px-1">
                    <ModeSwitch mode={mode} setMode={setMode} isDark={isDark} disabled={loading} />
                  </div>
                  <div
                    ref={senderWrapperRef}
                    onPaste={(event) => { void handleComposerPaste(event); }}
                    onDrop={(event) => { void handleFileDrop(event); }}
                    onDragEnter={handleComposerDragEnter}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!loading && !uploading) setIsComposerDragActive(true);
                    }}
                    onDragLeave={handleComposerDragLeave}
                    className={`pointer-events-auto overflow-hidden rounded-[22px] border backdrop-blur-2xl transition ${
                      isComposerDragActive
                        ? isDark
                          ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                          : 'border-cyan-400 bg-cyan-50 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                        : isDark
                          ? 'border-white/10 bg-[#0f1724]/92 shadow-[0_16px_44px_rgba(2,6,23,0.40)]'
                          : 'border-slate-200/90 bg-white/95 shadow-[0_12px_36px_rgba(15,23,42,0.10)]'
                    }`}
                  >
                    <ChatSender
                      className="agent-chat-sender"
                      value={draftMessage}
                      placeholder="给 Agent 发送消息"
                      loading={loading || uploading}
                      actions={(presets) => presets.filter((item) => item.name !== 'attachment')}
                      autosize={{ minRows: 3, maxRows: 8 }}
                      readyToSend={(value) => Boolean(String(value || '').trim())}
                      attachmentsProps={{
                        items: senderAttachments,
                        overflow: 'scrollX',
                        removable: true,
                      }}
                      onChange={(event) => setDraftMessage(event.detail || '')}
                      onSend={() => {
                        void submitCurrentMessage();
                      }}
                      onStop={handleStopStream}
                      onFileRemove={handleSenderFileRemove}
                    >
                      <SenderAttachmentTrigger
                        isDark={isDark}
                        active={attachmentActionActive}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          triggerAttachmentPicker();
                        }}
                      />
                    </ChatSender>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-4 pb-10">
              <div className="w-full max-w-[820px]">
                <div className="mb-8 text-center">
                  <h1 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    今天想让 Agent 帮你做什么？
                  </h1>
                </div>
                <div className="mb-3 flex items-center justify-end">
                  <ModeSwitch mode={mode} setMode={setMode} isDark={isDark} disabled={loading} />
                </div>
                <div
                  ref={senderWrapperRef}
                  onPaste={(event) => { void handleComposerPaste(event); }}
                  onDrop={(event) => { void handleFileDrop(event); }}
                  onDragEnter={handleComposerDragEnter}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!loading && !uploading) setIsComposerDragActive(true);
                  }}
                  onDragLeave={handleComposerDragLeave}
                  className={`overflow-hidden rounded-[22px] border transition ${
                    isComposerDragActive
                      ? isDark
                        ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                        : 'border-cyan-400 bg-cyan-50 shadow-[0_0_0_3px_rgba(34,211,238,0.16)]'
                      : panelSurface
                  }`}
                >
                  <ChatSender
                    className="agent-chat-sender"
                    value={draftMessage}
                    placeholder="给 Agent 发送消息"
                    loading={loading || uploading}
                    actions={(presets) => presets.filter((item) => item.name !== 'attachment')}
                    autosize={{ minRows: 4, maxRows: 8 }}
                    readyToSend={(value) => Boolean(String(value || '').trim())}
                    attachmentsProps={{
                      items: senderAttachments,
                      overflow: 'scrollX',
                      removable: true,
                    }}
                    onChange={(event) => setDraftMessage(event.detail || '')}
                    onSend={() => {
                      void submitCurrentMessage();
                    }}
                    onStop={handleStopStream}
                    onFileRemove={handleSenderFileRemove}
                  >
                    <SenderAttachmentTrigger
                      isDark={isDark}
                      active={attachmentActionActive}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        triggerAttachmentPicker();
                      }}
                    />
                  </ChatSender>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
