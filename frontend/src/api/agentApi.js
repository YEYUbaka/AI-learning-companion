/**
 * Agent API 客户端
 */
import apiClient from './apiClient';

const agentApi = {
  /**
   * 创建并执行 Agent 任务
   */
  createTask: async (goal, mode = 'react') => {
    const response = await apiClient.post('/api/agent/task', {
      goal,
      mode
    });
    return response.data;
  },

  /**
   * 获取会话详情
   */
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/api/agent/session/${sessionId}`);
    return response.data;
  },

  /**
   * 获取用户的会话列表
   */
  getUserSessions: async (limit = 20, offset = 0) => {
    const response = await apiClient.get('/api/agent/sessions', {
      params: { limit, offset }
    });
    return response.data;
  },

  /**
   * 列出可用工具
   */
  listTools: async () => {
    const response = await apiClient.get('/api/agent/tools');
    return response.data;
  },

  /**
   * 流式执行 Agent 任务
   * @param {string} goal - 任务目标
   * @param {string} mode - 执行模式
   * @param {function} onMessage - 消息回调
   * @param {function} onComplete - 完成回调
   * @param {function} onError - 错误回调
   * @returns {EventSource} EventSource 实例
   */
  createTaskStream: (goal, mode, onMessage, onComplete, onError) => {
    const token = sessionStorage.getItem('token');
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const baseURL = (hostname === 'localhost' || hostname === '127.0.0.1')
      ? 'http://127.0.0.1:8000'
      : `${protocol}//${hostname}:8000`;

    // 构建 URL（包含认证 token）
    const url = `${baseURL}/api/agent/task/stream`;

    // 使用 fetch 进行 POST 请求并获取流式响应
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ goal, mode })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // 读取流式数据
        const readStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              onComplete();
              return;
            }

            // 解码数据
            buffer += decoder.decode(value, { stream: true });

            // 按行分割
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留最后一个不完整的行

            // 处理每一行
            lines.forEach(line => {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();

                if (data === '[DONE]') {
                  onComplete();
                  return;
                }

                try {
                  const event = JSON.parse(data);
                  onMessage(event);
                } catch (e) {
                  console.error('解析 SSE 数据失败:', e, data);
                }
              }
            });

            // 继续读取
            readStream();
          }).catch(error => {
          onError(error);
          });
        };

        readStream();
      })
      .catch(error => {
        onError(error);
      });
  }
};

export default agentApi;
