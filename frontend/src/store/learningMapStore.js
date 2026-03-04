import { create } from 'zustand';

export const useLearningMapStore = create((set) => ({
  nodes: [],
  edges: [],
  loading: false,
  selectedNode: null,
  setGraph: (nodes, edges) => set({ nodes, edges }),
  setLoading: (loading) => set({ loading }),
  setSelectedNode: (node) => set({ selectedNode: node }),
}));

