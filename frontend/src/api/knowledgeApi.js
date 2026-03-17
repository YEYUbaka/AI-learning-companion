/**
 * 知识库 API 客户端
 */
import apiClient from './apiClient';

export const searchKnowledge = async (query, { limit = 5, gradeLevel, subject } = {}) => {
  const params = new URLSearchParams({ q: query, limit });
  if (gradeLevel) params.append('grade_level', gradeLevel);
  if (subject) params.append('subject', subject);
  const res = await apiClient.get(`/api/v1/knowledge/search?${params}`);
  return res.data;
};

export const getKnowledgeStats = async () => {
  const res = await apiClient.get('/api/v1/knowledge/stats');
  return res.data;
};

export const listDocuments = async () => {
  const res = await apiClient.get('/api/v1/knowledge/documents');
  return res.data;
};

export const getDocumentContent = async (docId) => {
  const res = await apiClient.get(`/api/v1/knowledge/documents/${docId}/content`);
  return res.data;
};

export const registerDocument = async (filePath, title) => {
  const res = await apiClient.post('/api/v1/knowledge/documents', { file_path: filePath, title });
  return res.data;
};

export const createDocumentOnline = async (data) => {
  const res = await apiClient.post('/api/v1/knowledge/documents/online', data);
  return res.data;
};

export const updateDocument = async (docId, data) => {
  const res = await apiClient.put(`/api/v1/knowledge/documents/${docId}`, data);
  return res.data;
};

export const uploadDocuments = async (files) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  const res = await apiClient.post('/api/v1/knowledge/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const deleteDocument = async (docId) => {
  const res = await apiClient.delete(`/api/v1/knowledge/documents/${docId}`);
  return res.data;
};

export const reindexDocument = async (docId) => {
  const res = await apiClient.post(`/api/v1/knowledge/documents/${docId}/reindex`);
  return res.data;
};

export const scanCorpus = async () => {
  const res = await apiClient.post('/api/v1/knowledge/scan');
  return res.data;
};
