/**
 * Agent API client.
 */
import apiClient from './apiClient';
import logger from '../utils/logger';

const buildStreamError = (message, extras = {}) =>
  Object.assign(new Error(message), extras);

const classifyHttpError = async (response) => {
  let detail = '';
  try {
    const payload = await response.clone().json();
    detail = payload?.detail || payload?.message || '';
  } catch {
    detail = '';
  }

  if (response.status === 401 || response.status === 403) {
    return buildStreamError(detail || '登录状态已失效，请重新登录后再试。', {
      code: 'AUTH_ERROR',
      status: response.status,
    });
  }

  if ([502, 503, 504].includes(response.status)) {
    return buildStreamError(
      detail || '上游服务暂时不可用或流式代理被中断，请稍后重试。',
      {
        code: 'UPSTREAM_ERROR',
        status: response.status,
      },
    );
  }

  return buildStreamError(detail || `请求失败（HTTP ${response.status}）。`, {
    code: 'HTTP_ERROR',
    status: response.status,
  });
};

const classifyStreamError = (error, sessionId) => {
  if (error?.name === 'AbortError') {
    return buildStreamError('请求已取消。', {
      code: 'ABORTED',
      aborted: true,
      sessionId,
    });
  }

  if (error?.code) {
    return error;
  }

  if (error instanceof TypeError) {
    return buildStreamError(
      sessionId
        ? '网络连接已中断，任务可能仍在后台继续执行，请稍后刷新会话查看结果。'
        : '网络连接已中断，请检查网络或稍后重试。',
      {
        code: 'NETWORK_ERROR',
        recoverable: Boolean(sessionId),
        sessionId,
      },
    );
  }

  return buildStreamError(
    sessionId
      ? '流式连接已中断，任务可能仍在后台继续执行，请稍后刷新会话查看结果。'
      : (error?.message || '任务执行失败。'),
    {
      code: 'STREAM_ERROR',
      recoverable: Boolean(sessionId),
      sessionId,
    },
  );
};

const buildStreamPayload = ({ message, mode, context, sessionId }) => ({
  message,
  mode,
  context,
  session_id: sessionId ?? undefined,
});

const agentApi = {
  createTask: async ({ message, mode = 'react', context = null, sessionId = null }) => {
    const response = await apiClient.post('/api/agent/task', {
      message,
      mode,
      context,
      session_id: sessionId,
    });
    return response.data;
  },

  getSession: async (sessionId) => {
    const response = await apiClient.get(`/api/agent/session/${sessionId}`);
    return response.data;
  },

  getUserSessions: async (limit = 20, offset = 0) => {
    const response = await apiClient.get('/api/agent/sessions', {
      params: { limit, offset },
    });
    return response.data;
  },

  listTools: async () => {
    const response = await apiClient.get('/api/agent/tools');
    return response.data;
  },

  createTaskStream: ({ message, mode, context, sessionId, onMessage, onComplete, onError }) => {
    const token = sessionStorage.getItem('token');
    const hostname = window.location.hostname;
    const baseURL =
      hostname === 'localhost' || hostname === '127.0.0.1'
        ? 'http://127.0.0.1:8000'
        : '';
    const url = `${baseURL}/api/agent/task/stream`;
    const controller = new AbortController();

    let resolvedSessionId = sessionId ?? null;
    let receivedDone = false;
    let completed = false;

    const finish = () => {
      if (completed) {
        return;
      }
      completed = true;
      onComplete?.();
    };

    const run = async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(buildStreamPayload({ message, mode, context, sessionId })),
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw await classifyHttpError(response);
        }

        if (!response.body) {
          throw buildStreamError('未收到流式响应体。', {
            code: 'EMPTY_STREAM',
          });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (receivedDone) {
              finish();
              return;
            }

            throw buildStreamError(
              resolvedSessionId
                ? '连接已断开，任务可能仍在后台继续执行，请稍后刷新会话查看结果。'
                : '连接已断开，请重试。',
              {
                code: 'STREAM_TRUNCATED',
                recoverable: Boolean(resolvedSessionId),
                sessionId: resolvedSessionId,
              },
            );
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith(':') || !line.startsWith('data: ')) {
              continue;
            }

            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              receivedDone = true;
              finish();
              return;
            }

            try {
              const event = JSON.parse(data);
              if (
                ['session_created', 'session_resumed'].includes(event?.type) &&
                event?.session_id
              ) {
                resolvedSessionId = event.session_id;
              }
              onMessage?.(event);
            } catch (error) {
              logger.error('解析 SSE 数据失败', error, data);
            }
          }
        }
      } catch (error) {
        if (completed) {
          return;
        }

        const streamError = classifyStreamError(error, resolvedSessionId);
        if (streamError.aborted) {
          return;
        }

        onError?.(streamError);
      }
    };

    run();

    return {
      abort: () => controller.abort(),
    };
  },
};

export default agentApi;
