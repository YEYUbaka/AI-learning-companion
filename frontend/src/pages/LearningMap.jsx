import { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { uploadLearningMapFile, generateLearningMap, getLearningMapGraph, getLearningMapHistory } from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import MindMapNode from '../components/MindMapNode';
import { getLayoutedElements } from '../utils/mindMapLayout';

const masteryColors = {
  strong: '#22c55e',
  medium: '#f97316',
  weak: '#ef4444',
  unknown: '#94a3b8',
};

const nodeTypes = {
  mindMapNode: MindMapNode,
};

function LearningMap() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [courseTopic, setCourseTopic] = useState('');
  const [status, setStatus] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const getUserId = () => {
    const userInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        return JSON.parse(userInfo).id;
      } catch {
        return null;
      }
    }
    return null;
  };


  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const userId = getUserId();
      const response = await getLearningMapHistory(userId);
      setHistory(response.data.sessions || []);
    } catch (err) {
      console.error('加载历史失败:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileInfo(file);
    setStatus('文件已选择');
  };

  const handleGenerate = async () => {
    if (!fileInfo && !courseTopic) {
      setStatus('请上传文件或输入课程主题');
      return;
    }

    setLoading(true);
    setStatus('生成中...');

    try {
      const userId = getUserId();
      let sessionId = null;

      if (fileInfo) {
        const formData = new FormData();
        formData.append('file', fileInfo);
        formData.append('user_id', userId);
        const uploadRes = await uploadLearningMapFile(formData);
        sessionId = uploadRes.data.session_id;
      }

      const genRes = await generateLearningMap({
        user_id: userId,
        session_id: sessionId,
        course_topic: courseTopic || fileInfo?.name,
      });

      const newSessionId = genRes.data.session_id;
      setActiveSessionId(newSessionId);
      await loadGraph(newSessionId);
      await loadHistory();
      setStatus('生成成功');
    } catch (err) {
      setStatus(err.response?.data?.detail || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const loadGraph = async (sessionId) => {
    try {
      const userId = getUserId();
      const response = await getLearningMapGraph(userId, sessionId);
      const data = response.data;

      // 转换为 React Flow 格式
      const reactFlowNodes = (data.nodes || []).map(n => ({
        id: String(n.id),
        type: 'mindMapNode',
        data: {
          label: n.title,
          mastery: n.mastery,
          description: n.description,
          example: n.example,
          resources: n.resources
        },
        position: { x: 0, y: 0 }
      }));

      const reactFlowEdges = (data.edges || []).map(e => ({
        id: `${e.from_node_id}-${e.to_node_id}`,
        source: String(e.from_node_id),
        target: String(e.to_node_id),
        label: e.relation,
        type: 'smoothstep',
        animated: true
      }));

      // 应用布局算法
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        reactFlowNodes,
        reactFlowEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err) {
      console.error('加载图谱失败:', err);
    }
  };

  const handleHistoryClick = (session) => {
    setActiveSessionId(session.id);
    loadGraph(session.id);
  };

  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode({
      name: node.data.label,
      mastery: node.data.mastery,
      description: node.data.description,
      example: node.data.example,
      resources: node.data.resources || [],
    });
  }, []);

  const cardBase = `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'} p-6`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 顶部标题 */}
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            知识图谱
          </h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            可视化知识结构，理清学习路径
          </p>
        </div>

        <div className="grid grid-cols-12 gap-3">
          {/* 左侧：生成面板 + 历史记录 */}
          <div className="col-span-2 space-y-3">
            <div className={`${cardBase} p-4`}>
              <h2 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                生成知识图谱
              </h2>

              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    上传文件
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.docx,.pptx,.txt,.md"
                    className={`w-full text-xs ${isDark ? 'text-slate-300' : 'text-gray-700'}`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    或输入课程主题
                  </label>
                  <input
                    type="text"
                    value={courseTopic}
                    onChange={(e) => setCourseTopic(e.target.value)}
                    placeholder="例如：高中数学"
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? '生成中...' : '生成'}
                </button>

                {status && (
                  <div className={`text-xs p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
                    {status}
                  </div>
                )}
              </div>
            </div>

            {/* 历史记录 */}
            {history.length > 0 && (
              <div className={`${cardBase} p-4`}>
                <h2 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  历史记录
                </h2>
                <div className={`space-y-1.5 max-h-[calc(100vh-500px)] overflow-y-auto ${isDark ? 'scrollbar-dark' : 'scrollbar-light'}`}>
                  {history.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleHistoryClick(session)}
                      className={`w-full text-left p-2 text-xs rounded border transition-colors ${
                        activeSessionId === session.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : isDark
                          ? 'border-slate-700 hover:border-slate-600'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {session.topic || '未命名'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 中间：图谱显示 */}
          <div className="col-span-8">
            <div className={`${cardBase} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  知识图谱
                </h2>
                <div className="flex gap-3 text-xs">
                  {Object.entries(masteryColors).map(([key, color]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>
                        {key === 'strong' ? '掌握' : key === 'medium' ? '一般' : key === 'weak' ? '薄弱' : '未知'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`h-[calc(100vh-220px)] rounded-lg ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
                {nodes.length > 0 ? (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodeClick={handleNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="bottom-left"
                  >
                    <Background color={isDark ? '#334155' : '#e2e8f0'} />
                    <Controls />
                    <MiniMap
                      nodeColor={(node) => masteryColors[node.data.mastery] || masteryColors.unknown}
                      maskColor={isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(248, 250, 252, 0.8)'}
                    />
                  </ReactFlow>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🗺️</div>
                      <p className={isDark ? 'text-slate-400' : 'text-gray-600'}>
                        暂无图谱数据，请先生成
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：节点详情 */}
          <div className="col-span-2">
            {selectedNode ? (
              <div className={`${cardBase} p-4`}>
                <h3 className={`text-base font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedNode.name}
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      掌握程度
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: masteryColors[selectedNode.mastery] }}
                      />
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>
                        {selectedNode.mastery === 'strong' ? '掌握' : selectedNode.mastery === 'medium' ? '一般' : selectedNode.mastery === 'weak' ? '薄弱' : '未知'}
                      </span>
                    </div>
                  </div>

                  {selectedNode.description && (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        描述
                      </div>
                      <p className={`${isDark ? 'text-slate-300' : 'text-gray-700'} leading-relaxed`}>
                        {selectedNode.description}
                      </p>
                    </div>
                  )}

                  {selectedNode.example && (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        示例
                      </div>
                      <p className={`${isDark ? 'text-slate-300' : 'text-gray-700'} leading-relaxed`}>
                        {selectedNode.example}
                      </p>
                    </div>
                  )}

                  {selectedNode.resources && selectedNode.resources.length > 0 && (
                    <div>
                      <div className={`font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        推荐资源
                      </div>
                      <ul className="space-y-1">
                        {selectedNode.resources.map((resource, idx) => (
                          <li key={idx}>
                            <a
                              href={resource.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-blue-600 hover:underline ${!resource.url ? 'pointer-events-none opacity-50' : ''}`}
                            >
                              {resource.title || resource}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`${cardBase} p-4 h-full flex items-center justify-center`}>
                <div className="text-center">
                  <div className="text-4xl mb-2">👆</div>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    点击节点查看详情
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LearningMap;
