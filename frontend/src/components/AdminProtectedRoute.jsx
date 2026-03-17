/**
 * 管理员路由保护组件
 * 作者：智学伴开发团队
 * 目的：检查用户是否为管理员（仅通过 role 字段判断）
 */
import { Navigate } from 'react-router-dom';

function AdminProtectedRoute({ children }) {
  const token = sessionStorage.getItem('token');
  const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (userInfo?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default AdminProtectedRoute;
