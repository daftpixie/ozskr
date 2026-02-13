'use client';

/**
 * Onboarding Wizard Component
 * Main wizard that manages the onboarding flow
 */

import { useState } from 'react';
import { WelcomeStep } from './welcome-step';
import { AccessStep } from './access-step';
import { ProfileStep } from './profile-step';
import { FirstAgentStep } from './first-agent-step';

type OnboardingStep = 'welcome' | 'access' | 'profile' | 'firstAgent';

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');

  const goToNextStep = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('access');
    } else if (currentStep === 'access') {
      setCurrentStep('profile');
    } else if (currentStep === 'profile') {
      setCurrentStep('firstAgent');
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 'access') {
      setCurrentStep('welcome');
    } else if (currentStep === 'profile') {
      setCurrentStep('access');
    } else if (currentStep === 'firstAgent') {
      setCurrentStep('profile');
    }
  };

  // Progress indicator
  const steps: OnboardingStep[] = ['welcome', 'access', 'profile', 'firstAgent'];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-void-black py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Progress Indicator */}
        <div className="mb-8 flex justify-center gap-2">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`h-2 w-16 rounded-full transition-all ${
                index <= currentStepIndex
                  ? 'bg-gradient-to-r from-solana-purple to-solana-green'
                  : 'bg-mid-gray'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="transition-opacity">
          {currentStep === 'welcome' && <WelcomeStep onNext={goToNextStep} />}
          {currentStep === 'access' && (
            <AccessStep onNext={goToNextStep} onBack={goToPreviousStep} />
          )}
          {currentStep === 'profile' && (
            <ProfileStep onNext={goToNextStep} onBack={goToPreviousStep} />
          )}
          {currentStep === 'firstAgent' && <FirstAgentStep onBack={goToPreviousStep} />}
        </div>
      </div>
    </div>
  );
}
