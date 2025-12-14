/**
 * 智能组卷组件
 * 作者：智学伴开发团队
 * 目的：提供智能组卷配置界面
 */
import { useState, useMemo, useEffect } from 'react';
import { listTemplates, createTemplate, getRecommendedTemplate, deleteTemplate, generatePaper as requestGeneratePaper } from '../api/apiClient';
import { useThemeStore } from '../store/themeStore';

function PaperGenerator({ onPaperGenerated, onCancel }) {
  // 根据学段和总题数计算合理的默认题型分布
  const getDefaultDistribution = (gradeLevel, totalQuestions) => {
    // 确保所有题型字段都存在
    const allTypes = {
      choice: 0,
      multiple_choice: 0,
      fill: 0,
      judge: 0,
      essay: 0,
      calculation: 0,
      comprehensive: 0,
      composition: 0
    };
    
    if (gradeLevel === '小学') {
      // 小学：以选择题和填空题为主，少量判断题
      allTypes.choice = Math.max(1, Math.floor(totalQuestions * 0.6));
      allTypes.fill = Math.max(1, Math.floor(totalQuestions * 0.25));
      allTypes.judge = Math.max(0, totalQuestions - allTypes.choice - allTypes.fill);
    } else if (gradeLevel === '初中') {
      // 初中：选择题、填空题、简答题
      allTypes.choice = Math.max(1, Math.floor(totalQuestions * 0.45));
      allTypes.fill = Math.max(1, Math.floor(totalQuestions * 0.25));
      allTypes.essay = Math.max(0, totalQuestions - allTypes.choice - allTypes.fill);
    } else if (gradeLevel === '高中') {
      // 高中：选择题、多选题、填空题、简答题
      allTypes.choice = Math.max(1, Math.floor(totalQuestions * 0.4));
      allTypes.multiple_choice = Math.max(0, Math.floor(totalQuestions * 0.15));
      allTypes.fill = Math.max(1, Math.floor(totalQuestions * 0.2));
      allTypes.essay = Math.max(0, totalQuestions - allTypes.choice - allTypes.multiple_choice - allTypes.fill);
    } else {
      // 大学：选择题、填空题、计算题、简答题
      allTypes.choice = Math.max(1, Math.floor(totalQuestions * 0.4));
      allTypes.fill = Math.max(1, Math.floor(totalQuestions * 0.2));
      allTypes.calculation = Math.max(0, Math.floor(totalQuestions * 0.25));
      allTypes.essay = Math.max(0, totalQuestions - allTypes.choice - allTypes.fill - allTypes.calculation);
    }
    
    return allTypes;
  };
  
  const [config, setConfig] = useState({
    title: '',
    subject: '',
    grade_level: '高中',
    total_questions: 20,
    difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
    question_type_distribution: {
      ...getDefaultDistribution('高中', 20),
      composition: 0 // 添加作文题型，默认为0
    },
    knowledge_points: [],
    time_limit: 90,
    total_score: 100,
    use_template: false
  });
  
  // 题型选项
  const questionTypes = [
    { key: 'choice', label: '单选题' },
    { key: 'multiple_choice', label: '多选题' },
    { key: 'fill', label: '填空题' },
    { key: 'judge', label: '判断题' },
    { key: 'essay', label: '简答题' },
    { key: 'calculation', label: '计算题' },
    { key: 'comprehensive', label: '综合题' },
    { key: 'composition', label: '作文题' }
  ];
  
  // 用户保存的模板列表
  const [userTemplates, setUserTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [knowledgePointInput, setKnowledgePointInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  // 获取用户模板列表
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
        const userId = userInfo.id;
        if (userId) {
          const response = await listTemplates(userId);
          if (response.data.success) {
            setUserTemplates(response.data.templates || []);
          }
        }
      } catch (err) {
        console.error('获取模板列表失败:', err);
      }
    };
    fetchTemplates();
    
    // 首次加载时获取AI推荐（可选，不阻塞UI）
    const fetchAIRecommendation = async () => {
      try {
        const response = await getRecommendedTemplate(
          '高中', // 初始学段
          null, // subject
          null, // total_questions - 让AI推荐
          null, // provider
          null, // time_limit - 让AI推荐
          null // title
        );
        
        if (response.data.success && response.data.recommendation) {
          const recommendation = response.data.recommendation;
          console.log('首次加载推荐数据:', recommendation);
          console.log('题型分布:', recommendation.question_type_distribution);
          
          setConfig(prev => {
            // 优先使用推荐中的题型分布，如果不存在或为空，才使用旧的
            const questionTypeDist = recommendation.question_type_distribution && Object.keys(recommendation.question_type_distribution).length > 0
              ? recommendation.question_type_distribution
              : prev.question_type_distribution;
            
            // 确保所有题型字段都存在
            const allTypes = ['choice', 'multiple_choice', 'fill', 'judge', 'essay', 'calculation', 'comprehensive', 'composition'];
            const completeQuestionTypeDist = {};
            allTypes.forEach(type => {
              completeQuestionTypeDist[type] = questionTypeDist[type] || 0;
            });
            
            console.log('处理后的题型分布:', completeQuestionTypeDist);
            
            return {
              ...prev,
              total_questions: recommendation.total_questions || prev.total_questions, // AI推荐的总题数
              question_type_distribution: completeQuestionTypeDist,
              difficulty_distribution: recommendation.difficulty_distribution || prev.difficulty_distribution,
              time_limit: recommendation.time_limit || prev.time_limit, // AI推荐的考试时长
              total_score: recommendation.total_score || prev.total_score
            };
          });
        }
      } catch (err) {
        // 静默失败，不影响使用
        console.warn('首次加载AI推荐失败，使用默认值:', err);
      }
    };
    
    // 延迟获取，不阻塞初始渲染
    setTimeout(fetchAIRecommendation, 500);
  }, []); // 只在组件挂载时执行一次
  
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  
  const palette = useMemo(
    () =>
      isDark
        ? {
            card: 'bg-[#101529] border border-white/10 rounded-2xl',
            input: 'w-full px-4 py-2 rounded-xl bg-[#0f172a] border border-white/10 focus:ring-2 focus:ring-cyan-400 text-white',
            button: 'px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:shadow-lg transition',
            buttonSecondary: 'px-6 py-2 rounded-xl bg-gray-700 text-white hover:bg-gray-600 transition',
            label: 'text-white/80 text-sm font-medium',
            textMuted: 'text-white/60 text-xs'
          }
        : {
            card: 'bg-white border border-gray-200 rounded-xl shadow-sm',
            input: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500',
            button: 'px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transition',
            buttonSecondary: 'px-6 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition',
            label: 'text-gray-700 text-sm font-medium',
            textMuted: 'text-gray-500 text-xs'
          },
    [isDark]
  );
  
  const handleGenerate = async () => {
    if (!config.title.trim()) {
      setError('请输入试卷标题');
      return;
    }
    
    // 验证题型分布总和
    const totalDistributed = Object.values(config.question_type_distribution).reduce((sum, count) => sum + count, 0);
    if (totalDistributed !== config.total_questions) {
      setError(`题型分布总和（${totalDistributed}）必须等于总题数（${config.total_questions}）`);
      return;
    }
    
    setLoading(true);
    setError('');
    setStatusMessage('AI 正在生成试卷，题量较大时通常需要 30 秒到 2-3 分钟，请勿关闭或离开此页面...');
    
    try {
      const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
      const userId = userInfo.id;
      
      if (!userId) {
        setError('请先登录');
        return;
      }
      
      const response = await requestGeneratePaper({
        ...config,
        user_id: userId
      });
      
      if (response.data.success) {
        onPaperGenerated(response.data);
        setError('');
        setStatusMessage('试卷生成完成，可在下方预览或导出。');
        setTimeout(() => setStatusMessage(''), 5000);
      } else {
        setError(response.data.message || '生成试卷失败');
        setStatusMessage('');
      }
    } catch (err) {
      console.error('生成试卷失败:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.message || '生成试卷失败';
      setError(errorMsg);
      
      // 如果是超时错误，给出更友好的提示
      if (errorMsg.includes('timeout') || errorMsg.includes('超时') || errorMsg.includes('timed out')) {
        setError('生成试卷超时，题目数量较多时可能需要更长时间。请稍后重试或减少题目数量。');
      }
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template.id);
    setConfig({
      ...config,
      title: template.paper_title || config.title,
      subject: template.subject || config.subject,
      grade_level: template.grade_level || config.grade_level,
      total_questions: template.total_questions || config.total_questions,
      question_type_distribution: template.question_type_distribution || config.question_type_distribution,
      difficulty_distribution: template.difficulty_distribution || config.difficulty_distribution,
      knowledge_points: template.knowledge_points || config.knowledge_points,
      time_limit: template.time_limit || config.time_limit,
      total_score: template.total_score || config.total_score,
      use_template: true
    });
    setError('');
  };
  
  const handleDeleteTemplate = async (templateId) => {
    try {
      setDeletingTemplateId(templateId);
      setError('');
      
      const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
      const userId = userInfo.id;

      if (!userId) {
        setError('请先登录');
        return;
      }

      const response = await deleteTemplate(templateId, userId);

      if (response.data.success) {
        // 从列表中移除
        setUserTemplates(prev => prev.filter(t => t.id !== templateId));
        
        // 如果删除的是当前选中的模板，清除选中状态
        if (selectedTemplate === templateId) {
          setSelectedTemplate(null);
        }
        
        setError('');
      } else {
        setError(response.data.message || '删除模板失败');
      }
    } catch (err) {
      console.error('删除模板失败:', err);
      const errorDetail = err.response?.data?.detail;
      let errorMsg = '删除模板失败';
      
      if (errorDetail) {
        if (Array.isArray(errorDetail)) {
          errorMsg = errorDetail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join('; ');
        } else if (typeof errorDetail === 'string') {
          errorMsg = errorDetail;
        } else if (typeof errorDetail === 'object') {
          errorMsg = JSON.stringify(errorDetail);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('请输入模板名称');
      return;
    }
    
    setSavingTemplate(true);
    setError('');
    
    try {
      const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
      const userId = userInfo.id;
      
      if (!userId) {
        setError('请先登录');
        return;
      }
      
      const response = await createTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        subject: config.subject || undefined,
        grade_level: config.grade_level || undefined,
        total_questions: config.total_questions,
        difficulty_distribution: config.difficulty_distribution || undefined,
        question_type_distribution: config.question_type_distribution || undefined,
        knowledge_points: config.knowledge_points && config.knowledge_points.length > 0 ? config.knowledge_points : undefined,
        time_limit: config.time_limit || undefined,
        total_score: config.total_score,
        paper_title: config.title || undefined,
        user_id: userId
      });
      
      if (response.data.success) {
        // 刷新模板列表
        const templatesResponse = await listTemplates(userId);
        if (templatesResponse.data.success) {
          setUserTemplates(templatesResponse.data.templates || []);
        }
        setShowSaveTemplateModal(false);
        setTemplateName('');
        setTemplateDescription('');
        setError('');
        alert('模板保存成功！');
      } else {
        setError(response.data.message || '保存模板失败');
      }
    } catch (err) {
      console.error('保存模板失败:', err);
      const errorDetail = err.response?.data?.detail;
      let errorMsg = '保存模板失败';
      
      if (errorDetail) {
        // 处理FastAPI验证错误
        if (Array.isArray(errorDetail)) {
          errorMsg = errorDetail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join('; ');
        } else if (typeof errorDetail === 'string') {
          errorMsg = errorDetail;
        } else if (typeof errorDetail === 'object') {
          errorMsg = JSON.stringify(errorDetail);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    } finally {
      setSavingTemplate(false);
    }
  };
  
  const handleTotalQuestionsChange = (value) => {
    const newTotal = parseInt(value) || config.total_questions;
    const oldTotal = config.total_questions;
    
    if (oldTotal === 0 || newTotal === 0) {
      // 如果总题数为0，使用默认分布
      const defaultDist = getDefaultDistribution(config.grade_level, newTotal);
      setConfig({ 
        ...config, 
        total_questions: newTotal,
        question_type_distribution: defaultDist
      });
      return;
    }
    
    // 按比例调整题型分布，但保持合理的比例
    const ratio = newTotal / oldTotal;
    const newDistribution = {};
    let newSum = 0;
    
    for (const [type, count] of Object.entries(config.question_type_distribution)) {
      const newCount = Math.max(0, Math.round(count * ratio));
      newDistribution[type] = newCount;
      newSum += newCount;
    }
    
    // 如果总和不对，调整最大的题型
    if (newSum !== newTotal) {
      const diff = newTotal - newSum;
      const maxType = Object.entries(newDistribution).reduce((a, b) => 
        (newDistribution[a[0]] || 0) > (newDistribution[b[0]] || 0) ? a : b
      )[0];
      newDistribution[maxType] = (newDistribution[maxType] || 0) + diff;
    }
    
    setConfig({
      ...config,
      total_questions: newTotal,
      question_type_distribution: newDistribution
    });
  };
  
  // 当学段改变时，重新计算题型分布
  const handleGradeLevelChange = async (newGradeLevel) => {
    // 先使用默认分布
    const newDistribution = getDefaultDistribution(newGradeLevel, config.total_questions);
    setConfig({
      ...config,
      grade_level: newGradeLevel,
      question_type_distribution: newDistribution
    });
    
    // 异步获取AI推荐（不阻塞UI）
    try {
      const response = await getRecommendedTemplate(
        newGradeLevel,
        config.subject || null,
        config.total_questions || null, // 如果未设置，让AI推荐
        null,
        config.time_limit || null, // 如果未设置，让AI推荐
        config.title || null // 传递试卷标题
      );
      
      console.log('学段改变时AI推荐响应:', response);
      
      if (response?.data?.success && response?.data?.recommendation) {
        const recommendation = response.data.recommendation;
        console.log('学段改变时推荐数据:', recommendation);
        console.log('题型分布:', recommendation.question_type_distribution);
        
        // 优先使用推荐中的题型分布，如果不存在或为空，才使用新的分布
        const questionTypeDist = recommendation.question_type_distribution && Object.keys(recommendation.question_type_distribution).length > 0
          ? recommendation.question_type_distribution
          : newDistribution;
        
        // 确保所有题型字段都存在
        const allTypes = ['choice', 'multiple_choice', 'fill', 'judge', 'essay', 'calculation', 'comprehensive', 'composition'];
        const completeQuestionTypeDist = {};
        allTypes.forEach(type => {
          completeQuestionTypeDist[type] = questionTypeDist[type] || 0;
        });
        
        console.log('处理后的题型分布:', completeQuestionTypeDist);
        
        setConfig(prev => ({
          ...prev,
          grade_level: newGradeLevel,
          total_questions: recommendation.total_questions || prev.total_questions, // AI推荐的总题数
          question_type_distribution: completeQuestionTypeDist,
          difficulty_distribution: recommendation.difficulty_distribution || prev.difficulty_distribution,
          time_limit: recommendation.time_limit || prev.time_limit, // AI推荐的考试时长
          total_score: recommendation.total_score || prev.total_score
        }));
        // 可选：显示推荐理由
        if (recommendation.reasoning) {
          console.log('AI推荐理由:', recommendation.reasoning);
        }
      } else {
        console.warn('学段改变时AI推荐响应格式异常:', {
          success: response?.data?.success,
          hasRecommendation: !!response?.data?.recommendation,
          fullResponse: response?.data
        });
      }
    } catch (err) {
      // AI推荐失败不影响使用，静默失败
      console.warn('获取AI推荐失败，使用默认分布:', err);
      console.warn('错误详情:', err.response?.data || err.message);
    }
  };
  
  const addKnowledgePoint = () => {
    if (knowledgePointInput.trim()) {
      setConfig({
        ...config,
        knowledge_points: [...config.knowledge_points, knowledgePointInput.trim()]
      });
      setKnowledgePointInput('');
    }
  };
  
  const removeKnowledgePoint = (index) => {
    setConfig({
      ...config,
      knowledge_points: config.knowledge_points.filter((_, i) => i !== index)
    });
  };
  
  return (
    <div className={`${palette.card} p-6 space-y-4`}>
      <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        智能组卷配置
      </h3>
      <p className={`text-xs mb-3 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
        ⚠️ 生成过程中请保持页面开启，题量大时可能需要几十秒到几分钟。
      </p>
      
      {statusMessage && (
        <div
          className={`p-3 rounded-lg mb-4 border ${
            isDark
              ? 'bg-blue-500/10 border-blue-500/40 text-blue-100'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}
      
      {error && (
        <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-red-500/10 border border-red-500/40 text-red-100' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError('')}
              className={`ml-2 text-xs px-2 py-1 rounded ${isDark ? 'text-red-300 hover:text-red-100 hover:bg-red-500/20' : 'text-red-600 hover:text-red-800 hover:bg-red-100'}`}
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* 用户模板选择区域 */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className={`block text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
            使用已保存的模板
          </label>
          <button
            onClick={() => setShowSaveTemplateModal(true)}
            className={`text-xs px-3 py-1 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            + 保存当前配置为模板
          </button>
        </div>
        {userTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {userTemplates.map((template) => (
              <div
                key={template.id}
                className={`relative p-3 rounded-xl border-2 transition-all ${
                  selectedTemplate === template.id
                    ? isDark
                      ? 'bg-blue-500/20 border-blue-500'
                      : 'bg-blue-50 border-blue-500'
                    : isDark
                    ? 'bg-[#0f172a] border-white/10'
                    : 'bg-white border-gray-200'
                }`}
              >
                <button
                  onClick={() => handleSelectTemplate(template)}
                  disabled={loading}
                  className={`w-full text-left ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`text-sm font-semibold ${selectedTemplate === template.id ? (isDark ? 'text-blue-300' : 'text-blue-700') : (isDark ? 'text-white/80' : 'text-gray-700')}`}>
                    {template.name}
                  </div>
                  {template.paper_title && (
                    <div className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                      试卷标题：{template.paper_title}
                    </div>
                  )}
                  {template.description && (
                    <div className={`text-xs mt-1 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                      {template.description}
                    </div>
                  )}
                  <div className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                    {template.subject && `${template.subject} · `}
                    {template.grade_level && `${template.grade_level} · `}
                    {template.total_questions}题 · 使用{template.usage_count || 0}次
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`确定要删除模板"${template.name}"吗？此操作不可恢复。`)) {
                      handleDeleteTemplate(template.id);
                    }
                  }}
                  disabled={loading || deletingTemplateId === template.id}
                  className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
                    isDark
                      ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300'
                      : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  } ${loading || deletingTemplateId === template.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title="删除模板"
                >
                  {deletingTemplateId === template.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-[#0f172a] border-white/10 text-white/60' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <p className="text-sm">暂无保存的模板，您可以配置后保存为模板以便下次使用</p>
          </div>
        )}
        {selectedTemplate && (
          <p className={`text-xs mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
            ✓ 已应用模板，您可以在下方自定义调整
          </p>
        )}
      </div>
      
      {/* 保存模板模态框 */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${palette.card} p-6 rounded-2xl max-w-md w-full mx-4`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              保存为模板
            </h3>
            <div className="space-y-4">
              <div>
                <label className={palette.label}>模板名称 *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="例如：高中数学期中测试模板"
                  className={palette.input}
                />
              </div>
              <div>
                <label className={palette.label}>模板描述（可选）</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="描述这个模板的用途和特点"
                  rows={3}
                  className={palette.input}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowSaveTemplateModal(false);
                    setTemplateName('');
                    setTemplateDescription('');
                    setError('');
                  }}
                  className={palette.buttonSecondary}
                  disabled={savingTemplate}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className={palette.button}
                  disabled={savingTemplate}
                >
                  {savingTemplate ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        {/* 基本信息 */}
        <div>
          <label className={palette.label}>试卷标题 *</label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            placeholder="例如：高中数学期中测试卷"
            className={palette.input}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={palette.label}>科目</label>
            <input
              type="text"
              value={config.subject}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              placeholder="例如：数学"
              className={palette.input}
            />
          </div>
          
          <div>
            <label className={palette.label}>学段</label>
            <select
              value={config.grade_level}
              onChange={(e) => handleGradeLevelChange(e.target.value)}
              className={palette.input}
            >
              <option>小学</option>
              <option>初中</option>
              <option>高中</option>
              <option>大学</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={palette.label}>总题数（可自定义调整）</label>
            <input
              type="number"
              value={config.total_questions}
              onChange={(e) => handleTotalQuestionsChange(e.target.value)}
              min="5"
              max="100"
              className={palette.input}
            />
            <p className={`text-xs mt-1 ${palette.textMuted}`}>
              调整题量后，题型分布会自动按比例调整
            </p>
          </div>
          
          <div>
            <label className={palette.label}>考试时长（分钟）</label>
            <input
              type="number"
              value={config.time_limit}
              onChange={(e) => setConfig({ ...config, time_limit: parseInt(e.target.value) || 90 })}
              min="30"
              max="300"
              className={palette.input}
            />
          </div>
        </div>
        
        {/* 难度分布 */}
        <div>
          <label className={palette.label}>难度分布</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div>
              <label className={palette.textMuted}>简单题</label>
              <div className="relative">
                <input
                  type="number"
                  value={config.difficulty_distribution.easy}
                  onChange={(e) => setConfig({
                    ...config,
                    difficulty_distribution: {
                      ...config.difficulty_distribution,
                      easy: parseInt(e.target.value) || 0
                    }
                  })}
                  min="0"
                  max="100"
                  className={palette.input}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">%</span>
              </div>
            </div>
            <div>
              <label className={palette.textMuted}>中等题</label>
              <div className="relative">
                <input
                  type="number"
                  value={config.difficulty_distribution.medium}
                  onChange={(e) => setConfig({
                    ...config,
                    difficulty_distribution: {
                      ...config.difficulty_distribution,
                      medium: parseInt(e.target.value) || 0
                    }
                  })}
                  min="0"
                  max="100"
                  className={palette.input}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">%</span>
              </div>
            </div>
            <div>
              <label className={palette.textMuted}>困难题</label>
              <div className="relative">
                <input
                  type="number"
                  value={config.difficulty_distribution.hard}
                  onChange={(e) => setConfig({
                    ...config,
                    difficulty_distribution: {
                      ...config.difficulty_distribution,
                      hard: parseInt(e.target.value) || 0
                    }
                  })}
                  min="0"
                  max="100"
                  className={palette.input}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 题型分布 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={palette.label}>
              题型分布（可自定义调整，总和需等于总题数）
            </label>
            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  setError('');
                  const response = await getRecommendedTemplate(
                    config.grade_level,
                    config.subject || null,
                    config.total_questions || null, // 如果未设置，让AI推荐
                    null,
                    config.time_limit || null, // 如果未设置，让AI推荐
                    config.title || null // 传递试卷标题
                  );
                  
                  console.log('AI推荐响应:', response);
                  console.log('响应数据:', response?.data);
                  
                  if (response?.data?.success && response?.data?.recommendation) {
                    const recommendation = response.data.recommendation;
                    console.log('推荐数据:', recommendation);
                    console.log('题型分布:', recommendation.question_type_distribution);
                    
                    // 确保所有题型字段都存在
                    const questionTypeDist = recommendation.question_type_distribution || {};
                    const allTypes = ['choice', 'multiple_choice', 'fill', 'judge', 'essay', 'calculation', 'comprehensive', 'composition'];
                    const completeQuestionTypeDist = {};
                    allTypes.forEach(type => {
                      completeQuestionTypeDist[type] = questionTypeDist[type] || 0;
                    });
                    
                    setConfig({
                      ...config,
                      total_questions: recommendation.total_questions || config.total_questions, // AI推荐的总题数
                      question_type_distribution: completeQuestionTypeDist,
                      difficulty_distribution: recommendation.difficulty_distribution || config.difficulty_distribution,
                      time_limit: recommendation.time_limit || config.time_limit, // AI推荐的考试时长
                      total_score: recommendation.total_score || config.total_score
                    });
                    setError('');
                    // 显示推荐理由
                    if (recommendation.reasoning) {
                      alert(`AI推荐理由：${recommendation.reasoning}`);
                    }
                  } else {
                    console.warn('AI推荐响应格式异常:', {
                      success: response?.data?.success,
                      hasRecommendation: !!response?.data?.recommendation,
                      fullResponse: response?.data
                    });
                    // 如果AI推荐失败，使用默认分布
                    const newDistribution = getDefaultDistribution(config.grade_level, config.total_questions);
                    setConfig({
                      ...config,
                      question_type_distribution: newDistribution
                    });
                    setError('AI推荐响应格式异常，已使用默认分布');
                  }
                } catch (err) {
                  console.error('获取AI推荐失败:', err);
                  console.error('错误详情:', err.response?.data || err.message);
                  // 使用默认分布
                  const newDistribution = getDefaultDistribution(config.grade_level, config.total_questions);
                  setConfig({
                    ...config,
                    question_type_distribution: newDistribution
                  });
                  setError('AI推荐暂时不可用，已使用默认分布');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className={`text-xs px-3 py-1 rounded-lg ${isDark ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-50 text-green-700 hover:bg-green-100'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'AI搜索中...' : 'AI智能推荐'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {questionTypes.map((type) => {
              const count = config.question_type_distribution[type.key] || 0;
              const percentage = config.total_questions > 0 ? Math.round((count / config.total_questions) * 100) : 0;
              return (
                <div key={type.key} className={`p-3 rounded-lg border-2 ${
                  isDark 
                    ? 'bg-[#0f172a] border-white/10' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <label className={`${palette.textMuted} text-xs block mb-1`}>{type.label}</label>
                  <input
                    type="number"
                    value={count}
                    onChange={(e) => {
                      const newValue = Math.max(0, Math.min(config.total_questions, parseInt(e.target.value) || 0));
                      setConfig({
                        ...config,
                        question_type_distribution: {
                          ...config.question_type_distribution,
                          [type.key]: newValue
                        }
                      });
                    }}
                    min="0"
                    max={config.total_questions}
                    className={`${palette.input} text-center font-semibold`}
                  />
                  <p className={`text-xs mt-1 ${palette.textMuted}`}>
                    {percentage}%
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className={`text-xs ${palette.textMuted}`}>
              当前分布总和：{Object.values(config.question_type_distribution).reduce((sum, count) => sum + count, 0)} / {config.total_questions}
              {Object.values(config.question_type_distribution).reduce((sum, count) => sum + count, 0) !== config.total_questions && (
                <span className={`ml-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  （不匹配，请调整）
                </span>
              )}
            </p>
            <button
              onClick={() => {
                const currentSum = Object.values(config.question_type_distribution).reduce((sum, count) => sum + count, 0);
                if (currentSum !== config.total_questions) {
                  const diff = config.total_questions - currentSum;
                  const newDistribution = { ...config.question_type_distribution };
                  
                  // 找到最大的题型，调整它
                  const maxType = Object.entries(newDistribution).reduce((a, b) => 
                    (newDistribution[a[0]] || 0) > (newDistribution[b[0]] || 0) ? a : b
                  )[0];
                  
                  newDistribution[maxType] = (newDistribution[maxType] || 0) + diff;
                  
                  setConfig({
                    ...config,
                    question_type_distribution: newDistribution
                  });
                }
              }}
              className={`text-xs px-3 py-1 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
            >
              自动平衡
            </button>
          </div>
        </div>
        
        {/* 知识点 */}
        <div>
          <label className={palette.label}>知识点覆盖</label>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={knowledgePointInput}
              onChange={(e) => setKnowledgePointInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addKnowledgePoint()}
              placeholder="输入知识点后按回车添加"
              className={palette.input}
            />
            <button
              onClick={addKnowledgePoint}
              className={palette.buttonSecondary}
            >
              添加
            </button>
          </div>
          {config.knowledge_points.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {config.knowledge_points.map((kp, index) => (
                <span
                  key={index}
                  className={`px-3 py-1 rounded-full text-sm ${
                    isDark
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {kp}
                  <button
                    onClick={() => removeKnowledgePoint(index)}
                    className="ml-2 hover:opacity-70"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleGenerate}
          disabled={loading || !config.title.trim()}
          className={palette.button}
        >
          {loading ? '生成中...' : '生成试卷'}
        </button>
        <button
          onClick={onCancel}
          className={palette.buttonSecondary}
        >
          取消
        </button>
      </div>
    </div>
  );
}

export default PaperGenerator;

