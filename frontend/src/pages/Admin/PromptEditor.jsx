/**
 * Prompt编辑器页面
 * 作者：智学伴开发团队
 * 目的：管理Prompt模板，支持版本管理
 */
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/apiClient';
import { useThemeStore } from '../../store/themeStore';

const PromptEditor = () => {
  const [prompts, setPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    description: '',
    enabled: true,
  });
  const [editData, setEditData] = useState({
    description: '',
    content: '',
    enabled: true,
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            subtitle: 'text-white/60',
            heading: 'text-white',
            buttonPrimary:
              'px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg shadow-lg shadow-cyan-900/40 hover:shadow-cyan-900/60 transition',
            buttonGhost:
              'px-4 py-2 bg-white/10 text-white rounded-lg border border-white/20 hover:bg-white/20 transition',
            card: 'bg-[#101629] border border-white/10 text-white',
            listActive: 'bg-cyan-500/10 border border-cyan-400/40 text-white',
            listInactive: 'bg-[#0d1424] border border-white/10 text-white hover:border-cyan-400/50',
            badgePrimary: 'bg-blue-500/20 text-blue-100',
            badgeNeutral: 'bg-white/10 text-white/70',
            input:
              'w-full px-3 py-2 rounded-lg bg-[#0f172a] border border-white/10 text-white placeholder:text-white/40 focus:ring-2 focus:ring-cyan-400',
            textarea:
              'w-full px-3 py-2 rounded-lg bg-[#0f172a] border border-white/10 text-white placeholder:text-white/40 focus:ring-2 focus:ring-cyan-400',
            empty: 'text-white/60',
          }
        : {
            subtitle: 'text-gray-500',
            heading: 'text-gray-900',
            buttonPrimary:
              'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition',
            buttonGhost:
              'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition',
            card: 'bg-white border border-gray-100 text-gray-900',
            listActive: 'bg-blue-50 border border-blue-200 text-blue-700',
            listInactive: 'bg-gray-50 border border-gray-200 hover:border-blue-200',
            badgePrimary: 'bg-blue-50 text-blue-600',
            badgeNeutral: 'bg-gray-100 text-gray-700',
            input: 'w-full px-3 py-2 border border-gray-300 rounded-lg',
            textarea: 'w-full px-3 py-2 border border-gray-300 rounded-lg',
            empty: 'text-gray-500',
          },
    [isDark]
  );

  const fetchPrompts = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.get('/api/v1/admin/prompts');
      setPrompts(response.data || []);
      console.log('获取到的Prompt列表:', response.data);
    } catch (error) {
      console.error('获取Prompt列表失败:', error);
      setError(error.response?.data?.detail || error.message || '获取Prompt列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async (name) => {
    try {
      const response = await api.get(`/api/v1/admin/prompts/name/${name}`);
      setVersions(response.data);
      if (response.data.length > 0) {
        const current =
          response.data.find((item) => item.enabled) || response.data[0];
        setSelectedVersion(current);
        setEditData({
          description: current.description || '',
          content: current.content || '',
          enabled: current.enabled,
        });
      } else {
        setSelectedVersion(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('获取版本列表失败:', error);
    }
  };

  const handleSelectPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setSelectedVersion(null);
    setIsEditing(false);
    fetchVersions(prompt.name);
  };

  const handleSelectVersion = (version) => {
    setSelectedVersion(version);
    setIsEditing(false);
    setEditData({
      description: version.description || '',
      content: version.content || '',
      enabled: version.enabled,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/admin/prompts', formData);
      setShowForm(false);
      setFormData({ name: '', content: '', description: '', enabled: true });
      fetchPrompts();
    } catch (error) {
      alert('创建失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleEnableVersion = async (name, version) => {
    try {
      await api.post(`/api/v1/admin/prompts/${name}/enable/${version}`);
      fetchVersions(name);
      alert('已启用该版本');
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个Prompt吗？')) return;
    try {
      await api.delete(`/api/v1/admin/prompts/${id}`);
      fetchPrompts();
      if (selectedPrompt?.id === id) {
        setSelectedPrompt(null);
        setVersions([]);
      }
    } catch (error) {
      alert('删除失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleUpdateVersion = async (e) => {
    e.preventDefault();
    if (!selectedVersion) return;
    try {
      setSaving(true);
      await api.put(`/api/v1/admin/prompts/${selectedVersion.id}`, {
        description: editData.description,
        content: editData.content,
        enabled: editData.enabled,
      });
      await fetchVersions(selectedVersion.name);
      setIsEditing(false);
    } catch (error) {
      alert('保存失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const groupedPrompts = prompts.reduce((acc, prompt) => {
    if (!acc[prompt.name]) {
      acc[prompt.name] = [];
    }
    acc[prompt.name].push(prompt);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`text-sm ${palette.subtitle}`}>Prompt 管理中心</p>
            <h2 className={`text-2xl font-bold ${palette.heading}`}>Prompt管理</h2>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(true)}
              className={palette.buttonPrimary}
            >
              创建Prompt
            </button>
            <button
              onClick={fetchPrompts}
              className={palette.buttonGhost}
            >
              刷新
            </button>
          </div>
        </div>

        {/* 创建表单 */}
        {showForm && (
          <div className={`mb-6 rounded-xl shadow-sm p-6 ${palette.card}`}>
            <h3 className="text-lg font-semibold mb-4">创建新Prompt</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Prompt名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={palette.input}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={palette.input}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  内容
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className={palette.textarea}
                  rows={10}
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="mr-2"
                />
                <label className={`text-sm ${palette.subtitle}`}>启用</label>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className={palette.buttonPrimary}
                >
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className={palette.buttonGhost}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Prompt列表 */}
          <div className={`rounded-xl shadow-sm ${palette.card}`}>
            <div className="p-4 border-b">
              <h3 className="font-semibold">Prompt列表</h3>
            </div>
            <div className="p-4 max-h-[32rem] overflow-y-auto space-y-2">
              {loading ? (
                <div className={`text-center py-8 ${palette.empty}`}>加载中...</div>
              ) : error ? (
                <div className={`text-center py-8 ${palette.empty}`}>
                  <p className="text-red-500 mb-2">错误: {error}</p>
                  <button
                    onClick={fetchPrompts}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    重试
                  </button>
                </div>
              ) : Object.keys(groupedPrompts).length === 0 ? (
                <div className={`text-center py-8 ${palette.empty}`}>
                  <p>暂无Prompt</p>
                  <p className="text-xs mt-2">点击"创建Prompt"按钮添加新的Prompt</p>
                </div>
              ) : (
                Object.keys(groupedPrompts).map((name) => {
                  const latest = groupedPrompts[name].sort((a, b) => b.version - a.version)[0];
                  return (
                    <div
                      key={name}
                      onClick={() => handleSelectPrompt(latest)}
                      className={`p-3 mb-2 rounded-lg cursor-pointer ${
                        selectedPrompt?.name === name
                          ? palette.listActive
                          : palette.listInactive
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-white/60">
                            版本 {latest.version} · {latest.enabled ? '启用' : '禁用'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(latest.id);
                          }}
                          className={`${palette.listInactive.includes('text-white') ? 'text-red-300 hover:text-red-100' : 'text-red-600 hover:text-red-800'} text-sm`}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 版本列表 */}
          <div className={`rounded-xl shadow-sm ${palette.card}`}>
            <div className="p-4 border-b">
              <h3 className="font-semibold">
                {selectedPrompt ? `${selectedPrompt.name} - 版本列表` : '选择Prompt查看版本'}
              </h3>
            </div>
            <div className="p-4 max-h-[32rem] overflow-y-auto space-y-3">
              {selectedPrompt ? (
                versions.length > 0 ? (
                  versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => handleSelectVersion(version)}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        selectedVersion?.id === version.id
                          ? palette.listActive
                          : palette.listInactive
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">版本 {version.version}</span>
                        <div className="space-x-2 text-xs">
                          {!version.enabled && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnableVersion(version.name, version.version);
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded"
                            >
                              启用
                            </button>
                          )}
                          {version.enabled && (
                            <span className="px-2 py-1 bg-green-600 text-white rounded">
                              当前版本
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-white/70 mb-2">
                        {version.description || '无描述'}
                      </p>
                      <p className="text-xs text-white/50">
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className={`text-center py-8 ${palette.empty}`}>暂无版本记录</div>
                )
              ) : (
                <div className={`text-center py-8 ${palette.empty}`}>
                  请从左侧选择一个Prompt
                </div>
              )}
            </div>
          </div>

          {/* 详情与编辑 */}
          <div className={`rounded-xl shadow-sm ${palette.card}`}>
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">版本详情</h3>
              {selectedVersion && (
                <button
                  onClick={() => setIsEditing((prev) => !prev)}
                  className="text-sm px-3 py-1 rounded-lg bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                >
                  {isEditing ? '取消编辑' : '编辑内容'}
                </button>
              )}
            </div>
            <div className="p-4 h-full overflow-y-auto">
              {selectedVersion ? (
                isEditing ? (
                  <form onSubmit={handleUpdateVersion} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        描述
                      </label>
                      <input
                        type="text"
                        value={editData.description}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className={palette.input}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        内容
                      </label>
                      <textarea
                        value={editData.content}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, content: e.target.value }))
                        }
                        rows={12}
                        className={`${palette.textarea} font-mono text-sm`}
                        required
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editData.enabled}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="mr-2"
                      />
                      <span className={`text-sm ${palette.subtitle}`}>启用该版本</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {saving ? '保存中...' : '保存修改'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setEditData({
                            description: selectedVersion.description || '',
                            content: selectedVersion.content || '',
                            enabled: selectedVersion.enabled,
                          });
                        }}
                        className={palette.buttonGhost}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className={`text-sm ${palette.subtitle}`}>描述</p>
                      <p className="text-base">
                        {selectedVersion.description || '未填写描述'}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${palette.subtitle}`}>内容</p>
                      <pre className="mt-2 bg-black/20 border border-white/10 rounded-lg p-4 text-sm max-h-[24rem] overflow-auto font-mono whitespace-pre-wrap">
                        {selectedVersion.content}
                      </pre>
                    </div>
                    <p className={`text-xs ${palette.subtitle}`}>
                      最近更新：{new Date(selectedVersion.updated_at || selectedVersion.created_at).toLocaleString()}
                    </p>
                  </div>
                )
              ) : (
                <div className={`text-center py-8 ${palette.empty}`}>请选择一个版本查看详情</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PromptEditor;

