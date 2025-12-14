import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  uploadLearningMapFile,
  generateLearningMap,
  getLearningMapGraph,
  getModelConfigs,
  getLearningMapHistory,
  deleteLearningMapSession,
} from '../api/apiClient';
import { useLearningMapStore } from '../store/learningMapStore';
import { useThemeStore } from '../store/themeStore';

const masteryColors = {
  strong: '#22c55e',
  medium: '#f97316',
  weak: '#ef4444',
  unknown: '#94a3b8',
};

const LearningMap = () => {
  const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
  const { nodes, edges, loading, setGraph, setLoading, selectedNode, setSelectedNode } =
    useLearningMapStore();
  const [fileInfo, setFileInfo] = useState(null);
  const [courseTopic, setCourseTopic] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [modelOptions, setModelOptions] = useState([]);
  const graphRef = useRef(null);
  const graphContainerRef = useRef(null);
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });
  const [history, setHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [isGraphStatic, setIsGraphStatic] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const palette = useMemo(
    () =>
      isDark
        ? {
            page: 'p-6 space-y-6 relative min-h-screen bg-gradient-to-b from-[#05060a] via-[#070b13] to-[#0c111f] text-white',
            floatingCard: 'fixed right-6 top-28 w-96 bg-[#101628] text-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/10 z-30 p-6',
            infoLabel: 'text-white/60',
            infoSection: 'text-white/75',
            primaryPanel: 'bg-[#0f1527] rounded-2xl shadow-2xl border border-white/10 p-6 text-white',
            secondaryPanel: 'bg-[#10192f] rounded-2xl shadow-xl border border-white/10 p-6 text-white',
            uploadArea: 'flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/20 rounded-xl bg-[#0b1326] hover:border-cyan-400/60 hover:bg-[#0d172f] transition cursor-pointer',
            input:
              'w-full rounded-xl border border-white/10 bg-[#0a1120] px-4 py-3 text-white placeholder:text-white/40 transition focus:bg-[#0e172c] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/30 focus:outline-none shadow-inner',
            button:
              'w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-lg shadow-cyan-900/40 hover:shadow-cyan-900/60 hover:-translate-y-0.5 transition disabled:opacity-40',
            status: 'text-sm text-white/60 bg-white/5 rounded-lg px-3 py-2',
            historyActive: 'border-cyan-500 bg-cyan-500/10 text-cyan-100',
            historyInactive: 'border-white/10 hover:border-cyan-400/60 text-white',
            graphPanel: 'lg:col-span-2 bg-[#0c111f] rounded-2xl shadow-2xl border border-white/10 p-6',
            legendText: 'text-white/70',
            graphBg: '#05060a',
            nodeText: '#f8fafc',
            nodeFill: '#10172a',
            historyMeta: 'text-white/50',
          }
        : {
            page: 'p-6 space-y-6 relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900',
            floatingCard: 'fixed right-6 top-28 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-30 p-6',
            infoLabel: 'text-gray-500',
            infoSection: 'text-gray-700',
            primaryPanel: 'bg-white rounded-2xl shadow-lg shadow-blue-50 p-6 border border-gray-100',
            secondaryPanel: 'bg-white rounded-2xl shadow-lg shadow-blue-50 p-6 border border-gray-100',
            uploadArea: 'flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl bg-slate-50 hover:border-primary/50 hover:bg-white transition cursor-pointer',
            input:
              'w-full rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 transition focus:bg-white focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:outline-none shadow-inner',
            button:
              'w-full py-3 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-blue-200 hover:shadow-primary/40 hover:-translate-y-0.5 transition disabled:opacity-50',
            status: 'text-sm text-gray-600 bg-slate-50 rounded-lg px-3 py-2',
            historyActive: 'border-primary bg-blue-50 text-blue-700',
            historyInactive: 'border-gray-100 hover:border-primary/40 text-gray-700',
            graphPanel: 'lg:col-span-2 bg-white rounded-2xl shadow-lg shadow-blue-50 border border-gray-100 p-6',
            legendText: 'text-gray-600',
            graphBg: '#f8fafc',
            nodeText: '#0f172a',
            nodeFill: '#ffffff',
            historyMeta: 'text-gray-500',
          },
    [isDark]
  );

  const fetchGraph = async (sessionId) => {
    if (!userInfo?.id) return;
    setIsGraphStatic(false);
    try {
      const { data } = await getLearningMapGraph(userInfo.id, sessionId);
      setGraph(data.nodes, data.edges);
      setSessionMeta(data.session);
      setActiveSessionId(data.session?.id || null);
      setSelectedNode(null);
    } catch (error) {
      console.error('获取知识图谱失败', error);
    }
  };

  const fetchHistory = async () => {
    if (!userInfo?.id) return;
    try {
      const { data } = await getLearningMapHistory(userInfo.id);
      setHistory(data.sessions || []);
    } catch (error) {
      console.error('获取知识图谱历史失败', error);
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation(); // 阻止触发父元素的点击事件
    if (!userInfo?.id) return;
    
    // 确认删除
    if (!window.confirm('确定要删除这个知识图谱吗？此操作不可恢复。')) {
      return;
    }

    try {
      await deleteLearningMapSession(userInfo.id, sessionId);
      
      // 如果删除的是当前显示的会话，清空显示
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setSessionMeta(null);
        setGraph([], []);
      }
      
      // 刷新历史记录列表
      await fetchHistory();
    } catch (error) {
      console.error('删除知识图谱失败', error);
      alert('删除失败，请稍后重试');
    }
  };

  useEffect(() => {
    if (!userInfo?.id) return;
    fetchHistory();
    fetchGraph();
    setIsGraphStatic(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.id]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data } = await getModelConfigs(0, 200);
        const enabledModels = data.filter((m) => m.enabled);
        setModelOptions(enabledModels);
      } catch (error) {
        console.error('获取模型列表失败', error);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    const updateGraphSize = () => {
      if (!graphContainerRef.current) return;
      const { clientWidth, clientHeight } = graphContainerRef.current;
      setGraphSize({
        width: clientWidth,
        height: clientHeight,
      });
    };

    updateGraphSize();
    window.addEventListener('resize', updateGraphSize);
    return () => window.removeEventListener('resize', updateGraphSize);
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !userInfo?.id) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userInfo.id);
    try {
      setStatus('正在上传并解析资料...');
      const { data } = await uploadLearningMapFile(formData);
      setFileInfo(data);
      setStatus('资料解析成功，可以生成知识图谱。');
    } catch (error) {
      console.error(error);
      setStatus('文件上传失败，请重试');
    }
  };

  const handleGenerate = async () => {
    if (!userInfo?.id) return;
    if (!fileInfo?.file_id && !courseTopic) {
      setStatus('请上传资料或输入课程主题');
      return;
    }
    try {
      setLoading(true);
      setStatus('AI 正在生成知识图谱，请稍候...');
      const { data } = await generateLearningMap({
        user_id: userInfo.id,
        file_id: fileInfo?.file_id,
        course_topic: courseTopic,
        provider: provider || undefined,
      });
      await fetchHistory();
      await fetchGraph(data.session_id);
      setStatus('知识图谱生成完成');
    } catch (error) {
      console.error(error);
      setStatus(error?.response?.data?.detail || '生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFocusCenter = () => {
    if (!graphRef.current || !nodes.length) return;

    // 选择度数最高的节点作为“中心”节点（近似代表知识核心）
    const degreeMap = new Map();
    edges.forEach((edge) => {
      const fromId = edge.from_node_id;
      const toId = edge.to_node_id;
      degreeMap.set(fromId, (degreeMap.get(fromId) || 0) + 1);
      degreeMap.set(toId, (degreeMap.get(toId) || 0) + 1);
    });

    let centerNode = nodes[0];
    let maxDegree = -1;
    nodes.forEach((node) => {
      const degree = degreeMap.get(node.id) || 0;
      if (degree > maxDegree) {
        maxDegree = degree;
        centerNode = node;
      }
    });

    // 在右侧详情中高亮中心节点
    if (centerNode) {
      setSelectedNode({
        id: centerNode.id,
        name: centerNode.title,
        mastery: centerNode.mastery || 'unknown',
        level: centerNode.level,
        description: centerNode.description,
        example: centerNode.example,
        resources: centerNode.resources || [],
      });
    }

    // 适当延迟，等力导向布局稳定后再执行缩放与居中
    setTimeout(() => {
      if (!graphRef.current) return;
      // 自动缩放到一个合适的视野范围，整体居中
      // 检查方法是否存在，避免调用不存在的方法
      if (typeof graphRef.current.zoomToFit === 'function') {
        graphRef.current.zoomToFit(400, 80);
      }
      setTimeout(() => {
        setIsGraphStatic(true);
      }, 650);
    }, 600);
  };

  useEffect(() => {
    if (nodes.length) {
      handleAutoFocusCenter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((node) => ({
        id: node.id,
        name: node.title,
        mastery: node.mastery || 'unknown',
        level: node.level,
        description: node.description,
        example: node.example,
        resources: node.resources || [],
      })),
      links: edges.map((edge) => ({
        source: edge.from_node_id,
        target: edge.to_node_id,
        relation: edge.relation,
      })),
    }),
    [nodes, edges]
  );

  const inputBaseClasses = palette.input;
  
  // 修复：react-force-graph-2d 的 ref 可能没有 d3Alpha 方法
  // 使用 staticGraph prop 来控制图形是否静态，它会自动处理力导向布局的停止和恢复
  // 节点位置的冻结通过 onNodeDrag 回调处理，不需要手动操作

  const handleNodeDrag = (node) => {
    node.fx = node.x;
    node.fy = node.y;
  };

  return (
    <div className={palette.page}>
      {selectedNode && (
        <div className={palette.floatingCard}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedNode.name}</p>
              <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>层级：{selectedNode.level || '未标注'}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor:
                    masteryColors[selectedNode.mastery] || masteryColors.unknown,
                }}
              >
                {selectedNode.mastery}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className={isDark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-600'}
              >
                ✕
              </button>
            </div>
          </div>
          <div className={`space-y-3 text-sm max-h-[60vh] overflow-y-auto pr-2 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
            <div>
              <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>描述</p>
              <p className={isDark ? 'text-white/80' : 'text-gray-700'}>{selectedNode.description || '暂无描述'}</p>
            </div>
            <div>
              <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>示例</p>
              <p className={isDark ? 'text-white/80' : 'text-gray-700'}>{selectedNode.example || '暂无示例'}</p>
            </div>
            <div>
              <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>推荐资源</p>
              {selectedNode.resources?.length ? (
                <ul className={`list-disc ml-5 space-y-1 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                  {selectedNode.resources.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className={isDark ? 'text-white/80' : 'text-gray-700'}>暂无资源</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className={`${palette.primaryPanel} min-h-[360px] transition hover:-translate-y-0.5`}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-base">
                ①
              </span>
              知识图谱生成
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">上传资料</label>
                <label className={palette.uploadArea}>
                  <span className="text-sm">{isDark ? '点击或拖拽文件到此处' : '点击或拖拽文件到此处'}</span>
                  <span className="text-xs mt-1 text-white/40">支持 PDF / DOCX / PPTX / TXT / MD</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {fileInfo && (
                  <p className={`mt-2 text-xs ${palette.infoLabel}`}>
                    已解析：{fileInfo.file_name}，内容预览：{fileInfo.text_preview}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white/70">
                  或输入课程主题
                </label>
                <input
                  type="text"
                  value={courseTopic}
                  onChange={(e) => setCourseTopic(e.target.value)}
                  placeholder="例如：高中函数、线性代数"
                  className={inputBaseClasses}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">指定模型（可选）</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className={`${inputBaseClasses} pr-10`}
                >
                  <option value="">使用默认模型（根据优先级自动选择）</option>
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.provider_name}>
                      {model.provider_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleGenerate}
                className={palette.button}
                disabled={loading}
              >
                {loading ? '生成中...' : '生成知识图谱'}
              </button>
              {status && (
                <p className={`${palette.status} transition-opacity duration-300`}>
                  {status}
                </p>
              )}
            </div>
          </div>
          <div className={`${palette.secondaryPanel} min-h-[280px]`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">历史记录</h2>
                <p className={`text-sm ${palette.infoLabel}`}>点击可加载之前的图谱</p>
              </div>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {history.length === 0 && (
                <p className={`text-sm ${palette.infoLabel}`}>暂无历史记录</p>
              )}
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`group relative w-full px-3 py-2 rounded-lg border transition hover:-translate-y-0.5 ${
                    activeSessionId === item.id ? palette.historyActive : palette.historyInactive
                  }`}
                >
                  <button
                    onClick={() => fetchGraph(item.id)}
                    className="w-full text-left pr-8"
                  >
                    <p className="text-sm font-semibold truncate">
                      {item.topic || '未命名图谱'}
                    </p>
                    <p className={`text-xs truncate ${palette.historyMeta}`}>
                      {new Date(item.created_at).toLocaleString()} ·{' '}
                      {item.provider || '自动'}
                    </p>
                  </button>
                  <button
                    onClick={(e) => handleDeleteSession(item.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
                    title="删除"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={`${palette.graphPanel} min-h-[580px]`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">知识图谱</h2>
              {sessionMeta ? (
                <p className={`text-sm ${palette.infoLabel}`}>
                  {sessionMeta.topic || '未命名图谱'} ·{' '}
                  {new Date(sessionMeta.created_at).toLocaleString()}
                  {sessionMeta.provider && ` · 模型：${sessionMeta.provider}`}
                </p>
              ) : (
                <p className={`text-sm ${palette.infoLabel}`}>暂无数据，请先生成图谱</p>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm">
              {Object.entries(masteryColors).map(([key, color]) => (
                <div key={key} className={`flex items-center space-x-1 ${palette.legendText}`}>
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                  <span>{key}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            ref={graphContainerRef}
            className="h-[520px] rounded-2xl overflow-hidden relative"
          >
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={graphSize.width || undefined}
              height={graphSize.height || undefined}
              linkDirectionalArrowLength={0}
              linkDirectionalArrowRelPos={1}
              linkColor={() =>
                isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)'
              }
              linkWidth={() => 1.5}
              linkLabel={(link) => link.relation}
              linkCanvasObject={(link, ctx, globalScale) => {
                const source = link.source;
                const target = link.target;
                
                // 获取节点位置
                const sx = source.x || 0;
                const sy = source.y || 0;
                const tx = target.x || 0;
                const ty = target.y || 0;
                
                // 获取节点矩形大小
                const sourceBoxWidth = source.__boxWidth || 60;
                const sourceBoxHeight = source.__boxHeight || 24;
                const targetBoxWidth = target.__boxWidth || 60;
                const targetBoxHeight = target.__boxHeight || 24;
                
                // 计算方向向量
                const dx = tx - sx;
                const dy = ty - sy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist === 0) return;
                
                // 归一化方向向量
                const nx = dx / dist;
                const ny = dy / dist;
                
                // 计算矩形边缘与射线的交点
                // 使用标准的矩形-射线交点算法
                const getRectEdgePoint = (centerX, centerY, boxWidth, boxHeight, dirX, dirY) => {
                  const halfW = boxWidth / 2;
                  const halfH = boxHeight / 2;
                  
                  // 计算射线与矩形四条边的交点参数 t
                  // 射线方程: P = center + t * dir
                  // 矩形边界: x = centerX ± halfW, y = centerY ± halfH
                  
                  let t = Infinity;
                  
                  // 检查与左右边的交点
                  if (dirX !== 0) {
                    const tRight = (halfW) / dirX;
                    const yRight = centerY + dirY * tRight;
                    if (tRight > 0 && Math.abs(yRight - centerY) <= halfH) {
                      t = Math.min(t, tRight);
                    }
                    
                    const tLeft = (-halfW) / dirX;
                    const yLeft = centerY + dirY * tLeft;
                    if (tLeft > 0 && Math.abs(yLeft - centerY) <= halfH) {
                      t = Math.min(t, tLeft);
                    }
                  }
                  
                  // 检查与上下边的交点
                  if (dirY !== 0) {
                    const tTop = (halfH) / dirY;
                    const xTop = centerX + dirX * tTop;
                    if (tTop > 0 && Math.abs(xTop - centerX) <= halfW) {
                      t = Math.min(t, tTop);
                    }
                    
                    const tBottom = (-halfH) / dirY;
                    const xBottom = centerX + dirX * tBottom;
                    if (tBottom > 0 && Math.abs(xBottom - centerX) <= halfW) {
                      t = Math.min(t, tBottom);
                    }
                  }
                  
                  // 如果找到有效交点，计算边缘点
                  if (t !== Infinity && t > 0) {
                    return {
                      x: centerX + dirX * t,
                      y: centerY + dirY * t
                    };
                  }
                  
                  // 如果没有找到（理论上不应该发生），返回中心点
                  return { x: centerX, y: centerY };
                };
                
                // 计算源节点和目标节点的边缘点
                const sourceEdge = getRectEdgePoint(sx, sy, sourceBoxWidth, sourceBoxHeight, nx, ny);
                const targetEdge = getRectEdgePoint(tx, ty, targetBoxWidth, targetBoxHeight, -nx, -ny);
                
                // 绘制链接线
                ctx.beginPath();
                ctx.moveTo(sourceEdge.x, sourceEdge.y);
                ctx.lineTo(targetEdge.x, targetEdge.y);
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // 绘制箭头（在目标节点边缘）
                const arrowLength = 3;
                const arrowWidth = 2;
                const angle = Math.atan2(ny, nx);
                
                ctx.beginPath();
                ctx.moveTo(targetEdge.x, targetEdge.y);
                ctx.lineTo(
                  targetEdge.x - arrowLength * Math.cos(angle) + arrowWidth * Math.cos(angle - Math.PI / 2),
                  targetEdge.y - arrowLength * Math.sin(angle) + arrowWidth * Math.sin(angle - Math.PI / 2)
                );
                ctx.lineTo(
                  targetEdge.x - arrowLength * Math.cos(angle) + arrowWidth * Math.cos(angle + Math.PI / 2),
                  targetEdge.y - arrowLength * Math.sin(angle) + arrowWidth * Math.sin(angle + Math.PI / 2)
                );
                ctx.closePath();
                ctx.fillStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)';
                ctx.fill();
              }}
              nodeLabel={(node) => `${node.name}\n掌握度:${node.mastery}`}
              onNodeClick={(node) => setSelectedNode(node)}
              backgroundColor={palette.graphBg}
              staticGraph={isGraphStatic}
              staticGraphWithDrag={isGraphStatic}
              enableNodeDrag
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDrag}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = node.name || '';
                const summary =
                  (node.description || '').length > 22
                    ? `${node.description.slice(0, 22)}...`
                    : node.description || '';
                const level = node.level || '';

                const lines = summary ? [label, summary] : [label];
                const fontSize = 12 / globalScale;
                const lineHeight = fontSize * 1.4;
                ctx.font = `${fontSize}px sans-serif`;

                const textWidths = lines.map((text) => ctx.measureText(text).width);
                const maxTextWidth = Math.max(...textWidths, 40);
                const padding = 6 / globalScale;
                const boxWidth = maxTextWidth + padding * 2;
                const boxHeight = lineHeight * lines.length + padding * 2;

                const x = node.x || 0;
                const y = node.y || 0;

                // 记录当前节点的矩形范围，供 pointer 命中区域使用
                node.__boxWidth = boxWidth;
                node.__boxHeight = boxHeight;

                // 绘制带颜色边框的矩形节点
                ctx.beginPath();
                ctx.fillStyle = palette.nodeFill;
                ctx.strokeStyle =
                  masteryColors[node.mastery] || masteryColors.unknown;
                ctx.lineWidth = 2 / globalScale; // 增加边框宽度，使优先级更明显
                ctx.rect(
                  x - boxWidth / 2,
                  y - boxHeight / 2,
                  boxWidth,
                  boxHeight
                );
                ctx.fill();
                ctx.stroke();

                // 文本：标题 + 概括
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = palette.nodeText;
                ctx.font = `${fontSize}px sans-serif`;

                lines.forEach((text, index) => {
                  const lineY =
                    y - (lineHeight * (lines.length - 1)) / 2 + index * lineHeight;
                  ctx.fillText(text, x, lineY);
                });
              }}
              nodePointerAreaPaint={(node, color, ctx) => {
                const x = node.x || 0;
                const y = node.y || 0;
                const boxWidth = node.__boxWidth || 60;
                const boxHeight = node.__boxHeight || 24;

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.rect(
                  x - boxWidth / 2,
                  y - boxHeight / 2,
                  boxWidth,
                  boxHeight
                );
                ctx.fill();
              }}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default LearningMap;
