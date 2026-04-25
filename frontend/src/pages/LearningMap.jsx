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
import { getAnchorProps } from '../utils/links';
import logger from '../utils/logger';

const masteryColors = {
  strong: '#22c55e',
  medium: '#f97316',
  weak: '#ef4444',
  unknown: '#94a3b8',
};

const masteryLabels = {
  strong: '掌握',
  medium: '一般',
  weak: '薄弱',
  unknown: '未知',
};

const mapModeLabels = {
  document: '材料关系图',
  syllabus: '课程知识树',
};

const viewModeLabels = {
  graph: '关系图',
  tree: '树状图',
};

const mobilePanelOptions = [
  { key: 'compose', label: '生成' },
  { key: 'graph', label: '图谱' },
  { key: 'details', label: '详情' },
  { key: 'history', label: '历史' },
];

const treeRelations = new Set(['contains', 'part_of', 'prerequisite']);

const nodeTypes = {
  mindMapNode: MindMapNode,
};

const getIsMobileLayout = () => typeof window !== 'undefined' && window.innerWidth < 1024;

function EmptyGraphState({ isDark }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center px-6">
        <div
          className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl ${
            isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className={isDark ? 'text-slate-400' : 'text-gray-600'}>暂无图谱数据，请先生成</p>
      </div>
    </div>
  );
}

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
  const [mobilePanel, setMobilePanel] = useState('compose');
  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);
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

  const summaryItems = useMemo(
    () => [
      { label: '节点数', value: rawGraph.nodes?.length || 0 },
      { label: '关系数', value: rawGraph.edges?.length || 0 },
      { label: '图谱模式', value: mapModeLabels[mapMode] || mapMode },
    ],
    [mapMode, rawGraph.edges, rawGraph.nodes]
  );

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

  useEffect(() => {
    const handleResize = () => setIsMobileLayout(getIsMobileLayout());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadHistory = async () => {
    try {
      const userId = getUserId();
      if (!userId) return;
      const response = await getLearningMapHistory(userId);
      setHistory(response.data.sessions || []);
    } catch (err) {
      logger.error('加载图谱历史失败', err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileInfo(file);
    setStatus(`已选择文件：${file.name}`);
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
      setStatus('请先上传文件或输入课程主题');
      return;
    }

    const userId = getUserId();
    if (!userId) {
      setStatus('请先登录');
      return;
    }

    setLoading(true);
    setStatus('正在生成知识图谱...');

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
      setSelectedNode(null);
      await loadGraph(sessionId);
      await loadHistory();
      setStatus('知识图谱生成成功');
      if (isMobileLayout) {
        setMobilePanel('graph');
      }
    } catch (err) {
      logger.error('生成知识图谱失败', err);
      setStatus(err.response?.data?.detail || '知识图谱生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = async (session) => {
    setActiveSessionId(session.id);
    setRelationFilter('all');
    setMasteryFilter('all');
    setSelectedNode(null);
    await loadGraph(session.id);
    if (isMobileLayout) {
      setMobilePanel('graph');
    }
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
    if (getIsMobileLayout()) {
      setMobilePanel('details');
    }
  }, []);

  const cardBase = `${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-gray-200'} border rounded-2xl shadow-sm`;

  const renderSectionTitle = (title, description) => (
    <div className="mb-4">
      <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
      {description ? (
        <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{description}</p>
      ) : null}
    </div>
  );

  const renderGenerateCard = () => (
    <div className={`${cardBase} p-4 sm:p-5`}>
      {renderSectionTitle('生成知识图谱', '支持上传课件材料，或直接输入课程主题生成图谱')}
      <div className="space-y-4">
        <div>
          <label className={`mb-1.5 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            图谱模式
          </label>
          <select
            value={mapMode}
            onChange={(event) => setMapMode(event.target.value)}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="document">document 材料关系图</option>
            <option value="syllabus">syllabus 课程知识树</option>
          </select>
        </div>

        <div>
          <label className={`mb-1.5 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            上传文件
          </label>
          <input
            type="file"
            onChange={handleFileUpload}
            accept=".pdf,.docx,.pptx,.txt,.md"
            className={`w-full text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}
          />
          {fileInfo ? (
            <div className={`mt-2 rounded-xl px-3 py-2 text-xs ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
              当前文件：{fileInfo.name}
            </div>
          ) : null}
        </div>

        <div>
          <label className={`mb-1.5 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            或输入课程主题
          </label>
          <input
            type="text"
            value={courseTopic}
            onChange={(event) => setCourseTopic(event.target.value)}
            placeholder="例如：高中数学函数与导数"
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              isDark
                ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '生成中...' : '生成图谱'}
          </button>
          <button
            onClick={handleExport}
            disabled={!activeSessionId || exporting}
            className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              !activeSessionId || exporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {exporting ? '导出中...' : '导出 XMind'}
          </button>
        </div>

        {status ? (
          <div className={`rounded-xl px-3 py-2.5 text-xs ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
            {status}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderControlsCard = () => (
    <div className={`${cardBase} p-4 sm:p-5`}>
      {renderSectionTitle('可视化控制', '切换视图方式，并筛选关系类型与掌握程度')}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <label className={`mb-1.5 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            视图模式
          </label>
          <select
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value)}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="graph">关系图</option>
            <option value="tree">树状图</option>
          </select>
        </div>

        <div>
          <label className={`mb-1.5 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            关系类型筛选
          </label>
          <select
            value={relationFilter}
            onChange={(event) => setRelationFilter(event.target.value)}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
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
          <label className={`mb-1.5 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            掌握程度筛选
          </label>
          <select
            value={masteryFilter}
            onChange={(event) => setMasteryFilter(event.target.value)}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
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
  );

  const renderHistoryCard = (maxHeightClass = 'max-h-[360px]') => (
    <div className={`${cardBase} p-4 sm:p-5`}>
      {renderSectionTitle('历史记录', '快速切换到最近生成的图谱会话')}
      {history.length > 0 ? (
        <div className={`space-y-2 overflow-y-auto ${maxHeightClass}`}>
          {history.map((session) => (
            <button
              key={session.id}
              onClick={() => handleHistoryClick(session)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                activeSessionId === session.id
                  ? isDark
                    ? 'border-blue-500 bg-blue-950/30'
                    : 'border-blue-600 bg-blue-50'
                  : isDark
                    ? 'border-slate-700 hover:border-slate-600'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`truncate text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {session.topic || '未命名图谱'}
              </div>
              <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {mapModeLabels[session.map_mode] || session.map_mode || 'document'}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}>
          还没有历史图谱记录
        </div>
      )}
    </div>
  );

  const renderGraphCard = (heightClass) => (
    <div className={`${cardBase} p-4 sm:p-5`}>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>图谱预览</h2>
          {rawGraph.session ? (
            <p className={`mt-1 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              会话：{rawGraph.session.id} · 模式：{mapModeLabels[rawGraph.session.map_mode] || rawGraph.session.map_mode} · 主题：
              {rawGraph.session.topic || '未命名'}
            </p>
          ) : (
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              生成后可在这里查看知识结构与节点关系
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(masteryColors).map(([key, color]) => (
            <div
              key={key}
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {masteryLabels[key]}
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl ${heightClass} ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
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
            {!isMobileLayout ? (
              <MiniMap
                nodeColor={(node) => masteryColors[node.data.mastery] || masteryColors.unknown}
                maskColor={isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(248, 250, 252, 0.8)'}
              />
            ) : null}
          </ReactFlow>
        ) : (
          <EmptyGraphState isDark={isDark} />
        )}
      </div>

      {isMobileLayout ? (
        <p className={`mt-3 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          提示：在手机上点击节点后会自动切换到“详情”面板。
        </p>
      ) : null}
    </div>
  );

  const renderNodeDetailsCard = () => (
    <div className={`${cardBase} p-4 sm:p-5 ${!selectedNode && !isMobileLayout ? 'h-full' : ''}`}>
      {selectedNode ? (
        <>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`truncate text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedNode.name}</h3>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                节点详情、证据与推荐资源
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
                isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: masteryColors[selectedNode.mastery] || masteryColors.unknown }}
              />
              {masteryLabels[selectedNode.mastery] || '未知'}
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <div className={`mb-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>节点类型</div>
              <p className={isDark ? 'text-white' : 'text-gray-900'}>{selectedNode.nodeType || 'concept'}</p>
            </div>

            {selectedNode.description ? (
              <div>
                <div className={`mb-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>描述</div>
                <p className={`${isDark ? 'text-slate-300' : 'text-gray-700'} leading-6`}>{selectedNode.description}</p>
              </div>
            ) : null}

            {selectedNode.example ? (
              <div>
                <div className={`mb-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>示例</div>
                <p className={`${isDark ? 'text-slate-300' : 'text-gray-700'} leading-6`}>{selectedNode.example}</p>
              </div>
            ) : null}

            {selectedNode.primaryParent ? (
              <div>
                <div className={`mb-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>主父节点</div>
                <p className={isDark ? 'text-slate-300' : 'text-gray-700'}>{selectedNode.primaryParent}</p>
              </div>
            ) : null}

            {selectedNode.sourceExcerpt ? (
              <div>
                <div className={`mb-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>证据摘要</div>
                <p className={`${isDark ? 'text-slate-300' : 'text-gray-700'} leading-6`}>{selectedNode.sourceExcerpt}</p>
              </div>
            ) : null}

            {selectedNode.sourceRef ? (
              <div>
                <div className={`mb-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>来源引用</div>
                <p className={isDark ? 'text-slate-300' : 'text-gray-700'}>{selectedNode.sourceRef}</p>
              </div>
            ) : null}

            {selectedNode.confidence != null ? (
              <div>
                <div className={`mb-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>置信度</div>
                <p className={isDark ? 'text-slate-300' : 'text-gray-700'}>{Math.round(selectedNode.confidence * 100)}%</p>
              </div>
            ) : null}

            {selectedNode.resources && selectedNode.resources.length > 0 ? (
              <div>
                <div className={`mb-2 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>推荐资源</div>
                <ul className="space-y-2">
                  {selectedNode.resources.map((resource, index) => (
                    <li key={`${resource.url || resource.title || index}-${index}`}>
                      <a
                        {...getAnchorProps(resource.url || '#')}
                        className={`break-all text-blue-600 hover:underline ${!resource.url ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {resource.title || resource.url || `资源 ${index + 1}`}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className={`flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}>
          <div className="px-6 text-center">
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl ${
                isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <p className="text-sm">点击图谱节点查看详情</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'} px-3 py-4 sm:px-4 sm:py-6 lg:px-6`}>
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className={`${cardBase} overflow-hidden`}>
          <div className={`px-4 py-5 sm:px-6 sm:py-6 ${isDark ? 'bg-slate-800/70' : 'bg-white'}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Learning Map</p>
                <h1 className={`mt-2 text-2xl font-bold sm:text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>知识图谱</h1>
                <p className={`mt-2 text-sm leading-6 sm:text-base ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                  支持课程知识树与材料关系图生成，并可一键导出为 XMind。移动端采用分区式布局，避免图谱、控制区和详情区同时拥挤。
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl px-3 py-3 text-center ${isDark ? 'bg-slate-700/80 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
                  >
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{item.label}</div>
                    <div className="mt-1 text-sm font-semibold sm:text-base">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isMobileLayout ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mobilePanelOptions.map((panel) => (
                <button
                  key={panel.key}
                  type="button"
                  onClick={() => setMobilePanel(panel.key)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    mobilePanel === panel.key
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {panel.label}
                </button>
              ))}
            </div>

            {mobilePanel === 'compose' ? (
              <div className="space-y-4">
                {renderGenerateCard()}
                {renderControlsCard()}
              </div>
            ) : null}

            {mobilePanel === 'graph' ? renderGraphCard('h-[56vh] min-h-[320px]') : null}

            {mobilePanel === 'details' ? renderNodeDetailsCard() : null}

            {mobilePanel === 'history' ? renderHistoryCard('max-h-[60vh]') : null}
          </>
        ) : (
          <div className="grid grid-cols-12 gap-4 xl:gap-6">
            <div className="col-span-12 xl:col-span-3 space-y-4">
              {renderGenerateCard()}
              {renderControlsCard()}
              {renderHistoryCard('max-h-[calc(100vh-620px)]')}
            </div>

            <div className="col-span-12 xl:col-span-6">
              {renderGraphCard('h-[calc(100vh-260px)] min-h-[560px]')}
            </div>

            <div className="col-span-12 xl:col-span-3">
              {renderNodeDetailsCard()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LearningMap;
