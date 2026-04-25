/**
 * 知识库管理页面 - 重构版
 * 功能：文件上传、在线编辑、目录浏览、文档预览、批量操作
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useThemeStore } from '../../store/themeStore';
import {
  listDocuments,
  getKnowledgeStats,
  scanCorpus,
  deleteDocument,
  reindexDocument,
  createDocumentOnline,
  updateDocument,
  uploadDocuments,
  getDocumentContent,
} from '../../api/knowledgeApi';

const getIsMobileLayout = () => typeof window !== 'undefined' && window.innerWidth < 1024;

// ─── 常量定义 ────────────────────────────────────────────────────────────────

const GRADE_LEVELS = ['小学', '初中', '高中', '大学', '通用'];
const SUBJECTS = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '信息技术'];
const DIFFICULTIES = [
  { value: 'easy', label: '基础' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
];

const STATUS_CONFIG = {
  indexed: { text: '已索引', color: 'green' },
  pending: { text: '待索引', color: 'yellow' },
  indexing: { text: '索引中', color: 'blue' },
  failed: { text: '失败', color: 'red' },
};

// 默认的 frontmatter 模板
const DEFAULT_FRONTMATTER = `title: ""
grade_level: "初中"
subject: "数学"
topic: ""
difficulty: "easy"
source: ""
tags: []`;

// ─── 子组件：目录树 ──────────────────────────────────────────────────────────

function DirectoryTree({ docs, selectedDoc, onSelect, isDark }) {
  // 按年级/学科组织文档
  const treeData = useMemo(() => {
    const tree = {};
    docs.forEach(doc => {
      const grade = doc.grade_level || '未分类';
      const subject = doc.subject || '其他';
      if (!tree[grade]) tree[grade] = {};
      if (!tree[grade][subject]) tree[grade][subject] = [];
      tree[grade][subject].push(doc);
    });
    return tree;
  }, [docs]);

  const [expanded, setExpanded] = useState({});

  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const textClass = isDark ? 'text-slate-300' : 'text-gray-700';
  const mutedClass = isDark ? 'text-slate-500' : 'text-gray-400';

  return (
    <div className="py-2">
      {Object.entries(treeData).map(([grade, subjects]) => (
        <div key={grade}>
          <button
            onClick={() => toggleExpand(grade)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium ${textClass} hover:bg-black/5 rounded-lg transition-colors`}
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded[grade] ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{grade}</span>
            <span className={`text-xs ${mutedClass}`}>
              ({Object.values(subjects).flat().length})
            </span>
          </button>

          {expanded[grade] && (
            <div className="ml-4">
              {Object.entries(subjects).map(([subject, subjectDocs]) => (
                <div key={`${grade}-${subject}`}>
                  <button
                    onClick={() => toggleExpand(`${grade}-${subject}`)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm ${mutedClass} hover:bg-black/5 rounded transition-colors`}
                  >
                    <svg
                      className={`w-3 h-3 transition-transform ${expanded[`${grade}-${subject}`] ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>{subject}</span>
                    <span className="text-xs">({subjectDocs.length})</span>
                  </button>

                  {expanded[`${grade}-${subject}`] && (
                    <div className="ml-4">
                      {subjectDocs.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => onSelect(doc)}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded transition-colors truncate ${
                            selectedDoc?.id === doc.id
                              ? isDark
                                ? 'bg-blue-900/40 text-blue-300'
                                : 'bg-blue-50 text-blue-700'
                              : mutedClass + ' hover:bg-black/5'
                          }`}
                          title={doc.title}
                        >
                          {doc.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {docs.length === 0 && (
        <div className={`text-center py-8 text-sm ${mutedClass}`}>
          暂无文档
        </div>
      )}
    </div>
  );
}

// ─── 子组件：文档编辑器 ──────────────────────────────────────────────────────

function DocumentEditor({ doc, onSave, onCancel, isDark, isNew = false }) {
  const [frontmatter, setFrontmatter] = useState(DEFAULT_FRONTMATTER);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew && !!doc);
  const [error, setError] = useState(null);

  // 加载现有文档内容
  useEffect(() => {
    if (!isNew && doc) {
      setLoading(true);
      getDocumentContent(doc.id)
        .then((data) => {
          // 解析内容，分离 frontmatter 和正文
          const parsed = parseMarkdownWithFrontmatter(data.content);
          setFrontmatter(parsed.frontmatter);
          setContent(parsed.body);
        })
        .catch((e) => {
          setError(`加载文档失败: ${e.message}`);
          // 使用数据库中的元数据作为后备
          setFrontmatter(buildFrontmatterFromDoc(doc));
        })
        .finally(() => setLoading(false));
    } else if (isNew) {
      setFrontmatter(DEFAULT_FRONTMATTER);
      setContent('');
    }
  }, [doc, isNew]);

  // 从文档对象构建 frontmatter
  function buildFrontmatterFromDoc(d) {
    const lines = [
      `title: "${d.title || ''}"`,
      `grade_level: "${d.grade_level || '初中'}"`,
      `subject: "${d.subject || '数学'}"`,
      `topic: "${d.topic || ''}"`,
      `difficulty: "${d.difficulty || 'easy'}"`,
      `source: "${d.source || ''}"`,
      `tags: ${JSON.stringify(d.tags || [])}`,
    ];
    return lines.join('\n');
  }

  // 解析 Markdown 文件，分离 frontmatter 和正文
  function parseMarkdownWithFrontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n*([\s\S]*)$/);
    if (match) {
      return {
        frontmatter: match[1],
        body: match[2].trim(),
      };
    }
    return {
      frontmatter: DEFAULT_FRONTMATTER,
      body: text,
    };
  }

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      // 解析 frontmatter
      const parsed = parseFrontmatter(frontmatter);
      if (!parsed.title) {
        throw new Error('标题不能为空');
      }

      // 组合完整文档
      const fullContent = `---\n${frontmatter}\n---\n\n${content}`;

      await onSave({
        ...parsed,
        content: fullContent,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 简单解析 frontmatter
  function parseFrontmatter(text) {
    const result = {};
    const lines = text.split('\n');
    lines.forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        if (value.startsWith('"') && value.endsWith('"')) {
          result[key] = value.slice(1, -1);
        } else if (value.startsWith('[')) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = [];
          }
        } else {
          result[key] = value;
        }
      }
    });
    return result;
  }

  if (loading) {
    return (
      <div className={`text-center py-10 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
        加载文档内容...
      </div>
    );
  }

  const inputClass = `w-full text-sm px-3 py-2 rounded-lg border font-mono ${
    isDark
      ? 'bg-slate-700 border-slate-600 text-slate-200'
      : 'bg-white border-gray-300 text-gray-800'
  }`;

  return (
    <div className="space-y-4">
      {error && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'
        }`}>
          {error}
        </div>
      )}

      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          YAML 元数据
        </label>
        <textarea
          value={frontmatter}
          onChange={(e) => setFrontmatter(e.target.value)}
          className={inputClass}
          rows={7}
          placeholder="title: 知识点名称&#10;grade_level: 初中&#10;subject: 数学&#10;..."
        />
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          Markdown 正文
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={inputClass}
          rows={15}
          placeholder="# 知识点标题&#10;&#10;## 定义&#10;&#10;内容...&#10;&#10;## 例题&#10;&#10;..."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saving
              ? 'opacity-60 cursor-not-allowed bg-blue-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {saving ? '保存中...' : isNew ? '创建并索引' : '保存'}
        </button>
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            isDark
              ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── 子组件：文件上传区 ──────────────────────────────────────────────────────

function FileUploader({ onUpload, isDark }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.md')
    );
    setFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      (f) => f.name.endsWith('.md')
    );
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onUpload(files);
      setFiles([]);
    } finally {
      setUploading(false);
    }
  };

  const borderClass = dragging
    ? 'border-blue-500 bg-blue-500/10'
    : isDark
    ? 'border-slate-600 hover:border-slate-500'
    : 'border-gray-300 hover:border-gray-400';

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${borderClass}`}
      >
        <svg
          className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
          拖拽 .md 文件到此处，或
        </p>
        <label className="cursor-pointer">
          <span className="text-sm text-blue-500 hover:text-blue-600">点击选择文件</span>
          <input
            type="file"
            accept=".md"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            待上传文件 ({files.length})
          </p>
          <div className={`rounded-lg border divide-y ${
            isDark ? 'border-slate-700 divide-slate-700' : 'border-gray-200 divide-gray-200'
          }`}>
            {files.map((file, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="flex-1 truncate">{file.name}</span>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploading
                  ? 'opacity-60 cursor-not-allowed bg-blue-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {uploading ? '上传中...' : '上传并索引'}
            </button>
            <button
              onClick={() => setFiles([])}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isDark
                  ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              清空
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 子组件：文档详情 ────────────────────────────────────────────────────────

function DocumentDetail({ doc, onEdit, onDelete, onReindex, isDark }) {
  if (!doc) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 ${
        isDark ? 'text-slate-500' : 'text-gray-400'
      }`}>
        <svg className="w-16 h-16 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">选择左侧文档查看详情</p>
      </div>
    );
  }

  const status = STATUS_CONFIG[doc.status] || { text: doc.status, color: 'gray' };
  const statusColors = {
    green: isDark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700',
    yellow: isDark ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700',
    blue: isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700',
    red: isDark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700',
    gray: isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-4">
      {/* 标题和状态 */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {doc.title}
          </h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {doc.file_path?.split(/[/\\]/).slice(-3).join(' / ')}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status.color]}`}>
          {status.text}
        </span>
      </div>

      {/* 元数据 */}
      <div className={`grid grid-cols-2 gap-3 p-4 rounded-lg ${
        isDark ? 'bg-slate-700/50' : 'bg-gray-50'
      }`}>
        <MetaItem label="年级" value={doc.grade_level} isDark={isDark} />
        <MetaItem label="学科" value={doc.subject} isDark={isDark} />
        <MetaItem label="主题" value={doc.topic} isDark={isDark} />
        <MetaItem label="难度" value={doc.difficulty} isDark={isDark} />
        <MetaItem label="来源" value={doc.source} isDark={isDark} />
        <MetaItem label="分块数" value={doc.chunk_count} isDark={isDark} />
        <MetaItem label="索引时间" value={doc.indexed_at ? new Date(doc.indexed_at).toLocaleString('zh-CN') : '-'} isDark={isDark} />
        <MetaItem label="创建时间" value={doc.created_at ? new Date(doc.created_at).toLocaleString('zh-CN') : '-'} isDark={isDark} />
      </div>

      {/* 标签 */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {doc.tags.map((tag, idx) => (
            <span
              key={idx}
              className={`px-2 py-1 rounded text-xs ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 错误信息 */}
      {doc.error_message && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'
        }`}>
          <strong>错误：</strong> {doc.error_message}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={() => onEdit(doc)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            isDark
              ? 'border-blue-700 text-blue-400 hover:bg-blue-900/30'
              : 'border-blue-200 text-blue-600 hover:bg-blue-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          编辑
        </button>
        <button
          onClick={() => onReindex(doc.id, doc.title)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            isDark
              ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重建索引
        </button>
        <button
          onClick={() => onDelete(doc.id, doc.title)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            isDark
              ? 'border-red-700 text-red-400 hover:bg-red-900/30'
              : 'border-red-200 text-red-600 hover:bg-red-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          删除
        </button>
      </div>
    </div>
  );
}

function MetaItem({ label, value, isDark }) {
  return (
    <div>
      <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{label}</div>
      <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
        {value || '-'}
      </div>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function KnowledgeAdmin() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // 视图状态
  const [view, setView] = useState('list'); // 'list' | 'upload' | 'create' | 'edit'
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);
  const [mobileListPanel, setMobileListPanel] = useState('directory');

  // 加载数据
  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobileLayout(getIsMobileLayout());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([listDocuments(), getKnowledgeStats()]);
      setDocs(docsRes.documents || []);
      setStats(statsRes);
    } catch (e) {
      showMsg('err', `加载失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleScan = async () => {
    setScanLoading(true);
    try {
      await scanCorpus();
      showMsg('ok', '扫描任务已启动，后台自动索引，请稍后刷新列表');
    } catch (e) {
      showMsg('err', `扫描失败: ${e.message}`);
    } finally {
      setScanLoading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`确认删除文档「${title}」及其所有索引？`)) return;
    try {
      await deleteDocument(id);
      showMsg('ok', `已删除「${title}」`);
      setSelectedDoc(null);
      loadAll();
    } catch (e) {
      showMsg('err', `删除失败: ${e.message}`);
    }
  };

  const handleReindex = async (id, title) => {
    try {
      await reindexDocument(id);
      showMsg('ok', `「${title}」重新索引任务已提交`);
      setTimeout(loadAll, 1500);
    } catch (e) {
      showMsg('err', `操作失败: ${e.message}`);
    }
  };

  const handleUpload = async (files) => {
    try {
      const result = await uploadDocuments(files);
      showMsg('ok', result.message || `已上传 ${files.length} 个文件，后台索引中`);
      setView('list');
      setTimeout(loadAll, 1500);
    } catch (e) {
      showMsg('err', `上传失败: ${e.message}`);
    }
  };

  const handleCreateDoc = async (data) => {
    try {
      const result = await createDocumentOnline(data);
      showMsg('ok', result.message || `文档「${data.title}」已创建并提交索引`);
      setView('list');
      setEditingDoc(null);
      setTimeout(loadAll, 1500);
    } catch (e) {
      showMsg('err', `创建失败: ${e.message}`);
    }
  };

  const handleUpdateDoc = async (data) => {
    if (!editingDoc) return;
    try {
      const result = await updateDocument(editingDoc.id, data);
      showMsg('ok', result.message || `文档已更新并重新索引`);
      setView('list');
      setEditingDoc(null);
      setTimeout(loadAll, 1500);
    } catch (e) {
      showMsg('err', `更新失败: ${e.message}`);
    }
  };

  const handleEditDoc = (doc) => {
    setEditingDoc(doc);
    setView('edit');
  };

  const handleSelectDoc = (doc) => {
    setSelectedDoc(doc);
    if (getIsMobileLayout()) {
      setMobileListPanel('detail');
    }
  };

  // 样式变量
  const card = isDark
    ? 'bg-slate-800 border border-slate-700 rounded-xl'
    : 'bg-white border border-gray-200 rounded-xl shadow-sm';

  const sidebarWidth = 'w-64';

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* 头部 */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              知识库管理
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              管理 RAG 向量知识库，支持语义检索的学科知识文档
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setView('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建文档
            </button>
            <button
              onClick={() => setView('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              上传文件
            </button>
            <button
              onClick={handleScan}
              disabled={scanLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scanLoading
                  ? 'opacity-60 cursor-not-allowed'
                  : isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <svg className={`w-4 h-4 ${scanLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {scanLoading ? '扫描中...' : '扫描目录'}
            </button>
          </div>
        </div>

        {/* 提示消息 */}
        {msg && (
          <div className={`rounded-lg px-4 py-3 text-sm ${
            msg.type === 'ok'
              ? isDark ? 'bg-green-900/30 text-green-300 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200'
              : isDark ? 'bg-red-900/30 text-red-300 border border-red-700' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg.text}
          </div>
        )}

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '文档总数', value: stats.total_documents },
              { label: '已索引', value: stats.indexed },
              { label: '向量分块', value: stats.total_chunks },
              { label: 'RAG 状态', value: stats.rag_available ? '可用' : '不可用' },
            ].map(({ label, value }) => (
              <div key={label} className={`${card} p-4`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</div>
                <div className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* RAG 不可用提示 */}
        {stats && !stats.rag_available && (
          <div className={`rounded-lg px-4 py-3 text-sm border ${
            isDark ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <strong>RAG 服务未启用</strong> — 请安装依赖后重启后端：
            <code className="ml-2 px-2 py-0.5 rounded text-xs bg-black/10">
              pip install chromadb&gt;=0.5.0 sentence-transformers&gt;=3.0.0
            </code>
          </div>
        )}

        {/* 主内容区 */}
        {view === 'list' && (
          <div className={`${card} overflow-hidden`}>
            {isMobileLayout ? (
              <div className="space-y-4 p-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    { key: 'directory', label: '目录' },
                    { key: 'detail', label: '详情' },
                  ].map((panel) => (
                    <button
                      key={panel.key}
                      type="button"
                      onClick={() => setMobileListPanel(panel.key)}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        mobileListPanel === panel.key
                          ? 'bg-blue-600 text-white'
                          : isDark
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {panel.label}
                    </button>
                  ))}
                </div>

                {mobileListPanel === 'directory' ? (
                  <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <div className={`border-b px-4 py-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                      <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                        文档目录
                      </h2>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      <DirectoryTree
                        docs={docs}
                        selectedDoc={selectedDoc}
                        onSelect={handleSelectDoc}
                        isDark={isDark}
                      />
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    {loading ? (
                      <div className={`py-10 text-center text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        加载中...
                      </div>
                    ) : (
                      <DocumentDetail
                        doc={selectedDoc}
                        onEdit={handleEditDoc}
                        onDelete={handleDelete}
                        onReindex={handleReindex}
                        isDark={isDark}
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
            <div className="flex">
              {/* 左侧目录树 */}
              <div className={`${sidebarWidth} border-r flex-shrink-0 ${
                isDark ? 'border-slate-700' : 'border-gray-200'
              }`}>
                <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                  <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    文档目录
                  </h2>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  <DirectoryTree
                    docs={docs}
                    selectedDoc={selectedDoc}
                    onSelect={handleSelectDoc}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* 右侧详情 */}
              <div className="flex-1 p-5">
                {loading ? (
                  <div className={`text-center py-10 text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    加载中...
                  </div>
                ) : (
                  <DocumentDetail
                    doc={selectedDoc}
                    onEdit={handleEditDoc}
                    onDelete={handleDelete}
                    onReindex={handleReindex}
                    isDark={isDark}
                  />
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* 上传视图 */}
        {view === 'upload' && (
          <div className={`${card} p-5`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                上传知识文档
              </h2>
              <button
                onClick={() => setView('list')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  isDark
                    ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                返回列表
              </button>
            </div>
            <FileUploader onUpload={handleUpload} isDark={isDark} />
          </div>
        )}

        {/* 创建/编辑视图 */}
        {(view === 'create' || view === 'edit') && (
          <div className={`${card} p-5`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                {view === 'create' ? '新建知识文档' : `编辑：${editingDoc?.title}`}
              </h2>
              <button
                onClick={() => {
                  setView('list');
                  setEditingDoc(null);
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  isDark
                    ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                返回列表
              </button>
            </div>
            <DocumentEditor
              doc={editingDoc}
              onSave={view === 'create' ? handleCreateDoc : handleUpdateDoc}
              onCancel={() => {
                setView('list');
                setEditingDoc(null);
              }}
              isDark={isDark}
              isNew={view === 'create'}
            />
          </div>
        )}

        {/* 使用说明 */}
        <div className={`${card} p-5`}>
          <h2 className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
            使用说明
          </h2>
          <div className={`text-xs space-y-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            <p><strong>1. 新建文档</strong>：点击「新建文档」按钮，填写 YAML 元数据和 Markdown 正文</p>
            <p><strong>2. 上传文件</strong>：点击「上传文件」按钮，拖拽或选择 .md 文件批量上传</p>
            <p><strong>3. 扫描目录</strong>：将文件放入 knowledge_base/corpus/ 目录后点击「扫描目录」批量导入</p>
            <p><strong>4. 文档格式</strong>：顶部需包含 YAML frontmatter（title、grade_level、subject、topic、difficulty）</p>
            <p><strong>5. Agent 调用</strong>：Agent 会在用户询问知识点、概念、公式时自动调用知识库检索</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
