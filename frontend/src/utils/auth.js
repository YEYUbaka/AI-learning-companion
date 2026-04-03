/**
 * 用户认证工具函数
 * 统一从 sessionStorage 获取用户信息，禁止使用 localStorage 存储敏感数据
 */

export function getUserInfo() {
  const raw = sessionStorage.getItem('userInfo');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getUserId() {
  return getUserInfo()?.id || null;
}

export function getToken() {
  return sessionStorage.getItem('token');
}
