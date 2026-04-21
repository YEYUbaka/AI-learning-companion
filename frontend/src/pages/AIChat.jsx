import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import api from '../api/apiClient';
import { getAnchorProps } from '../utils/links';
import { normalizeMarkdownContent } from '../utils/markdown';
import 'katex/dist/katex.min.css';
import { useThemeStore } from '../store/themeStore';

const CHAT_HISTORY_KEY = 'zhixueban_chat_history';
const MAX_SESSIONS = 20;

const createSessionTemplate = (title = '新的对话') => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  createdAt: new Date().toISOString(),
  messages: [],
});

const deriveTitleFromMessages = (messages, fallback = '新的对话') => {
  const firstUser = messages.find((msg) => msg.role === 'user' && msg.content?.trim());
  if (!firstUser) return fallback;
  const text = firstUser.content.trim();
  if (!text) return fallback;
  return text.length > 18 ? `${text.slice(0, 18)}...` : text;
};

const INLINE_MATH_REGEXES = [
  /\\frac\{(?:[^{}]|\{[^{}]*\})+\}\{(?:[^{}]|\{[^{}]*\})+\}/g,
  /\\sqrt\{(?:[^{}]|\{[^{}]*\})+\}/g,
  /\\lim_{(?:[^{}]|\{[^{}]*\})+}/g,
  /\\sum_{(?:[^{}]|\{[^{}]*\})+}\^{(?:[^{}]|\{[^{}]*\})+}/g,
  /\\int_{(?:[^{}]|\{[^{}]*\})+}\^{(?:[^{}]|\{[^{}]*\})+}/g,
  /\\partial/g,
  /\\nabla/g,
  /\\alpha|\\beta|\\gamma|\\theta|\\pi/g,
  /\\sin[^\s,.;:)]*/g,
  /\\cos[^\s,.;:)]*/g,
  /\\tan[^\s,.;:)]*/g,
  /\\log[^\s,.;:)]*/g,
  /\\ln[^\s,.;:)]*/g,
  /\\cdot|\\cdots|\\ldots|\\times|\\leq|\\geq|\\neq|\\infty/g,
];

const wrapIfNeeded = (text, pattern) =>
  text.replace(pattern, (match, offset, whole) => {
    const prevChar = whole[offset - 1];
    const nextChar = whole[offset + match.length];
    if (prevChar === '$' || nextChar === '$') {
      return match;
    }
    return '$' + match + '$';
  });

const isWhitespace = (char) => /\s/.test(char || '');

const extractArgument = (text, start) => {
  let i = start;
  while (i < text.length && isWhitespace(text[i])) i++;
  if (i >= text.length) return null;

  if (text[i] === '{') {
    let depth = 0;
    let j = i;
    while (j < text.length) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (depth !== 0) return null;
    return { content: text.slice(i + 1, j), next: j + 1 };
  }

  if (text[i] === '\\') {
    let j = i + 1;
    while (j < text.length && /[A-Za-z]/.test(text[j])) j++;
    let content = text.slice(i, j);
    if (text[j] === '{') {
      const nested = extractArgument(text, j);
      if (nested) {
        content += `{${nested.content}}`;
        j = nested.next;
      }
    }
    return { content, next: j };
  }

  let j = i;
  while (j < text.length && !isWhitespace(text[j]) && text[j] !== '{' && text[j] !== '}') j++;
  return { content: text.slice(i, j), next: j };
};

const normalizeFractions = (text) => {
  let i = 0;
  let result = '';
  while (i < text.length) {
    if (text.startsWith('\\frac', i)) {
      const originalIndex = i;
      let cursor = i + 5;
      const numerator = extractArgument(text, cursor);
      if (!numerator) {
        result += text.slice(originalIndex, cursor);
        i = cursor;
        continue;
      }
      cursor = numerator.next;
      const denominator = extractArgument(text, cursor);
      if (!denominator) {
        result += text.slice(originalIndex, cursor);
        i = cursor;
        continue;
      }
      result += `\\frac{${numerator.content}}{${denominator.content}}`;
      i = denominator.next;
      continue;
    }
    result += text[i];
    i += 1;
  }
  return result;
};

const normalizeMathContent = (text = '') => {
  if (!text) return text;

  let normalized = normalizeFractions(text);

  // \[ ... \] => $$ ... $$
  normalized = normalized.replace(
    /\\\[(.*?)\\\]/gs,
    (_, inner) => '$$' + inner.trim() + '$$'
  );

  // \( ... \) => $ ... $
  normalized = normalized.replace(
    /\\\((.*?)\\\)/gs,
    (_, inner) => '$' + inner.trim() + '$'
  );

  // 环境如 aligned、cases
  normalized = normalized.replace(
    /\\begin\{(aligned|cases)\}([\s\S]*?)\\end\{\1\}/g,
    (_, env, body) => `$$\\begin{${env}}${body}\\end{${env}}$$`
  );

  INLINE_MATH_REGEXES.forEach((regex) => {
    normalized = wrapIfNeeded(normalized, regex);
  });

  normalized = normalized.replace(/\\\$/g, '$');

  return normalized;
};

