/**
 * Survey Store Tests
 * Tests for micro-survey state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSurveyStore, SURVEY_CONFIG, type SurveyTrigger } from './survey-store';

describe('useSurveyStore', () => {
  beforeEach(() => {
    // Reset store state
    useSurveyStore.setState({
      dismissed: [],
      activeSurvey: null,
    });
  });

  it('initializes with empty state', () => {
    const state = useSurveyStore.getState();
    expect(state.dismissed).toEqual([]);
    expect(state.activeSurvey).toBeNull();
  });

  it('shows a survey', () => {
    useSurveyStore.getState().showSurvey('first_generation');
    expect(useSurveyStore.getState().activeSurvey).toBe('first_generation');
  });

  it('does not show a dismissed survey', () => {
    useSurveyStore.getState().dismissSurvey('first_generation');
    useSurveyStore.getState().showSurvey('first_generation');
    expect(useSurveyStore.getState().activeSurvey).toBeNull();
  });

  it('dismisses a survey and adds to dismissed list', () => {
    useSurveyStore.getState().showSurvey('first_publish');
    useSurveyStore.getState().dismissSurvey('first_publish');

    const state = useSurveyStore.getState();
    expect(state.activeSurvey).toBeNull();
    expect(state.dismissed).toContain('first_publish');
  });

  it('completes a survey', () => {
    useSurveyStore.getState().showSurvey('third_agent');
    useSurveyStore.getState().completeSurvey('third_agent');

    const state = useSurveyStore.getState();
    expect(state.activeSurvey).toBeNull();
    expect(state.dismissed).toContain('third_agent');
  });

  it('isDismissed returns correct value', () => {
    expect(useSurveyStore.getState().isDismissed('first_generation')).toBe(false);
    useSurveyStore.getState().dismissSurvey('first_generation');
    expect(useSurveyStore.getState().isDismissed('first_generation')).toBe(true);
  });

  it('does not duplicate dismissed entries', () => {
    useSurveyStore.getState().dismissSurvey('first_generation');
    useSurveyStore.getState().dismissSurvey('first_generation');
    expect(useSurveyStore.getState().dismissed.filter(d => d === 'first_generation')).toHaveLength(1);
  });

  it('dismissing one survey does not affect another active survey', () => {
    useSurveyStore.getState().showSurvey('first_publish');
    useSurveyStore.getState().dismissSurvey('first_generation');

    expect(useSurveyStore.getState().activeSurvey).toBe('first_publish');
  });
});

describe('SURVEY_CONFIG', () => {
  const triggers: SurveyTrigger[] = [
    'first_generation',
    'first_publish',
    'third_agent',
    'first_schedule',
    'weekly_checkin',
  ];

  it('has config for all trigger types', () => {
    for (const trigger of triggers) {
      expect(SURVEY_CONFIG[trigger]).toBeDefined();
      expect(SURVEY_CONFIG[trigger].question).toBeTruthy();
      expect(SURVEY_CONFIG[trigger].options.length).toBeGreaterThanOrEqual(2);
    }
  });
});
