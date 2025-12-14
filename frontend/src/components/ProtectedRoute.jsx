import { Navigate } from 'react-router-dom';

/**
 * 路由保护组件
 * 检查用户是否已登录，未登录则重定向到登录页
 */
function ProtectedRoute({ children }) {
  // 检查是否有token
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  
  if (!token) {
    // 未登录，重定向到登录页
    return <Navigate to="/login" replace />;
  }
  
  // 已登录，渲染子组件
  return children;
}

export default ProtectedRoute;

