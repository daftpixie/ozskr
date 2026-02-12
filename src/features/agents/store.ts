/**
 * Agent Creation Wizard Store
 * Zustand store for multi-step wizard form state
 */

import { create } from 'zustand';
import type { VisualStyleParams } from '@/types/schemas';

interface WizardState {
  // Form fields
  name: string;
  persona: string;
  visualStyle: string;
  voiceTone: string;
  guardrails: string[];
  topicAffinity: string[];
  visualStyleParams: VisualStyleParams;

  // Wizard state
  currentStep: number;

  // Actions
  setField: <K extends keyof Omit<WizardState, 'currentStep' | 'setField' | 'nextStep' | 'prevStep' | 'reset'>>(
    field: K,
    value: WizardState[K]
  ) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

const initialState = {
  name: '',
  persona: '',
  visualStyle: '',
  voiceTone: '',
  guardrails: [],
  topicAffinity: [],
  visualStyleParams: {},
  currentStep: 1,
};

export const useWizardStore = create<WizardState>((set) => ({
  ...initialState,

  setField: (field, value) => {
    set({ [field]: value });
  },

  nextStep: () => {
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, 4),
    }));
  },

  prevStep: () => {
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 1),
    }));
  },

  reset: () => {
    set(initialState);
  },
}));
