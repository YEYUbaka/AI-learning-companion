import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { useThemeStore } from '../store/themeStore';

const masteryColors = {
  strong: '#22c55e',
  medium: '#f97316',
  weak: '#ef4444',
  unknown: '#94a3b8',
};

function MindMapNode({ data }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const borderColor = masteryColors[data.mastery] || masteryColors.unknown;

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={`px-3 py-2 rounded-lg shadow-sm min-w-[140px] max-w-[180px] ${
          isDark ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'
        }`}
        style={{ borderLeft: `3px solid ${borderColor}` }}
      >
        <div className="font-medium text-xs leading-tight">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export default memo(MindMapNode);
