import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import AgentChat from './pages/AgentChat';
import UploadFile from './pages/UploadFile';
import StudyPlan from './pages/StudyPlan';
import Quiz from './pages/Quiz';
import QuizResult from './pages/QuizResult';
import LearningMap from './pages/LearningMap';
import KnowledgeDocument from './pages/KnowledgeDocument';
import NotFound from './pages/NotFound';
import AdminDashboard from './pages/Admin/Dashboard';
import ModelManagement from './pages/Admin/ModelManagement';
import PromptEditor from './pages/Admin/PromptEditor';
import SystemConfig from './pages/Admin/SystemConfig';
import UserManagement from './pages/Admin/UserManagement';
import APICallLogs from './pages/Admin/APICallLogs';
import KnowledgeAdmin from './pages/Admin/KnowledgeAdmin';
import QuestionBankAdmin from './pages/Admin/QuestionBankAdmin';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import { useThemeStore } from './store/themeStore';

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

const AppContent = () => {
  const location = useLocation();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const hideNavbar =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname.startsWith('/admin');

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? 'bg-[#05060a] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      {!hideNavbar && <Navbar />}

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai"
          element={<Navigate to="/agent" replace />}
        />
        <Route
          path="/agent"
          element={
            <ProtectedRoute>
              <AgentChat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload-file"
          element={
            <ProtectedRoute>
              <UploadFile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/study-plan"
          element={
            <ProtectedRoute>
              <StudyPlan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <Quiz />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz-result"
          element={
            <ProtectedRoute>
              <QuizResult />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learning-map"
          element={
            <ProtectedRoute>
              <LearningMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/knowledge/documents/:docId"
          element={
            <ProtectedRoute>
              <KnowledgeDocument />
            </ProtectedRoute>
          }
        />
        {/* 管理后台路由 */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <Navigate to="/admin/dashboard" replace />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/models"
          element={
            <AdminProtectedRoute>
              <ModelManagement />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/prompts"
          element={
            <AdminProtectedRoute>
              <PromptEditor />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/config"
          element={
            <AdminProtectedRoute>
              <SystemConfig />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminProtectedRoute>
              <UserManagement />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/api-logs"
          element={
            <AdminProtectedRoute>
              <APICallLogs />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/knowledge"
          element={
            <AdminProtectedRoute>
              <KnowledgeAdmin />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/question-bank"
          element={
            <AdminProtectedRoute>
              <QuestionBankAdmin />
            </AdminProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

export default App;

