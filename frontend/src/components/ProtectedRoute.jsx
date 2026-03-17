import { Navigate } from 'react-router-dom';

/**
 * 路由保护组件
 * 检查用户是否已登录，未登录则重定向到登录页
 */
function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
