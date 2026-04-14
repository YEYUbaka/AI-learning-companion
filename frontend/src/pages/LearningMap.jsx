import { useEffect, useMemo, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  uploadLearningMapFile,
  generateLearningMap,
  getLearningMapGraph,
  getLearningMapHistory,
  exportLearningMapXMind,
} from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';
import MindMapNode from '../components/MindMapNode';
import { getLayoutedElements } from '../utils/mindMapLayout';
import { getUserId } from '../utils/auth';
import logger from '../utils/logger';

const masteryColors = {
  strong: '#22c55e',
  medium: '#f97316',
  weak: '#ef4444',
  unknown: '#94a3b8',
};

const treeRelations = new Set(['contains', 'part_of', 'prerequisite']);

const nodeTypes = {
  mindMapNode: MindMapNode,
};

function LearningMap() {
  const [rawGraph, setRawGraph] = useState({ session: null, nodes: [], edges: [] });
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [courseTopic, setCourseTopic] = useState('');
  const [status, setStatus] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [mapMode, setMapMode] = useState('document');
  const [viewMode, setViewMode] = useState('graph');
  const [relationFilter, setRelationFilter] = useState('all');
  const [masteryFilter, setMasteryFilter] = useState('all');
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const relationOptions = useMemo(() => {
    const relations = new Set();
    (rawGraph.edges || []).forEach((edge) => {
      if (edge.relation_type) {
        relations.add(edge.relation_type);
      }
    });
    return ['all', ...Array.from(relations)];
  }, [rawGraph.edges]);

  const buildGraphView = useCallback((graphData, currentViewMode, currentRelationFilter, currentMasteryFilter) => {
    const sourceNodes = graphData.nodes || [];
    const sourceEdges = graphData.edges || [];

    const filteredNodes = sourceNodes.filter((node) => {
      if (currentMasteryFilter !== 'all' && node.mastery !== currentMasteryFilter) {
        return false;
      }
      return true;
    });
    const allowedNodeIds = new Set(filteredNodes.map((node) => node.id));

    const filteredEdges = sourceEdges.filter((edge) => {
      const relation = edge.relation_type || edge.relation;
      if (currentViewMode === 'tree' && !treeRelations.has(relation)) {
        return false;
      }
      if (currentRelationFilter !== 'all' && relation !== currentRelationFilter) {
        return false;
      }
      return allowedNodeIds.has(edge.from_node_id) && allowedNodeIds.has(edge.to_node_id);
    });

    const reactFlowNodes = filteredNodes.map((node) => ({
      id: String(node.id),
      type: 'mindMapNode',
      data: {
        label: node.title,
        mastery: node.mastery,
        description: node.description,
        example: node.example,
        resources: node.resources,
        nodeType: node.node_type,
        sourceExcerpt: node.source_excerpt,
        sourceRef: node.source_ref,
        confidence: node.confidence,
        primaryParent: node.primary_parent,
      },
      position: { x: 0, y: 0 },
    }));

    const reactFlowEdges = filteredEdges.map((edge) => ({
      id: `${edge.from_node_id}-${edge.to_node_id}-${edge.relation_type || edge.relation}`,
      source: String(edge.from_node_id),
      target: String(edge.to_node_id),
      label: edge.relation_type || edge.relation,
      type: currentViewMode === 'tree' ? 'step' : 'smoothstep',
      animated: currentViewMode !== 'tree',
    }));

    const layouted = getLayoutedElements(reactFlowNodes, reactFlowEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, []);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    buildGraphView(rawGraph, viewMode, relationFilter, masteryFilter);
  }, [rawGraph, viewMode, relationFilter, masteryFilter, buildGraphView]);

  const loadHistory = async () => {
    try {
      const userId = getUserId();
      if (!userId) return;
      const response = await getLearningMapHistory(userId);
      setHistory(response.data.sessions || []);
    } catch (err) {
      logger.error('加载历史失败', err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileInfo(file);
    setStatus(`已选择文件: ${file.name}`);
  };

  const loadGraph = async (sessionId) => {
    try {
      const userId = getUserId();
      if (!userId) return;
      const response = await getLearningMapGraph(userId, sessionId);
      const data = response.data || {};
      setRawGraph({
        session: data.session || null,
        nodes: data.nodes || [],
        edges: data.edges || [],
      });
      if (data.session?.map_mode) {
        setMapMode(data.session.map_mode);
      }
    } catch (err) {
      logger.error('加载图谱失败', err);
      setStatus('加载图谱失败');
    }
  };

  const handleGenerate = async () => {
    if (!fileInfo && !courseTopic.trim()) {
      setStatus('请上传文件或输入课程主题');
      return;
    }

    const userId = getUserId();
    if (!userId) {
      setStatus('请先登录');
      return;
    }

    setLoading(true);
    setStatus('正在生成学习地图...');

    try {
      let fileId = null;
      if (fileInfo) {
        const formData = new FormData();
        formData.append('file', fileInfo);
        formData.append('user_id', userId);
        const uploadResponse = await uploadLearningMapFile(formData);
        fileId = uploadResponse.data.file_id;
      }

      const generateResponse = await generateLearningMap({
        user_id: userId,
        file_id: fileId,
        course_topic: courseTopic.trim() || fileInfo?.name,
        map_mode: mapMode,
      });

      const sessionId = generateResponse.data.session_id;
      setActiveSessionId(sessionId);
      await loadGraph(sessionId);
      await loadHistory();
      setStatus('学习地图生成成功');
    } catch (err) {
      logger.error('生成学习地图失败', err);
      setStatus(err.response?.data?.detail || '学习地图生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = async (session) => {
    setActiveSessionId(session.id);
    setRelationFilter('all');
    setMasteryFilter('all');
    await loadGraph(session.id);
  };

  const handleExport = async () => {
    if (!activeSessionId) return;

    setExporting(true);
    try {
      const response = await exportLearningMapXMind(activeSessionId);
      const blob = new Blob([response.data], {
        type: 'application/vnd.xmind.workbook',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `learning-map-${activeSessionId}.xmind`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus('XMind 导出成功');
    } catch (err) {
      logger.error('导出 XMind 失败', err);
      setStatus(err.response?.data?.detail || '导出 XMind 失败');
    } finally {
      setExporting(false);
    }
  };

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNode({
      name: node.data.label,
      mastery: node.data.mastery,
      description: node.data.description,
      example: node.data.example,
      resources: node.data.resources || [],
      nodeType: node.data.nodeType,
      sourceExcerpt: node.data.sourceExcerpt,
      sourceRef: node.data.sourceRef,
      confidence: node.data.confidence,
      primaryParent: node.data.primaryParent,
    });
  }, []);

  const cardBase = `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'} p-6`}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            知识图谱
          </h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            支持课程知识树与材料关系图，并可一键导出为 XMind
          </p>
        </div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3 space-y-3">
            <div className={`${cardBase} p-4`}>
              <h2 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                生成知识图谱
              </h2>

              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    图谱模式
                  </label>
                  <select
                    value={mapMode}
                    onChange={(event) => setMapMode(event.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="document">document 材料关系图</option>
                    <option value="syllabus">syllabus 课程知识树</option>
                  </select>
                </div>

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
                    onChange={(event) => setCourseTopic(event.target.value)}
                    placeholder="例如：高中数学函数与导数"
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? '生成中...' : '生成图谱'}
                </button>

                <button
                  onClick={handleExport}
                  disabled={!activeSessionId || exporting}
                  className={`w-full py-2 text-sm rounded-lg font-medium transition-colors ${
                    !activeSessionId || exporting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {exporting ? '导出中...' : '导出 XMind'}
                </button>

                {status ? (
                  <div className={`text-xs p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
                    {status}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`${cardBase} p-4`}>
              <h2 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                可视化控制
              </h2>
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    视图模式
                  </label>
                  <select
                    value={viewMode}
                    onChange={(event) => setViewMode(event.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="graph">关系图</option>
                    <option value="tree">树图</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    关系类型过滤
                  </label>
                  <select
                    value={relationFilter}
                    onChange={(event) => setRelationFilter(event.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    {relationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === 'all' ? '全部关系' : option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    掌握度筛选
                  </label>
                  <select
                    value={masteryFilter}
                    onChange={(event) => setMasteryFilter(event.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">全部</option>
                    <option value="strong">掌握</option>
                    <option value="medium">一般</option>
                    <option value="weak">薄弱</option>
                    <option value="unknown">未知</option>
                  </select>
                </div>
              </div>
            </div>

            {history.length > 0 ? (
              <div className={`${cardBase} p-4`}>
                <h2 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  历史记录
                </h2>
                <div className={`space-y-1.5 max-h-[calc(100vh-560px)] overflow-y-auto ${isDark ? 'scrollbar-dark' : 'scrollbar-light'}`}>
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
                      <div className={`mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {session.map_mode || 'document'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="col-span-6">
            <div className={`${cardBase} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    图谱预览
                  </h2>
                  {rawGraph.session ? (
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      session: {rawGraph.session.id} · mode: {rawGraph.session.map_mode} · topic: {rawGraph.session.topic || '未命名'}
                    </p>
                  ) : null}
                </div>
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
                      <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <p className={isDark ? 'text-slate-400' : 'text-gray-600'}>
                        暂无图谱数据，请先生成
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-3">
            {selectedNode ? (
              <div className={`${cardBase} p-4`}>
                <h3 className={`text-base font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedNode.name}
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      节点类型
                    </div>
                    <p className={isDark ? 'text-white' : 'text-gray-900'}>{selectedNode.nodeType || 'concept'}</p>
                  </div>

                  <div>
                    <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      掌握程度
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: masteryColors[selectedNode.mastery] || masteryColors.unknown }}
                      />
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>
                        {{ strong: '掌握', medium: '一般', weak: '薄弱', unknown: '未知' }[selectedNode.mastery] || '未知'}
                      </span>
                    </div>
                  </div>

                  {selectedNode.description ? (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        描述
                      </div>
                      <p className={`${isDark ? 'text-slate-300' : 'text-gray-700'} leading-relaxed`}>
                        {selectedNode.description}
                      </p>
                    </div>
                  ) : null}

                  {selectedNode.example ? (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        示例
                      </div>
                      <p className={`${isDark ? 'text-slate-300' : 'text-gray-700'} leading-relaxed`}>
                        {selectedNode.example}
                      </p>
                    </div>
                  ) : null}

                  {selectedNode.primaryParent ? (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        主父节点
                      </div>
                      <p className={isDark ? 'text-slate-300' : 'text-gray-700'}>{selectedNode.primaryParent}</p>
                    </div>
                  ) : null}

                  {selectedNode.sourceExcerpt ? (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        证据摘要
                      </div>
                      <p className={isDark ? 'text-slate-300' : 'text-gray-700'}>{selectedNode.sourceExcerpt}</p>
                    </div>
                  ) : null}

                  {selectedNode.sourceRef ? (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        来源引用
                      </div>
                      <p className={isDark ? 'text-slate-300' : 'text-gray-700'}>{selectedNode.sourceRef}</p>
                    </div>
                  ) : null}

                  {selectedNode.confidence != null ? (
                    <div>
                      <div className={`font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        置信度
                      </div>
                      <p className={isDark ? 'text-slate-300' : 'text-gray-700'}>
                        {Math.round(selectedNode.confidence * 100)}%
                      </p>
                    </div>
                  ) : null}

                  {selectedNode.resources && selectedNode.resources.length > 0 ? (
                    <div>
                      <div className={`font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                        推荐资源
                      </div>
                      <ul className="space-y-1">
                        {selectedNode.resources.map((resource, index) => (
                          <li key={`${resource.url || resource.title || index}-${index}`}>
                            <a
                              href={resource.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-blue-600 hover:underline ${!resource.url ? 'pointer-events-none opacity-50' : ''}`}
                            >
                              {resource.title || resource.url || `资源 ${index + 1}`}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={`${cardBase} p-4 h-full flex items-center justify-center`}>
                <div className="text-center">
                  <div className={`w-16 h-16 mx-auto mb-2 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
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
