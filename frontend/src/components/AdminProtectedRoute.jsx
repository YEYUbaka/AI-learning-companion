/**
 * 管理员路由保护组件
 * 作者：智学伴开发团队
 * 目的：检查用户是否为管理员
 */
import { Navigate } from 'react-router-dom';

function AdminProtectedRoute({ children }) {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // 检查是否为管理员（第一个用户或role为admin）
  const isAdminUser =
    userInfo?.role === 'admin' || userInfo?.email?.toLowerCase()?.startsWith('admin');

  if (!isAdminUser) {
    // 如果不是管理员，重定向到dashboard
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

export default AdminProtectedRoute;

