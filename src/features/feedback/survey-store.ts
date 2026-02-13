/**
 * Micro-Survey Store
 * Tracks which survey trigger points have been shown/dismissed in this session.
 * Uses Zustand with localStorage persistence for cross-session tracking.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SurveyTrigger =
  | 'first_generation'
  | 'first_publish'
  | 'third_agent'
  | 'first_schedule'
  | 'weekly_checkin';

interface SurveyState {
  /** Trigger points that have been completed or dismissed */
  dismissed: SurveyTrigger[];
  /** Currently active survey trigger (null if none showing) */
  activeSurvey: SurveyTrigger | null;
  /** Show a survey for a trigger point (no-op if already dismissed) */
  showSurvey: (trigger: SurveyTrigger) => void;
  /** Mark a survey as dismissed (won't show again) */
  dismissSurvey: (trigger: SurveyTrigger) => void;
  /** Mark a survey as completed */
  completeSurvey: (trigger: SurveyTrigger) => void;
  /** Check if a trigger has been dismissed */
  isDismissed: (trigger: SurveyTrigger) => boolean;
}

export const useSurveyStore = create<SurveyState>()(
  persist(
    (set, get) => ({
      dismissed: [],
      activeSurvey: null,

      showSurvey: (trigger) => {
        if (get().dismissed.includes(trigger)) return;
        set({ activeSurvey: trigger });
      },

      dismissSurvey: (trigger) => {
        set((state) => ({
          dismissed: [...new Set([...state.dismissed, trigger])],
          activeSurvey: state.activeSurvey === trigger ? null : state.activeSurvey,
        }));
      },

      completeSurvey: (trigger) => {
        set((state) => ({
          dismissed: [...new Set([...state.dismissed, trigger])],
          activeSurvey: null,
        }));
      },

      isDismissed: (trigger) => {
        return get().dismissed.includes(trigger);
      },
    }),
    {
      name: 'ozskr-survey-state',
      partialize: (state) => ({ dismissed: state.dismissed }),
    }
  )
);

/** Survey configuration: trigger point → question + options */
export const SURVEY_CONFIG: Record<SurveyTrigger, {
  question: string;
  options: string[];
  allowFreeText: boolean;
}> = {
  first_generation: {
    question: 'How was your first creation?',
    options: ['Loved it', 'It was okay', 'Needs work', 'Confused'],
    allowFreeText: true,
  },
  first_publish: {
    question: 'How did publishing feel?',
    options: ['Seamless', 'A bit tricky', 'Had issues', 'Need help'],
    allowFreeText: true,
  },
  third_agent: {
    question: 'You\'re building a team! What would help most?',
    options: ['More personality options', 'Better content quality', 'Scheduling features', 'Analytics'],
    allowFreeText: true,
  },
  first_schedule: {
    question: 'How does automated scheduling feel?',
    options: ['Game changer', 'Useful', 'Need more control', 'Confusing'],
    allowFreeText: true,
  },
  weekly_checkin: {
    question: 'How has your week been on ozskr?',
    options: ['Productive', 'Good but could improve', 'Ran into issues', 'Not enough time'],
    allowFreeText: true,
  },
};
