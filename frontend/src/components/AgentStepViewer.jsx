/**
 * Agent 推理步骤展示组件
 */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AgentStepViewer = ({ steps, toolCalls, isDark = false }) => {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  const toggleStep = (index) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  const renderStepIcon = (stepType) => {
    switch (stepType) {
      case 'thought':
        return (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDark ? 'bg-blue-900/40' : 'bg-blue-100'
          }`}>
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        );
      case 'action':
        return (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDark ? 'bg-green-900/40' : 'bg-green-100'
          }`}>
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        );
      case 'observation':
        return (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDark ? 'bg-purple-900/40' : 'bg-purple-100'
          }`}>
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        );
      case 'final_answer':
        return (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDark ? 'bg-amber-900/40' : 'bg-yellow-100'
          }`}>
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'goal':
        return (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDark ? 'bg-indigo-900/40' : 'bg-indigo-100'
          }`}>
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        );
      default:
        return (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDark ? 'bg-slate-700' : 'bg-gray-100'
          }`}>
            <svg className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const renderStepContent = (step, index) => {
    const isExpanded = expandedSteps.has(index);
    const isLongContent = step.content && step.content.length > 200;

    if (step.step_type === 'action') {
      try {
        const [toolName, ...rest] = step.content.split(':');
        const toolInput = rest.join(':').trim();
        let parsedInput = {};
        try {
          parsedInput = JSON.parse(toolInput);
        } catch {
          parsedInput = { raw: toolInput };
        }

        return (
          <div className={`border rounded-lg p-3 ${
            isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'
          }`}>
            <div className={`font-medium mb-2 text-sm ${isDark ? 'text-green-300' : 'text-green-800'}`}>
              调用工具: {toolName}
            </div>
            <div className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>
              <div className="font-medium mb-1">输入参数:</div>
              <div className={`rounded p-2 space-y-1 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                {Object.entries(parsedInput).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className={`font-mono text-xs mr-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      {key}:
                    </span>
                    <span className={`font-mono text-xs ${isDark ? 'text-slate-300' : 'text-gray-800'}`}>
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      } catch {
        return (
          <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            {step.content}
          </div>
        );
      }
    } else if (step.step_type === 'observation') {
      try {
        const result = JSON.parse(step.content);
        return (
          <div className={`border rounded-lg p-3 ${
            isDark ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-200'
          }`}>
            <div className={`font-medium mb-2 text-sm ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>
              执行结果
            </div>
            <div className={`text-sm ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
              {result.success ? (
                <div className={`flex items-center mb-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  执行成功
                </div>
              ) : (
                <div className={`flex items-center mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  执行失败
                </div>
              )}
              {result.error && (
                <div className={`border rounded p-2 text-xs ${
                  isDark ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {result.error}
                </div>
              )}
                      {result.text && (
                <div className={`rounded p-2 text-xs max-h-48 overflow-y-auto whitespace-pre-wrap ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-gray-700'
                }`}>
                  {result.text.substring(0, 400)}
                  {result.text.length > 400 && '...'}
                </div>
              )}
              {/* 知识库检索结果图片 */}
              {result.results && result.results.some(r => r.image_paths && r.image_paths.length > 0) && (
                <div className="mt-2 space-y-1">
                  <div className={`text-xs font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                    相关图片:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.results
                      .flatMap(r => r.image_paths || [])
                      .slice(0, 4)
                      .map((imgPath, i) => (
                        <a
                          key={i}
                          href={`http://localhost:8000/knowledge_images/${imgPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={`http://localhost:8000/knowledge_images/${imgPath}`}
                            alt={`知识库图片 ${i + 1}`}
                            className="h-20 w-auto rounded border object-cover"
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                          />
                        </a>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      } catch {
        return (
          <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            {step.content}
          </div>
        );
      }
    } else if (step.step_type === 'final_answer') {
      return (
        <div className={`border rounded-lg p-4 ${
          isDark ? 'bg-amber-900/20 border-amber-700' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className={`font-medium mb-2 text-sm ${isDark ? 'text-amber-300' : 'text-yellow-800'}`}>
            最终答案
          </div>
          <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert text-slate-200' : 'text-gray-800'}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer"
                    className={`underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`} />
                )
              }}
            >
              {step.content}
            </ReactMarkdown>
          </div>
        </div>
      );
    } else {
      const displayContent = isExpanded || !isLongContent
        ? step.content
        : step.content.substring(0, 200) + '...';

      return (
        <div>
          <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            {displayContent}
          </div>
          {isLongContent && (
            <button
              onClick={() => toggleStep(index)}
              className={`mt-2 text-xs underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
            >
              {isExpanded ? '收起' : '展开全部'}
            </button>
          )}
        </div>
      );
    }
  };

  const getStepLabel = (stepType) => {
    const labels = {
      thought: '思考',
      action: '行动',
      observation: '观察',
      final_answer: '完成',
      goal: '目标'
    };
    return labels[stepType] || stepType;
  };

  if (!steps || steps.length === 0) {
    return (
      <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
        暂无执行步骤
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="flex">
          {/* 时间线 */}
          <div className="flex flex-col items-center mr-4">
            {renderStepIcon(step.step_type)}
            {index < steps.length - 1 && (
              <div className={`w-0.5 h-full mt-2 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
            )}
          </div>

          {/* 步骤内容 */}
          <div className="flex-1 pb-6">
            <div className="flex items-center mb-2">
              <span className={`text-xs font-medium mr-2 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                步骤 {step.step_number}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'
              }`}>
                {getStepLabel(step.step_type)}
              </span>
              {step.created_at && (
                <span className={`text-xs ml-auto ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                  {new Date(step.created_at).toLocaleTimeString()}
                </span>
              )}
            </div>
            {renderStepContent(step, index)}
          </div>
        </div>
      ))}

      {/* 工具调用统计 */}
      {toolCalls && toolCalls.length > 0 && (
        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
            工具调用统计
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {toolCalls.map((call, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 ${
                  call.status === 'success'
                    ? isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'
                    : isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium text-sm ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    {call.tool_name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    call.status === 'success'
                      ? isDark ? 'bg-green-800 text-green-200' : 'bg-green-200 text-green-800'
                      : isDark ? 'bg-red-800 text-red-200' : 'bg-red-200 text-red-800'
                  }`}>
                    {call.status}
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  耗时: {call.execution_time_ms || 0}ms
                </p>
                {call.error_message && (
                  <p className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {call.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentStepViewer;
