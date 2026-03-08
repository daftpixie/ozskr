'use client';

/**
 * Yellow Brick Store
 * Zustand store for the Yellow Brick command bar state management.
 */

import { create } from 'zustand';

export type YellowBrickContext =
  | 'dashboard'
  | 'calendar'
  | 'content'
  | 'analytics'
  | 'social'
  | 'settings';

export interface YellowBrickState {
  isOpen: boolean;
  isFocused: boolean;
  isProcessing: boolean;
  isVoiceActive: boolean;
  currentContext: YellowBrickContext;
  attachedFiles: File[];
  processingStage: string | null;
  focus: () => void;
  blur: () => void;
  setContext: (ctx: YellowBrickContext) => void;
  attachFile: (file: File) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  setProcessing: (stage: string | null) => void;
  setVoiceActive: (active: boolean) => void;
}

export const useYellowBrickStore = create<YellowBrickState>((set) => ({
  isOpen: false,
  isFocused: false,
  isProcessing: false,
  isVoiceActive: false,
  currentContext: 'dashboard',
  attachedFiles: [],
  processingStage: null,

  focus: () => set({ isFocused: true, isOpen: true }),
  blur: () => set({ isFocused: false }),

  setContext: (ctx) => set({ currentContext: ctx }),

  attachFile: (file) =>
    set((state) => ({ attachedFiles: [...state.attachedFiles, file] })),

  removeFile: (index) =>
    set((state) => ({
      attachedFiles: state.attachedFiles.filter((_, i) => i !== index),
    })),

  clearFiles: () => set({ attachedFiles: [] }),

  setProcessing: (stage) =>
    set({ processingStage: stage, isProcessing: stage !== null }),

  setVoiceActive: (active) => set({ isVoiceActive: active }),
}));
