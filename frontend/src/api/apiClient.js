import axios from 'axios';

// 自动检测后端API地址
// 如果前端运行在开发环境，使用 localhost
// 如果前端运行在生产环境，使用当前域名（去掉端口，使用8000端口）
const getBaseURL = () => {
  // 开发环境：使用 localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }
  
  // 生产环境：使用当前域名，后端端口8000
  // 如果前端在 5173 端口，后端在 8000 端口
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // 检查是否是IP地址
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    // IP地址：直接使用IP:8000
    return `${protocol}//${hostname}:8000`;
  } else {
    // 域名：使用域名:8000（或根据实际情况调整）
    return `${protocol}//${hostname}:8000`;
  }
};

// 创建 Axios 实例，配置基础 URL
const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10秒超时
});


// 请求拦截器（可用于添加 Token）
api.interceptors.request.use(
  (config) => {
    // 优先使用sessionStorage中的token，如果没有则使用localStorage（向后兼容）
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器（统一处理错误）
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // 如果是401未授权错误，清除token并跳转到登录页
      if (error.response.status === 401) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        // 如果不在登录页，则跳转
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// 文件上传相关API
export const uploadFile = async (formData) => {
  return api.post('/api/v1/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000,
  });
};

// 学习计划相关API
export const generatePlan = async (data) => {
  // 生成学习计划涉及 AI 推理，响应可能超过默认 10s，单独放宽超时
  return api.post('/api/v1/ai/plan/generate', data, {
    timeout: 60000,
  });
};

export const getUserPlans = async (userId) => {
  return api.get(`/api/v1/ai/plan/list/${userId}`);
};

export const getPlan = async (planId) => {
  return api.get(`/api/v1/ai/plan/${planId}`);
};

export const deletePlan = async (planId) => {
  return api.delete(`/api/v1/ai/plan/${planId}`);
};

// 测评相关API
export const generateQuiz = async (payload) => {
  return api.post('/api/v1/quiz/generate', payload, {
    timeout: 120000,
  });
};

export const submitQuiz = async (payload) => {
  return api.post('/api/v1/quiz/submit', payload, {
    timeout: 60000,
  });
};

export const getQuizHistory = async (userId) => {
  return api.get(`/api/v1/quiz/history/${userId}`);
};

export const getQuizDetail = async (quizId) => {
  return api.get(`/api/v1/quiz/${quizId}`);
};

// 智能组卷相关API
export const generatePaper = async (config) => {
  return api.post('/api/v1/quiz/paper/generate', config, {
    timeout: 240000,
  });
};

export const getPaper = async (paperId, userId) => {
  return api.get(`/api/v1/quiz/paper/${paperId}?user_id=${userId}`);
};

export const listPapers = async (userId, skip = 0, limit = 20) => {
  return api.get(`/api/v1/quiz/paper/list/${userId}?skip=${skip}&limit=${limit}`);
};

export const deletePaper = async (paperId, userId) => {
  return api.delete(`/api/v1/quiz/paper/${paperId}?user_id=${userId}`);
};

export const exportPaper = async (paperId, userId, format = 'pdf', includeAnswer = true) => {
  return api.get(`/api/v1/quiz/paper/${paperId}/export?user_id=${userId}&format=${format}&include_answer=${includeAnswer}`, {
    responseType: 'blob'
  });
};

// 试卷模板相关API
export const createTemplate = async (templateData) => {
  return api.post('/api/v1/quiz/template/create', templateData);
};

export const listTemplates = async (userId) => {
  return api.get(`/api/v1/quiz/template/list/${userId}`);
};

export const deleteTemplate = async (templateId, userId) => {
  return api.delete(`/api/v1/quiz/template/${templateId}?user_id=${userId}`);
};

export const getDefaultTemplate = async (gradeLevel, subject = null) => {
  const params = subject ? `?grade_level=${gradeLevel}&subject=${subject}` : `?grade_level=${gradeLevel}`;
  return api.get(`/api/v1/quiz/template/default${params}`);
};

export const getRecommendedTemplate = async (gradeLevel, subject = null, totalQuestions = null, provider = null, timeLimit = null, title = null) => {
  let params = `?grade_level=${gradeLevel}`;
  if (subject) params += `&subject=${subject}`;
  if (totalQuestions !== null && totalQuestions !== undefined) params += `&total_questions=${totalQuestions}`;
  if (provider) params += `&provider=${provider}`;
  if (timeLimit !== null && timeLimit !== undefined) params += `&time_limit=${timeLimit}`;
  if (title) params += `&title=${encodeURIComponent(title)}`;
  return api.get(`/api/v1/quiz/template/recommend${params}`, { timeout: 30000 }); // 30秒超时，AI推荐可能需要较长时间
};

// 数据分析相关API
export const getProgress = async (userId) => {
  return api.get(`/api/v1/analytics/progress/${userId}`);
};

export const getDetailedStats = async (userId) => {
  return api.get(`/api/v1/analytics/stats/${userId}`);
};

export const downloadReport = async (userId) => {
  window.open(`${api.defaults.baseURL}/api/v1/analytics/report/${userId}`, '_blank');
};

// 管理后台API
export const getDashboardStats = async () => {
  return api.get('/api/v1/admin/dashboard');
};

export const getChartData = async (days = 7) => {
  return api.get(`/api/v1/admin/chart-data?days=${days}`);
};

export const getUsers = async (skip = 0, limit = 100) => {
  return api.get(`/api/v1/admin/users?skip=${skip}&limit=${limit}`);
};

export const updateUserRole = async (userId, role) => {
  return api.put(`/api/v1/admin/users/${userId}/role?role=${role}`);
};

export const getAPILogs = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.skip !== undefined) queryParams.append('skip', params.skip);
  if (params.limit !== undefined) queryParams.append('limit', params.limit);
  if (params.provider) queryParams.append('provider', params.provider);
  if (params.source) queryParams.append('source', params.source);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  return api.get(`/api/v1/admin/api-logs?${queryParams.toString()}`);
};

