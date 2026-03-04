import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadFile as uploadStudyFile, generatePlan as requestPlan } from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

function UploadFile() {
  const [file, setFile] = useState(null);
  const [goals, setGoals] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            page: 'min-h-screen bg-[#05060a] text-white',
            card: 'bg-[#101524] rounded-2xl shadow-2xl border border-white/10 p-8',
            input:
              'w-full px-4 py-3 rounded-lg bg-[#0f172a] border border-white/15 text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            uploadArea:
              'border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-blue-400/70 transition-colors bg-[#0b1220]',
            uploadText: 'text-white/80',
            btnPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
            btnSecondary: 'bg-blue-600 text-white hover:bg-blue-500',
            alertInfo: 'bg-blue-500/10 border border-blue-500/40 text-blue-100',
            alertError: 'bg-red-500/10 border border-red-500/40 text-red-100',
          }
        : {
            page: 'min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900',
            card: 'bg-white rounded-xl shadow-lg p-8 border border-slate-100',
            input:
              'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            uploadArea:
              'border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors bg-white',
            uploadText: 'text-gray-600',
            btnPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
            btnSecondary: 'bg-blue-600 text-white hover:bg-blue-700',
            alertInfo: 'bg-blue-50 border border-blue-200 text-blue-800',
            alertError: 'bg-red-50 border border-red-200 text-red-800',
          },
    [isDark]
  );

  // 获取用户ID
  const getUserId = () => {
    // 优先从sessionStorage获取，如果没有则从localStorage（向后兼容）
    const userInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        return user.id;
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // 检查文件类型
      const allowedTypes = ['.pdf', '.txt', '.md', '.markdown', '.docx', '.pptx'];
      const fileExt = '.' + selectedFile.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExt)) {
        setError(`不支持的文件类型: ${fileExt}。支持的类型: PDF, TXT, MD, DOCX, PPTX`);
        setFile(null);
        return;
      }
      
      // 检查文件大小（10MB）
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('文件过大，最大允许 10MB');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('请选择要上传的文件');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setStatusMessage('正在上传并解析教材，可能需要数秒钟，请稍候...');

      const response = await uploadStudyFile(formData);

      setUploadResult(response.data);
      setUploading(false);
      setStatusMessage('教材上传完成，可继续生成学习计划。');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || '文件上传失败');
      setUploading(false);
      setStatusMessage('');
    }
  };

  const handleGeneratePlan = async () => {
    if (!uploadResult && !goals.trim()) {
      setError('请先上传文件或填写学习目标');
      return;
    }

    setGenerating(true);
    setError('');
    setStatusMessage('AI 正在生成学习计划，通常需要 10-20 秒，请耐心等待...');

    try {
      const user_id = getUserId();
      
      // 获取文件文本内容（从上传结果中获取预览，实际应该从服务器获取完整内容）
      // 这里简化处理，实际应该有一个接口获取完整文件内容
      const fileText = uploadResult?.text_preview || '';

      const response = await requestPlan({
        user_id: user_id,
        goals: goals.trim() || '',  // 如果为空则传空字符串
        file_text: fileText,
        file_name: uploadResult?.file_name,
      });

      // 跳转到学习计划页面
      setStatusMessage('');
      navigate('/study-plan', { 
        state: { 
          plan: response.data,
          fromUpload: true 
        } 
      });
    } catch (err) {
      setError(err.response?.data?.detail || '生成学习计划失败');
      setGenerating(false);
      setStatusMessage('');
    }
  };

  return (
    <div className={`${palette.page} py-10`}>
      <div className="max-w-4xl mx-auto px-4">
        <div className={palette.card}>
        <h1 className={`text-3xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>上传教材并生成学习计划</h1>

        {/* 文件上传区域 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择教材文件
          </label>
          <div className={palette.uploadArea}>
            <input
              type="file"
              accept=".pdf,.txt,.md,.markdown,.docx,.pptx"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="w-12 h-12 text-gray-400 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className={palette.uploadText}>
                {file ? file.name : '点击选择文件 (PDF, TXT, MD, DOCX, PPTX)'}
              </span>
            </label>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">文件名:</span> {file.name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">大小:</span> {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`mt-4 w-full py-2 px-4 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${palette.btnSecondary}`}
          >
            {uploading ? '上传中...' : '上传文件'}
          </button>
        </div>

        {/* 上传结果 */}
        {uploadResult && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">✅ 文件上传成功！</p>
            <p className="text-sm text-green-700 mt-1">
              文本长度: {uploadResult.text_length} 字符
            </p>
          </div>
        )}

        {/* 学习目标输入 */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
            学习目标 <span className={`${isDark ? 'text-white/50' : 'text-gray-400'} font-normal`}>(可选)</span>
          </label>
          <input
            type="text"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="例如：三天掌握Python基础"
            className={palette.input}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
            描述你的学习目标（可选），AI将根据此和教材内容生成个性化学习计划
          </p>
        </div>

        {/* 状态提示 */}
        {(statusMessage || error) && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              error ? palette.alertError : palette.alertInfo
            }`}
          >
            <p className="text-sm">{error || statusMessage}</p>
          </div>
        )}

        {/* 生成计划按钮 */}
        <button
          onClick={handleGeneratePlan}
          disabled={(!uploadResult && !goals.trim()) || generating}
          className={`w-full ${palette.btnPrimary} py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-medium text-lg shadow-lg`}
        >
          {generating ? 'AI正在生成学习计划...' : '生成学习计划'}
        </button>
        </div>
      </div>
    </div>
  );
}

export default UploadFile;

