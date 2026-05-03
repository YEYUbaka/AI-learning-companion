import { Navigate } from 'react-router-dom';

function decodeJwtPayload(token) {
  try {
    const [, payloadBase64] = token.split('.');
    return JSON.parse(atob(payloadBase64));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

/**
 * 路由保护组件
 * 检查用户是否已登录且 token 未过期，否则重定向到登录页
 */
function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isTokenExpired(token)) {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userInfo');
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