export const getPrompts = async (skip = 0, limit = 100) => {
  return api.get(`/api/v1/admin/prompts?skip=${skip}&limit=${limit}`);
};

export const getPrompt = async (promptId) => {
  return api.get(`/api/v1/admin/prompts/${promptId}`);
};

export const getPromptsByName = async (name) => {
  return api.get(`/api/v1/admin/prompts/name/${name}`);
};

export const createPrompt = async (data) => {
  return api.post('/api/v1/admin/prompts', data);
};

export const updatePrompt = async (promptId, data) => {
  return api.put(`/api/v1/admin/prompts/${promptId}`, data);
};

export const deletePrompt = async (promptId) => {
  return api.delete(`/api/v1/admin/prompts/${promptId}`);
};

export const enablePromptVersion = async (name, version) => {
  return api.post(`/api/v1/admin/prompts/${name}/enable/${version}`);
};

export const getModelConfigs = async (skip = 0, limit = 100) => {
  return api.get(`/api/v1/admin/models?skip=${skip}&limit=${limit}`);
};

export const getModelConfig = async (configId) => {
  return api.get(`/api/v1/admin/models/${configId}`);
};

export const createModelConfig = async (data) => {
  return api.post('/api/v1/admin/models', data);
};

export const updateModelConfig = async (configId, data) => {
  return api.put(`/api/v1/admin/models/${configId}`, data);
};

export const deleteModelConfig = async (configId) => {
  return api.delete(`/api/v1/admin/models/${configId}`);
};

export const testModelCall = async (providerName, prompt) => {
  return api.post(
    '/api/v1/admin/test-model-call',
    {
      provider_name: providerName,
      prompt: prompt,
    },
    {
      timeout: 60000,
    }
  );
};

export const getSystemConfig = async () => {
  return api.get('/api/v1/admin/system-config');
};

export const updateSystemConfig = async (data) => {
  return api.put('/api/v1/admin/system-config', data);
};

// 学习地图API
export const uploadLearningMapFile = async (formData) => {
  return api.post('/api/v1/learning-map/upload-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
};

export const generateLearningMap = async (data) => {
  // 知识图谱生成需要较长时间，设置超时时间为180秒
  return api.post('/api/v1/learning-map/generate', data, {
    timeout: 180000  // 180秒超时（3分钟）
  });
};

export const getLearningMapGraph = async (userId, sessionId) => {
  const query = sessionId ? `?session_id=${sessionId}` : '';
  return api.get(`/api/v1/learning-map/${userId}/graph${query}`);
};

export const getLearningMapHistory = async (userId, limit = 20) => {
  return api.get(`/api/v1/learning-map/${userId}/history?limit=${limit}`);
};

export const deleteLearningMapSession = async (userId, sessionId) => {
  return api.delete(`/api/v1/learning-map/${userId}/sessions/${sessionId}`);
};

export default api;