// 直接使用 apiClient.js 中已配置的 baseURL，确保一致性
const getApiBase = () => {
  const baseURL = api.defaults.baseURL;
  // console.log('🔍 getApiBase - 使用 apiClient 的 baseURL:', baseURL);
  return baseURL;
};

function AIChat() {
  const [prompt, setPrompt] = useState('');
  const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
  const storageKey = userInfo?.id ? `${CHAT_HISTORY_KEY}_${userInfo.id}` : CHAT_HISTORY_KEY;
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const aiContentRef = useRef('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [providers, setProviders] = useState([]);
  const [currentProvider, setCurrentProvider] = useState('deepseek');
  const messagesContainerRef = useRef(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [sessions, currentSessionId]
  );
  const currentMessages = currentSession?.messages || [];
  const latestMessageContent =
    currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].content || '' : '';

  // 用户滚动状态管理
  const userScrolledUpRef = useRef(false); // 用户是否主动向上滚动
  const isUserScrollingRef = useRef(false); // 用户是否正在滚动
  const scrollTimeoutRef = useRef(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false); // 是否显示"滚动到底部"按钮

  // 检查是否接近底部（距离底部50px以内认为在底部）
  const isNearBottom = (container) => {
    const threshold = 50;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // 处理滚动事件
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    
    // 标记用户正在滚动
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // 检查用户是否在底部
    if (isNearBottom(container)) {
      // 用户在底部，允许自动滚动
      userScrolledUpRef.current = false;
      setShowScrollToBottom(false);
    } else {
      // 用户向上滚动查看历史，暂停自动滚动
      userScrolledUpRef.current = true;
      setShowScrollToBottom(true);
    }
    
    // 滚动停止后重置标记（300ms后认为滚动停止）
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 300);
  };

  // 滚动到底部
  const scrollToBottom = () => {
    if (!messagesContainerRef.current) return;
    userScrolledUpRef.current = false;
    setShowScrollToBottom(false);
    isUserScrollingRef.current = false; // 重置滚动标记
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth'
    });
    // 滚动完成后，确保在底部
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 500);
  };

  // 自动滚动到底部（只在用户没有上翻时）
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    
    // 如果用户正在滚动，不自动滚动
    if (isUserScrollingRef.current) {
      return;
    }
    
    // 如果用户已经上翻查看历史，不自动滚动（除非正在加载，说明是新消息）
    if (userScrolledUpRef.current && !loading) {
      return;
    }
    
    // 延迟滚动，确保DOM已更新
    requestAnimationFrame(() => {
      // 再次检查，避免在延迟期间用户开始滚动
      if (!isUserScrollingRef.current && messagesContainerRef.current) {
        // 如果用户上翻但不在加载状态，不滚动
        if (userScrolledUpRef.current && !loading) {
          return;
        }
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
  }, [currentSessionId, currentMessages.length, latestMessageContent, loading]);

  // 当会话切换时，重置滚动状态并滚动到底部
  useEffect(() => {
    userScrolledUpRef.current = false;
    if (messagesContainerRef.current) {
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
    }
  }, [currentSessionId]);

  // 绑定滚动事件监听器
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 禁用 body 滚动，防止整个页面出现滚动条
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    
    // 禁用 body 滚动
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    
    return () => {
      // 恢复 body 滚动
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  const layout = useMemo(
    () =>
      isDark
        ? {
            root: 'h-[calc(100vh-4rem)] min-h-[640px] w-full overflow-hidden bg-[#05060a] text-white',
            main: 'flex h-full',
            rail: 'w-20 bg-[#0a0c12] border-r border-white/5 flex flex-col items-center py-6 space-y-6 text-white',
            railButton: 'py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 transition w-full',
            railButtonActive: 'bg-white/10 text-white',
            historyAside: 'w-72 bg-[#0f121b] border-r border-white/5 flex flex-col',
            historyCard:
              'w-full text-left px-4 py-3 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition flex flex-col gap-1',
            historyActive: 'ring-2 ring-blue-500/60',
            historyMeta: 'text-xs text-white/40',
            historyDelete: 'text-white/40 hover:text-red-400 text-xs',
            chatWrapper: 'flex-1 flex flex-col bg-slate-900',
            header: 'px-10 py-6 border-b border-white/5',
            headerSub: 'text-xs uppercase tracking-[0.4em] text-white/40 mb-1',
            headerCopy: 'text-sm text-white/40 mt-1',
            select:
              'appearance-none bg-[#151a26] border border-white/10 rounded-2xl px-4 pr-10 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40',
            selectDisabled:
              'bg-[#151a26] border border-white/10 rounded-2xl px-4 pr-10 py-2 text-sm text-white/40 cursor-not-allowed',
            caret: 'text-white/40',
            messages: 'flex-1 overflow-y-auto px-10 py-8 space-y-5 scrollbar-dark',
            emptyStateIcon: 'text-6xl mb-4',
            emptyStateText: 'text-lg text-white/40',
            userBubble:
              'bg-blue-600 text-white shadow-lg border border-transparent',
            aiBubble: 'bg-[#151924] text-white border border-white/5 shadow-lg shadow-black/30',
            userCopy: 'text-white/70 hover:text-white',
            aiCopy: 'text-white/50 hover:text-white',
            codeBlockWrapper: 'my-4 rounded-2xl overflow-hidden border border-white/10 bg-[#090b11]',
            codeHeader:
              'flex items-center justify-between px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60 bg-[#0d1018]',
            codeButton:
              'px-3 py-1 text-[11px] font-semibold bg-white/10 rounded-full hover:bg-white/20 transition text-white',
            blockquote: 'border-l-4 border-white/20 pl-4 italic my-2 text-white/70',
            table: 'min-w-full border border-white/10',
            tableRow: 'border-b border-white/10',
            link: 'text-blue-300 hover:text-blue-100 underline',
            loadingBubble: 'bg-white/10 border border-white/5 text-white/70',
            inputWrapper: 'px-10 py-6 border-t border-white/5 bg-[#07090f]',
            inputField:
              'flex-1 px-5 py-3 rounded-2xl bg-[#111524] border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40',
            sendButton:
              'px-8 py-3 rounded-2xl bg-blue-600 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed',
          }
        : {
            root:
              'h-[calc(100vh-4rem)] min-h-[640px] w-full overflow-hidden bg-gray-50 text-slate-900',
            main: 'flex h-full',
            rail:
              'w-20 bg-white/90 border-r border-slate-200 flex flex-col items-center py-6 space-y-6 text-slate-500',
            railButton:
              'py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition w-full',
            railButtonActive: 'bg-primary/10 text-primary',
            historyAside: 'w-72 bg-white border-r border-slate-200 flex flex-col',
            historyCard:
              'w-full text-left px-4 py-3 rounded-2xl border border-slate-100 bg-white hover:border-primary/40 transition flex flex-col gap-1',
            historyActive: 'ring-1 ring-primary/40',
            historyMeta: 'text-xs text-slate-400',
            historyDelete: 'text-slate-300 hover:text-red-500 text-xs',
            chatWrapper: 'flex-1 flex flex-col bg-white',
            header: 'px-10 py-6 border-b border-slate-100 bg-white',
            headerSub: 'text-xs uppercase tracking-[0.4em] text-slate-400 mb-1',
            headerCopy: 'text-sm text-slate-500 mt-1',
            select:
              'appearance-none bg-white border border-slate-200 rounded-2xl px-4 pr-10 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40',
            selectDisabled:
              'bg-slate-50 border border-slate-200 rounded-2xl px-4 pr-10 py-2 text-sm text-slate-400 cursor-not-allowed',
            caret: 'text-slate-400',
            messages: 'flex-1 overflow-y-auto px-10 py-8 space-y-5 bg-white scrollbar-light',
            emptyStateIcon: 'text-6xl mb-4 text-slate-300',
            emptyStateText: 'text-lg text-slate-400',
            userBubble: 'bg-blue-600 text-white shadow-lg',
            aiBubble: 'bg-white text-slate-900 border border-slate-100 shadow-slate-200',
            userCopy: 'text-white/80 hover:text-white',
            aiCopy: 'text-gray-400 hover:text-gray-600',
            codeBlockWrapper: 'my-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/90 text-white',
            codeHeader:
              'flex items-center justify-between px-4 py-2 text-xs uppercase tracking-[0.3em] text-white bg-slate-900/80',
            codeButton:
              'px-3 py-1 text-[11px] font-semibold bg-white/10 rounded-full hover:bg-white/20 transition text-white',
            blockquote: 'border-l-4 border-gray-300 pl-4 italic my-2 text-gray-700',
            table: 'min-w-full border border-gray-300',
            tableRow: 'border-b border-gray-200',
            link: 'text-blue-600 hover:text-blue-800 underline',
            loadingBubble: 'bg-gray-100 border border-slate-200 text-gray-600',
            inputWrapper: 'px-10 py-6 border-t border-slate-100 bg-white',
            inputField:
              'flex-1 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40',
            sendButton:
              'px-8 py-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition',
          },
    [isDark]
  );

  const updateSessionMessages = (sessionId, updater) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const nextMessages = updater(session.messages);
        const updatedSession = {
          ...session,
          messages: nextMessages,
          title: deriveTitleFromMessages(nextMessages, session.title),
        };
        
        // 不在流式响应中保存，只在完成后保存
        // 保存逻辑移到useEffect中统一处理
        
        return updatedSession;
      })
    );
  };

  // 从后端加载会话列表
  const loadSessionsFromBackend = async () => {
    if (!userInfo?.id) {
      return Promise.resolve();
    }
    
    try {
      const response = await api.get('/api/v1/chat/sessions', {
        params: { limit: MAX_SESSIONS }
      });
      
      if (response.data?.sessions) {
        // 转换后端格式到前端格式
        const convertedSessions = response.data.sessions.map(session => ({
          id: `backend_${session.id}`, // 使用backend_前缀区分
          backendId: session.id, // 保存后端ID
          title: session.title,
          createdAt: session.createdAt,
          messages: session.messages.map(msg => ({
            role: msg.role === 'assistant' ? 'ai' : msg.role,
            content: msg.content,
            provider: msg.provider
          }))
        }));
        
        if (convertedSessions.length > 0) {
          setSessions(convertedSessions);
          setCurrentSessionId(convertedSessions[0].id);
          const lastAiMsg = convertedSessions[0].messages?.filter((m) => m.role === 'ai').pop();
          aiContentRef.current = lastAiMsg?.content || '';
        } else {
          // 如果没有会话，创建一个新的
          await handleNewSession();
        }
      }
      return Promise.resolve();
    } catch (error) {
      // 静默处理404错误（可能是后端路由未注册或服务未启动）
      if (error.response?.status === 404) {
        console.warn('Chat sessions API not available, using local storage');
      } else {
        console.error('Failed to load sessions from backend:', error);
      }
      // 如果后端加载失败，使用默认会话
      const defaultSession = createSessionTemplate();
      setSessions([defaultSession]);
      setCurrentSessionId(defaultSession.id);
      aiContentRef.current = '';
      return Promise.resolve();
    }
  };

  // 保存会话到后端（使用ref避免重复保存）
  const savingRef = useRef(new Set());
  
  const saveSessionToBackend = async (session, force = false) => {
    if (!userInfo?.id) return;
    
    // 防止重复保存
    const sessionKey = session.backendId || session.id;
    if (!force && savingRef.current.has(sessionKey)) {
      return;
    }
    savingRef.current.add(sessionKey);
    
    try {
      const backendId = session.backendId;
      
      // 限制消息数量，避免请求体过大（只保存最近100条消息）
      const MAX_MESSAGES_TO_SAVE = 100;
      const messagesToSave = session.messages.length > MAX_MESSAGES_TO_SAVE
        ? session.messages.slice(-MAX_MESSAGES_TO_SAVE)
        : session.messages;
      
      const messages = messagesToSave.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : msg.role,
        content: msg.content,
        provider: msg.provider
      }));
      
      if (backendId) {
        // 更新现有会话
        await api.put(`/api/v1/chat/sessions/${backendId}`, {
          title: session.title,
          messages: messages
        });
      } else {
        // 创建新会话
        const response = await api.post('/api/v1/chat/sessions', {
          title: session.title
        });
        
        if (response.data?.session) {
          // 更新会话ID
          const newBackendId = response.data.session.id;
          const updatedSession = {
            ...session,
            id: `backend_${newBackendId}`,
            backendId: newBackendId
          };
          
          // 如果有消息，更新会话
          if (messages.length > 0) {
            await api.put(`/api/v1/chat/sessions/${newBackendId}`, {
              messages: messages
            });
          }
          
          // 更新本地状态
          setSessions(prev => prev.map(s => 
            s.id === session.id ? updatedSession : s
          ));
          if (currentSessionId === session.id) {
            setCurrentSessionId(updatedSession.id);
          }
        }
      }
    } catch (error) {
      // 静默处理404和413错误，避免控制台噪音
      if (error.response?.status === 404) {
        // 404可能是会话不存在，尝试创建新会话
        if (session.backendId) {
          console.warn('Session not found, will retry on next save');
        }
      } else if (error.response?.status === 413) {
        // 413请求体过大，减少消息数量重试
        console.warn('Request too large, reducing message count');
        if (session.messages.length > 50) {
          // 只保存最近50条消息
          const reducedMessages = session.messages.slice(-50).map(msg => ({
            role: msg.role === 'ai' ? 'assistant' : msg.role,
            content: msg.content,
            provider: msg.provider
          }));
          
          if (session.backendId) {
            try {
              await api.put(`/api/v1/chat/sessions/${session.backendId}`, {
                title: session.title,
                messages: reducedMessages
              });
            } catch (retryError) {
              console.error('Failed to save with reduced messages:', retryError);
            }
          }
        }
      } else {
        console.error('Failed to save session to backend:', error);
      }
    } finally {
      // 延迟移除，避免立即重复保存
      setTimeout(() => {
        savingRef.current.delete(sessionKey);
      }, 2000);
    }
  };

  const handleNewSession = async () => {
    if (!userInfo?.id) {
      // 未登录用户，使用本地存储
      const newSession = createSessionTemplate();
      setSessions((prev) => {
        const next = [newSession, ...prev];
        return next.slice(0, MAX_SESSIONS);
      });
      setCurrentSessionId(newSession.id);
      aiContentRef.current = '';
      return newSession.id;
    }
    
    // 已登录用户，创建后端会话
    try {
      const response = await api.post('/api/v1/chat/sessions', {
        title: '新的对话'
      });
      
      if (response.data?.session) {
        const backendId = response.data.session.id;
        const newSession = {
          id: `backend_${backendId}`,
          backendId: backendId,
          title: response.data.session.title,
          createdAt: response.data.session.createdAt,
          messages: []
        };
        
        setSessions((prev) => {
          const next = [newSession, ...prev];
          return next.slice(0, MAX_SESSIONS);
        });
        setCurrentSessionId(newSession.id);
        aiContentRef.current = '';
        return newSession.id;
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      // 失败时使用本地会话
      const newSession = createSessionTemplate();
      setSessions((prev) => {
        const next = [newSession, ...prev];
        return next.slice(0, MAX_SESSIONS);
      });
      setCurrentSessionId(newSession.id);
      aiContentRef.current = '';
      return newSession.id;
    }
  };

  const handleSelectSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    const session = sessions.find((item) => item.id === sessionId);
    const lastAiMsg = session?.messages?.filter((m) => m.role === 'ai').pop();
    aiContentRef.current = lastAiMsg?.content || '';
  };

  const handleDeleteSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    
    // 如果会话有后端ID，从后端删除
    if (session?.backendId && userInfo?.id) {
      try {
        await api.delete(`/api/v1/chat/sessions/${session.backendId}`);
      } catch (error) {
        console.error('Failed to delete session from backend:', error);
      }
    }
    
    setSessions((prev) => {
      const filtered = prev.filter((session) => session.id !== sessionId);
      if (filtered.length === 0) {
        const fallback = createSessionTemplate();
        setCurrentSessionId(fallback.id);
        aiContentRef.current = '';
        return [fallback];
      }
      if (sessionId === currentSessionId) {
        setCurrentSessionId(filtered[0].id);
        const lastAiMsg = filtered[0].messages?.filter((m) => m.role === 'ai').pop();
        aiContentRef.current = lastAiMsg?.content || '';
      }
      return filtered;
    });
  };

  // 加载支持的模型列表
  useEffect(() => {
    // 每次调用时重新获取，确保获取到最新的地址
    const apiBase = getApiBase();
    // console.log('AI Chat - 环境信息:', {
    //   hostname: window.location.hostname,
    //   protocol: window.location.protocol,
    //   port: window.location.port,
    //   fullURL: window.location.href,
    //   apiBase: apiBase
    // });
    fetch(`${apiBase}/api/v1/ai/providers`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // console.log('Loaded providers:', data);
        const providersList = data.providers || ['deepseek', 'wenxin', 'xinghuo', 'chatglm', 'moonshot'];
        setProviders(providersList);
        setCurrentProvider(data.current || 'deepseek');
        setSelectedProvider(data.current || 'deepseek');
      })
      .catch(err => {
        console.error('Failed to load providers:', err);
        // 默认值
        const defaultProviders = ['deepseek', 'wenxin', 'xinghuo', 'chatglm', 'moonshot'];
        setProviders(defaultProviders);
        setCurrentProvider('deepseek');
        setSelectedProvider('deepseek');
      });
  }, []);

  // 加载会话：优先从后端加载，如果未登录则从localStorage加载
  // 使用ref标记是否已初始化，避免重复加载
  const initializedRef = useRef(false);
  const lastUserIdRef = useRef(null);
  
  useEffect(() => {
    // 如果用户ID变化，重置初始化标记
    if (lastUserIdRef.current !== userInfo?.id) {
      initializedRef.current = false;
      lastUserIdRef.current = userInfo?.id;
    }
    
    // 如果已经初始化过且有会话，不重复加载（除非用户ID变化）
    if (initializedRef.current && sessions.length > 0) {
      return;
    }
    
    if (userInfo?.id) {
      // 已登录用户，从后端加载
      loadSessionsFromBackend().then(() => {
        initializedRef.current = true;
      });
    } else {
      // 未登录用户，从localStorage加载
      const savedSessions = storageKey ? localStorage.getItem(storageKey) : null;
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed.slice(0, MAX_SESSIONS));
            setCurrentSessionId(parsed[0].id);
            const lastAiMsg =
              parsed[0].messages?.filter((m) => m.role === 'ai').pop() || null;
            aiContentRef.current = lastAiMsg?.content || '';
            initializedRef.current = true;
            return;
          }
        } catch (error) {
          console.error('Failed to load chat sessions:', error);
        }
      }
      const defaultSession = createSessionTemplate();
      setSessions([defaultSession]);
      setCurrentSessionId(defaultSession.id);
      aiContentRef.current = '';
      initializedRef.current = true;
    }
  }, [userInfo?.id, storageKey]);

  // 保存会话：已登录用户保存到后端，未登录用户保存到localStorage
  // 使用更长的防抖时间，避免频繁保存
  useEffect(() => {
    if (!sessions.length) return;
    
    // 未登录用户，立即保存到localStorage（同步操作，不防抖）
    if (!userInfo?.id) {
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(sessions));
      }
      return;
    }
    
    // 已登录用户，保存到后端（防抖处理，避免频繁请求）
    // 只在非加载状态时保存，避免流式响应中频繁保存
    if (loading) return;
    
    const timeoutId = setTimeout(() => {
      // 只保存当前活跃的会话，避免保存所有会话
      const activeSession = sessions.find(s => s.id === currentSessionId);
      if (activeSession && (activeSession.messages.length > 0 || activeSession.title !== '新的对话')) {
        saveSessionToBackend(activeSession);
      }
    }, 2000); // 2秒防抖，减少请求频率
    
    return () => {
      // 组件卸载前，如果有待保存的会话，立即保存（不等待防抖）
      clearTimeout(timeoutId);
      if (!loading) {
        const activeSession = sessions.find(s => s.id === currentSessionId);
        if (activeSession && (activeSession.messages.length > 0 || activeSession.title !== '新的对话')) {
          saveSessionToBackend(activeSession, true); // 强制保存
        }
      }
    };
  }, [sessions, userInfo?.id, storageKey, currentSessionId, loading]);
  
  // 页面可见性变化时保存（用户切换标签页或最小化窗口时）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessions.length > 0) {
        // 页面隐藏时，立即保存
        if (userInfo?.id) {
          const activeSession = sessions.find(s => s.id === currentSessionId);
          if (activeSession && (activeSession.messages.length > 0 || activeSession.title !== '新的对话')) {
            saveSessionToBackend(activeSession, true); // 强制保存
          }
        } else {
          // 未登录用户，保存到localStorage
          if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(sessions));
          }
        }
      } else if (!document.hidden && sessions.length === 0) {
        // 页面重新可见且没有会话时，重新加载
        if (userInfo?.id) {
          initializedRef.current = false;
          loadSessionsFromBackend();
        } else {
          const savedSessions = storageKey ? localStorage.getItem(storageKey) : null;
          if (savedSessions) {
            try {
              const parsed = JSON.parse(savedSessions);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSessions(parsed.slice(0, MAX_SESSIONS));
                setCurrentSessionId(parsed[0].id);
                const lastAiMsg =
                  parsed[0].messages?.filter((m) => m.role === 'ai').pop() || null;
                aiContentRef.current = lastAiMsg?.content || '';
              }
            } catch (error) {
              console.error('Failed to load chat sessions:', error);
            }
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessions, userInfo?.id, storageKey, currentSessionId]);

  // 自动滚动到底部
  // 复制功能
  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !prompt.trim()) return;

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = handleNewSession();
    }

    // 用户发送消息时，强制滚动到底部
    userScrolledUpRef.current = false;
    setShowScrollToBottom(false);
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);

    setLoading(true);
    const userMsg = { role: 'user', content: prompt };
    const currentPrompt = prompt;
    setPrompt('');

    // 重置 AI 内容引用
    aiContentRef.current = '';

    const sessionForHistory =
      sessions.find((session) => session.id === activeSessionId) || {};
    const recentHistory = (sessionForHistory.messages || [])
      .filter((msg) => msg.content && msg.content.trim())
      .slice(-20)
      .map((msg) => ({
        role: msg.role === 'ai' ? 'assistant' : msg.role,
        content: msg.content.trim(),
      }));

    // console.log('📝 构建的对话历史:', {
    //   原始消息数: sessionForHistory.messages?.length || 0,
    //   过滤后消息数: recentHistory.length,
    //   历史内容: recentHistory.map(
    //     (m, idx) => `[${idx + 1}] ${m.role}: ${m.content.substring(0, 50)}...`
    //   ),
    // });
    
    // 详细打印历史消息（用于调试）
    if (recentHistory.length > 0) {
      // console.log('📋 历史消息详情:', recentHistory);
    } else {
      // console.warn('⚠️ 警告：没有历史消息，AI将无法记住之前的对话！');
    }
    
    updateSessionMessages(activeSessionId, (msgs) => [
      ...msgs,
      userMsg,
      { role: 'ai', content: '' },
    ]);

    try {
      // 每次调用时重新获取，确保获取到最新的地址
      const apiBase = getApiBase();
      
      const requestBody = { 
        prompt: currentPrompt,
        provider: selectedProvider,  // 发送选中的模型
        history: recentHistory  // 发送对话历史用于上下文记忆
      };
      // console.log('📤 发送请求:', {
      //   模型: selectedProvider,
      //   当前问题: currentPrompt,
      //   历史消息数: recentHistory.length,
      //   完整请求体: requestBody
      // });
      // console.log('AI Chat - 环境信息:', {
      //   hostname: window.location.hostname,
      //   protocol: window.location.protocol,
      //   port: window.location.port,
      //   fullURL: window.location.href,
      //   apiBase: apiBase
      // });
      
      const requestUrl = `${apiBase}/api/v1/ai/ask/stream`;
      // console.log('请求URL:', requestUrl);
      // console.log('请求配置:', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(requestBody),
      // });
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // console.log('收到响应:', {
      //   status: response.status,
      //   statusText: response.statusText,
      //   headers: Object.fromEntries(response.headers.entries()),
      // });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('请求失败:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // 保留最后一个不完整的块
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            if (data.trim() === '[DONE]') {
              setLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content' && parsed.content) {
                aiContentRef.current += parsed.content;
                
                // 使用引用值更新，避免重复
                updateSessionMessages(activeSessionId, (msgs) => {
                  if (!msgs.length) return msgs;
                  const next = [...msgs];
                  const lastIndex = next.length - 1;
                  next[lastIndex] = {
                    ...next[lastIndex],
                    content: aiContentRef.current,
                    provider: selectedProvider, // 保存使用的模型
                  };
                  return next;
                });
              } else if (parsed.type === 'error') {
                updateSessionMessages(activeSessionId, (msgs) => {
                  if (!msgs.length) return msgs;
                  const next = [...msgs];
                  const lastIndex = next.length - 1;
                  if (next[lastIndex].role === 'ai' && next[lastIndex].content === '') {
                    next[lastIndex] = {
                      ...next[lastIndex],
                      content: `❌ ${parsed.content}`,
                      provider: selectedProvider,
                    };
                  }
                  return next;
                });
                setLoading(false);
                return;
              } else if (parsed.type === 'done') {
                // 流式响应完成，确保保存会话
                setLoading(false);
                // 使用函数式更新获取最新的sessions状态
                setSessions(prevSessions => {
                  const currentSession = prevSessions.find(s => s.id === activeSessionId);
                  if (currentSession && userInfo?.id) {
                    // 异步保存，不阻塞状态更新
                    setTimeout(() => {
                      saveSessionToBackend(currentSession, true); // 强制保存
                    }, 100);
                  } else if (currentSession && !userInfo?.id && storageKey) {
                    // 未登录用户，立即保存到localStorage
                    setTimeout(() => {
                      const allSessions = prevSessions;
                      localStorage.setItem(storageKey, JSON.stringify(allSessions));
                    }, 100);
                  }
                  return prevSessions;
                });
                return;
              }
            } catch (e) {
              console.error('Parse error:', data, e);
            }
          }
        }
      }

      // 处理最后的 buffer
      if (buffer.trim()) {
        const trimmedBuffer = buffer.trim();
        if (trimmedBuffer.startsWith('data: ')) {
          const data = trimmedBuffer.slice(6).trim();
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content' && parsed.content) {
                aiContentRef.current += parsed.content;
                updateSessionMessages(activeSessionId, (msgs) => {
                  if (!msgs.length) return msgs;
                  const next = [...msgs];
                  const lastIndex = next.length - 1;
                  next[lastIndex] = {
                    ...next[lastIndex],
                    content: aiContentRef.current,
                    provider: selectedProvider,
                  };
                  return next;
                });
              }
            } catch (e) {
              console.error('Final buffer parse error:', e);
            }
          }
        }
      }

    } catch (err) {
      console.error('Streaming error:', err);
      updateSessionMessages(activeSessionId, (msgs) => {
        if (!msgs.length) return msgs;
        const next = [...msgs];
        const lastIndex = next.length - 1;
        if (next[lastIndex].role === 'ai' && next[lastIndex].content === '') {
          next[lastIndex] = {
            ...next[lastIndex],
            content: '❌ 请求失败，请检查后端服务是否启动',
          };
        }
        return next;
      });
    } finally {
      setLoading(false);
      // 流式响应完成，确保保存会话（强制保存）
      // 使用函数式更新获取最新的sessions状态
      setSessions(prevSessions => {
        if (userInfo?.id && activeSessionId) {
          const currentSession = prevSessions.find(s => s.id === activeSessionId);
          if (currentSession && currentSession.messages.length > 0) {
            setTimeout(() => {
              saveSessionToBackend(currentSession, true); // 强制保存
            }, 100);
          }
        } else if (!userInfo?.id && activeSessionId && storageKey) {
          // 未登录用户，立即保存到localStorage
          setTimeout(() => {
            localStorage.setItem(storageKey, JSON.stringify(prevSessions));
          }, 100);
        }
        return prevSessions;
      });
    }
  };

  return (
    <div className={layout.root}>
      <div className={layout.main}>
        <aside className={layout.historyAside}>
          <div className={`px-6 pt-6 pb-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <p
                className={`text-xs tracking-[0.3em] uppercase ${
                  isDark ? 'text-white/60' : 'text-slate-400'
                }`}
              >
                历史记录
              </p>
              <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                {sessions.length}/{MAX_SESSIONS}
              </span>
            </div>
            <h2 className={`text-xl font-semibold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>所有对话</h2>
            <button
              onClick={handleNewSession}
              className="w-full mt-4 rounded-2xl bg-blue-600 py-2 text-sm font-semibold shadow-lg text-white hover:bg-blue-700"
            >
              + 新建对话
            </button>
          </div>
          <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 ${isDark ? 'scrollbar-dark' : 'scrollbar-light'}`}>
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`${layout.historyCard} ${
                  currentSessionId === session.id ? layout.historyActive : 'ring-0'
                }`}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{session.title}</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    className={layout.historyDelete}
                  >
                    ✕
                  </button>
                </div>
                <p className={layout.historyMeta}>{new Date(session.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </aside>

        <div className={layout.chatWrapper}>
          <div className={`${layout.header} flex items-center justify-between`}>
            <div>
              <p className={layout.headerSub}>智学伴 · AI 助手</p>
              <h1 className="text-2xl font-semibold">智能对话中心</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className={`text-sm ${isDark ? 'text-white/50' : 'text-slate-500'}`}>模型</div>
              <div className="relative">
                {providers.length > 0 ? (
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    disabled={loading}
                    className={layout.select}
                  >
                    {providers.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider === 'deepseek'
                          ? 'DeepSeek'
                          : provider === 'wenxin'
                          ? '文心一言'
                          : provider === 'xinghuo'
                          ? '星火'
                          : provider === 'chatglm'
                          ? 'ChatGLM'
                          : provider === 'moonshot'
                          ? 'Moonshot'
                          : provider}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select disabled className={layout.selectDisabled}>
                    <option>加载中...</option>
                  </select>
                )}
                <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${layout.caret}`}>
                  ⌄
                </span>
              </div>
            </div>
          </div>

          <div ref={messagesContainerRef} className={`${layout.messages} relative`}>
            {/* 滚动到底部按钮 */}
            {showScrollToBottom && (
              <button
                onClick={scrollToBottom}
                className={`fixed bottom-24 right-8 z-50 px-4 py-2 rounded-full shadow-lg transition-all hover:scale-105 ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                title="滚动到底部"
              >
                <span className="text-sm font-medium">↓ 回到底部</span>
              </button>
            )}
            
            {currentMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24">
                <div className={`${layout.emptyStateIcon}`}>💬</div>
                <p className={layout.emptyStateText}>开始提问，AI 将实时生成回答</p>
              </div>
            )}

            {currentMessages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-3xl px-5 py-4 relative group ${
                    msg.role === 'user' ? layout.userBubble : layout.aiBubble
                  }`}
                >
                  {msg.role === 'user' && msg.content && (
                    <button
                      onClick={() => copyToClipboard(msg.content, `user-${index}`)}
                      className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs ${layout.userCopy}`}
                      title="复制提问"
                    >
                      {copiedIndex === `user-${index}` ? '已复制' : '复制'}
                    </button>
                  )}
                  {msg.role === 'ai' && msg.content && (
                    <button
                      onClick={() => copyToClipboard(msg.content, index)}
                      className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs ${layout.aiCopy}`}
                      title="复制回答"
                    >
                      {copiedIndex === index ? '已复制' : '复制'}
                    </button>
                  )}

                  {msg.role === 'user' ? (
                    <p className="text-base whitespace-pre-wrap break-words pr-8">{msg.content}</p>
                  ) : (
                    <div className={`prose prose-sm max-w-none pr-10 ${isDark ? 'prose-invert' : ''}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          code: ({ node, inline, className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            const language = match ? match[1] : '';

                            return !inline ? (
                              <div className={layout.codeBlockWrapper}>
                                <div className={layout.codeHeader}>
                                  <span>{(language || 'code').toUpperCase()}</span>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(codeString, `code-${index}-${language || 'text'}`)
                                    }
                                    className={layout.codeButton}
                                    title="复制代码"
                                  >
                                    {copiedIndex === `code-${index}-${language || 'text'}` ? '已复制' : '复制'}
                                  </button>
                                </div>
                                <SyntaxHighlighter
                                  language={language || 'text'}
                                  style={vscDarkPlus}
                                  PreTag="div"
                                  customStyle={{
                                    margin: 0,
                                    borderRadius: 0,
                                    background: 'transparent',
                                  }}
                                  {...props}
                                >
                                  {codeString}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code
                                className={`px-1.5 py-0.5 rounded text-sm ${
                                  isDark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-800'
                                }`}
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="ml-2">{children}</li>,
                          blockquote: ({ children }) => <blockquote className={layout.blockquote}>{children}</blockquote>,
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2">
                              <table className={layout.table}>{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className={isDark ? 'bg-white/10' : 'bg-gray-100'}>{children}</thead>,
                          tbody: ({ children }) => <tbody>{children}</tbody>,
                          tr: ({ children }) => <tr className={layout.tableRow}>{children}</tr>,
                          th: ({ children }) => <th className="px-4 py-2 text-left font-semibold">{children}</th>,
                          td: ({ children }) => <td className="px-4 py-2">{children}</td>,
                          a: ({ children, href }) => (
                            <a {...getAnchorProps(href)} className={layout.link}>
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {normalizeMarkdownContent(normalizeMathContent(msg.content))}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className={`${layout.loadingBubble} rounded-2xl px-4 py-2 text-sm`}>AI 正在思考...</div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className={layout.inputWrapper}>
            <div className="flex gap-4">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入你的问题..."
                className={layout.inputField}
              />
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className={layout.sendButton}
              >
                发送
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
