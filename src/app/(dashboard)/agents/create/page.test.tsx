// @vitest-environment jsdom

/**
 * Agent Creation Page Tests
 * Tests multi-step wizard flow for agent creation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateAgentPage from './page';
import { useWizardStore } from '@/features/agents/store';

// Mock next/navigation
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// Mock auth store
const mockAuthStore = {
  token: 'mock-jwt-token',
  walletAddress: 'So11111111111111111111111111111111111111112',
  isAuthenticated: true,
};

vi.mock('@/features/wallet/store', () => ({
  useAuthStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockAuthStore);
    }
    return mockAuthStore;
  }),
}));

// Mock useCreateCharacter hook
const mockMutate = vi.fn();
const mockReset = vi.fn();

const mockMutationState = {
  isPending: false,
  isError: false,
  error: null as Error | null,
};

vi.mock('@/hooks/use-characters', () => ({
  useCreateCharacter: () => ({
    mutate: mockMutate,
    isPending: mockMutationState.isPending,
    isError: mockMutationState.isError,
    error: mockMutationState.error,
    reset: mockReset,
  }),
}));

// Mock UI components to avoid shadcn/ui dependencies
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...props }: { children: React.ReactNode }) => (
    <h2 data-testid="card-title" {...props}>
      {children}
    </h2>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
    type,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      type={type}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    maxLength,
    onKeyDown,
    ...props
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    maxLength?: number;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      onKeyDown={onKeyDown}
      data-testid={id || 'input'}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    maxLength,
    rows,
    ...props
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    maxLength?: number;
    rows?: number;
  }) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows}
      data-testid={id || 'textarea'}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor} data-testid="label">
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <span onClick={onClick} data-variant={variant} className={className} data-testid="badge">
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
  ArrowRight: () => <span data-testid="arrow-right-icon">→</span>,
  Check: () => <span data-testid="check-icon">✓</span>,
  X: () => <span data-testid="x-icon">×</span>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

describe('CreateAgentPage', () => {
  beforeEach(() => {
    // Reset wizard store FIRST before mocks
    useWizardStore.getState().reset();

    // Reset mutation state before each test
    mockMutationState.isPending = false;
    mockMutationState.isError = false;
    mockMutationState.error = null;
    mockMutate.mockClear();
    mockReset.mockClear();
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Identity', () => {
    it('renders step 1 by default', () => {
      render(<CreateAgentPage />);

      expect(screen.getByText('Create Agent')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Who Are They?')).toBeInTheDocument();
      expect(screen.getByTestId('name')).toBeInTheDocument();
      expect(screen.getByTestId('persona')).toBeInTheDocument();
    });

    it('shows character count for name field', async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      const nameInput = screen.getByTestId('name') as HTMLInputElement;
      await user.type(nameInput, 'TestAgent');

      expect(screen.getByText('9/100 characters')).toBeInTheDocument();
    });

    it('shows character count for persona field', async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      const personaInput = screen.getByTestId('persona') as HTMLTextAreaElement;
      await user.type(personaInput, 'A test persona description');

      expect(screen.getByText(/26\/2000 characters/)).toBeInTheDocument();
    });

    it('disables Next button when validation fails', () => {
      render(<CreateAgentPage />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('enables Next button when validation passes', async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      const nameInput = screen.getByTestId('name') as HTMLInputElement;
      const personaInput = screen.getByTestId('persona') as HTMLTextAreaElement;

      await user.type(nameInput, 'TestAgent');
      await user.type(personaInput, 'A test persona description that is longer than 10 characters');

      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
    });

    it('advances to step 2 when Next is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      const nameInput = screen.getByTestId('name') as HTMLInputElement;
      const personaInput = screen.getByTestId('persona') as HTMLTextAreaElement;

      await user.type(nameInput, 'TestAgent');
      await user.type(personaInput, 'A test persona description that is longer than 10 characters');

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Step 2: How Do They Look?')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Visual Style', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      // Fill step 1 and advance
      const nameInput = screen.getByTestId('name') as HTMLInputElement;
      const personaInput = screen.getByTestId('persona') as HTMLTextAreaElement;

      await user.type(nameInput, 'TestAgent');
      await user.type(personaInput, 'A test persona description that is longer than 10 characters');

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Step 2: How Do They Look?')).toBeInTheDocument();
      });
    });

    it('renders style presets', () => {
      expect(screen.getByText('Cyberpunk')).toBeInTheDocument();
      expect(screen.getByText('Anime')).toBeInTheDocument();
      expect(screen.getByText('Photorealistic')).toBeInTheDocument();
      expect(screen.getByText('Abstract')).toBeInTheDocument();
      expect(screen.getByText('Minimalist')).toBeInTheDocument();
    });

    it('renders aspect ratio options', () => {
      expect(screen.getByText('Square')).toBeInTheDocument();
      expect(screen.getByText('Landscape')).toBeInTheDocument();
      expect(screen.getByText('Portrait')).toBeInTheDocument();
      expect(screen.getByText('Classic')).toBeInTheDocument();
    });

    it('updates visual style when preset is clicked', async () => {
      const user = userEvent.setup();
      const cyberpunkButton = screen.getByText('Cyberpunk');

      await user.click(cyberpunkButton);

      const visualStyleInput = screen.getByTestId('visualStyle') as HTMLTextAreaElement;
      expect(visualStyleInput.value).toBe('Neon-lit futuristic aesthetic');
    });

    it('shows character count for visual style', () => {
      // Verify we're on step 2
      expect(screen.getByText('Step 2: How Do They Look?')).toBeInTheDocument();

      // Verify the character count is displayed (initially shows 0)
      expect(screen.getByText(/\/1000 characters \(min 10\)/)).toBeInTheDocument();

      // Verify the textarea is present and can receive input
      const visualStyleInput = screen.getByTestId('visualStyle') as HTMLTextAreaElement;
      expect(visualStyleInput).toBeInTheDocument();
      expect(visualStyleInput).toHaveAttribute('maxLength', '1000');
    });

    it('disables Next button when validation fails', () => {
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('goes back to step 1 when Back is clicked', async () => {
      const user = userEvent.setup();
      const backButton = screen.getByText('Back');

      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Step 1: Who Are They?')).toBeInTheDocument();
      });
    });

    it('advances to step 3 when validation passes', async () => {
      const user = userEvent.setup();
      const visualStyleInput = screen.getByTestId('visualStyle') as HTMLTextAreaElement;

      await user.type(visualStyleInput, 'A visual style description longer than 10 chars');

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Step 3: How Do They Speak?')).toBeInTheDocument();
      });
    });
  });

  describe('Step 3: Voice & Behavior', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      // Fill step 1
      const nameInput = screen.getByTestId('name') as HTMLInputElement;
      const personaInput = screen.getByTestId('persona') as HTMLTextAreaElement;
      await user.type(nameInput, 'TestAgent');
      await user.type(personaInput, 'A test persona description that is longer than 10 characters');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2: How Do They Look?')).toBeInTheDocument();
      });

      // Fill step 2
      const visualStyleInput = screen.getByTestId('visualStyle') as HTMLTextAreaElement;
      await user.type(visualStyleInput, 'A visual style description longer than 10 chars');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 3: How Do They Speak?')).toBeInTheDocument();
      });
    });

    it('renders voice tone input', () => {
      expect(screen.getByTestId('voiceTone')).toBeInTheDocument();
    });

    it('shows character count for voice tone', async () => {
      const user = userEvent.setup();
      const voiceToneInput = screen.getByTestId('voiceTone') as HTMLTextAreaElement;

      await user.type(voiceToneInput, 'Casual and friendly tone');

      expect(screen.getByText(/24\/1000 characters/)).toBeInTheDocument();
    });

    it('adds topic tag when Enter is pressed', async () => {
      const user = userEvent.setup();
      const topicInput = screen.getByTestId('topicAffinity') as HTMLInputElement;

      await user.type(topicInput, 'blockchain');
      fireEvent.keyDown(topicInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('blockchain')).toBeInTheDocument();
      });
    });

    it('adds topic tag when Add button is clicked', async () => {
      const user = userEvent.setup();
      const topicInput = screen.getByTestId('topicAffinity') as HTMLInputElement;
      const addButton = screen.getAllByText('Add')[0];

      await user.type(topicInput, 'crypto');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('crypto')).toBeInTheDocument();
      });
    });

    it('removes topic tag when clicked', async () => {
      const user = userEvent.setup();
      const topicInput = screen.getByTestId('topicAffinity') as HTMLInputElement;

      await user.type(topicInput, 'defi');
      fireEvent.keyDown(topicInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('defi')).toBeInTheDocument();
      });

      // Get all badges and find the one containing 'defi'
      const badges = screen.getAllByTestId('badge');
      const defiBadge = badges.find((badge) => badge.textContent?.includes('defi'));

      expect(defiBadge).toBeDefined();
      if (defiBadge) {
        await user.click(defiBadge);
      }

      await waitFor(() => {
        expect(screen.queryByText('defi')).not.toBeInTheDocument();
      });
    });

    it('adds guardrail when Enter is pressed', async () => {
      const user = userEvent.setup();
      const guardrailInput = screen.getByTestId('guardrails') as HTMLInputElement;

      await user.type(guardrailInput, 'No financial advice');
      fireEvent.keyDown(guardrailInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('No financial advice')).toBeInTheDocument();
      });
    });

    it('advances to step 4 when validation passes', async () => {
      const user = userEvent.setup();
      const voiceToneInput = screen.getByTestId('voiceTone') as HTMLTextAreaElement;

      await user.type(voiceToneInput, 'Professional and informative tone');

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Step 4: Ready to Bring Them to Life?')).toBeInTheDocument();
      });
    });
  });

  describe('Step 4: Review & Create', () => {
    const fillAllSteps = async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      // Step 1
      await user.type(screen.getByTestId('name'), 'TestAgent');
      await user.type(screen.getByTestId('persona'), 'A test persona description longer than 10');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2: How Do They Look?')).toBeInTheDocument();
      });

      // Step 2
      await user.type(screen.getByTestId('visualStyle'), 'A visual style description longer than 10');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 3: How Do They Speak?')).toBeInTheDocument();
      });

      // Step 3
      await user.type(screen.getByTestId('voiceTone'), 'Professional tone longer than 10 chars');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 4: Ready to Bring Them to Life?')).toBeInTheDocument();
      });
    };

    it('displays summary of all filled fields', async () => {
      await fillAllSteps();

      expect(screen.getByText(/Name:/)).toBeInTheDocument();
      expect(screen.getByText('TestAgent')).toBeInTheDocument();
      expect(screen.getByText(/Persona:/)).toBeInTheDocument();
      expect(screen.getByText(/Visual Style/)).toBeInTheDocument();
      expect(screen.getByText(/Voice & Behavior/)).toBeInTheDocument();
    });

    it('has Edit buttons to jump back to previous steps', async () => {
      await fillAllSteps();

      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBeGreaterThanOrEqual(3);
    });

    it('calls mutation with correct payload when submit is clicked', async () => {
      await fillAllSteps();

      const submitButton = screen.getByText('Bring Them to Life');
      const user = userEvent.setup();
      await user.click(submitButton);

      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith(
        {
          name: 'TestAgent',
          persona: 'A test persona description longer than 10',
          visualStyle: 'A visual style description longer than 10',
          voiceTone: 'Professional tone longer than 10 chars',
          guardrails: [],
          topicAffinity: [],
          visualStyleParams: {},
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
        })
      );
    });

    it('shows loading state when mutation is pending', async () => {
      mockMutationState.isPending = true;
      await fillAllSteps();

      expect(screen.getByText('The wizard is working...')).toBeInTheDocument();

      const submitButton = screen.getByText('The wizard is working...');
      expect(submitButton).toBeDisabled();
    });

    it('shows error message when mutation fails', async () => {
      mockMutationState.isError = true;
      mockMutationState.error = new Error('Failed to create character');

      await fillAllSteps();

      expect(screen.getByText('Failed to create agent')).toBeInTheDocument();
      expect(screen.getByText('Failed to create character')).toBeInTheDocument();
    });

    it('dismisses error when Dismiss button is clicked', async () => {
      mockMutationState.isError = true;
      mockMutationState.error = new Error('Test error');

      await fillAllSteps();

      const user = userEvent.setup();
      const dismissButton = screen.getByText('Dismiss');
      await user.click(dismissButton);

      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('redirects to agent detail page on success', async () => {
      await fillAllSteps();

      const submitButton = screen.getByText('Bring Them to Life');
      const user = userEvent.setup();
      await user.click(submitButton);

      // Get the onSuccess callback from the mutation call
      const mutationCall = mockMutate.mock.calls[0];
      const onSuccess = mutationCall[1].onSuccess;

      // Simulate successful response
      const mockCharacter = {
        id: 'test-character-123',
        name: 'TestAgent',
        walletAddress: 'So11111111111111111111111111111111111111112',
        persona: 'Test persona',
        visualStyle: 'Test style',
        voiceTone: 'Test tone',
        guardrails: [],
        topicAffinity: [],
        mem0Namespace: 'test-namespace',
        status: 'active' as const,
        visualStyleParams: {},
        socialAccounts: {},
        generationCount: 0,
        lastGeneratedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSuccess(mockCharacter);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/agents/test-character-123');
      });
    });

    it('resets wizard store on success', async () => {
      await fillAllSteps();

      const submitButton = screen.getByText('Bring Them to Life');
      const user = userEvent.setup();
      await user.click(submitButton);

      // Get the onSuccess callback and trigger it
      const mutationCall = mockMutate.mock.calls[0];
      const onSuccess = mutationCall[1].onSuccess;

      const mockCharacter = {
        id: 'test-character-123',
        name: 'TestAgent',
        walletAddress: 'So11111111111111111111111111111111111111112',
        persona: 'Test persona',
        visualStyle: 'Test style',
        voiceTone: 'Test tone',
        guardrails: [],
        topicAffinity: [],
        mem0Namespace: 'test-namespace',
        status: 'active' as const,
        visualStyleParams: {},
        socialAccounts: {},
        generationCount: 0,
        lastGeneratedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSuccess(mockCharacter);

      // Verify store was reset
      const state = useWizardStore.getState();

      await waitFor(() => {
        expect(state.currentStep).toBe(1);
        expect(state.name).toBe('');
        expect(state.persona).toBe('');
      });
    });
  });

  describe('Progress Indicator', () => {
    it('shows progress for current step', async () => {
      render(<CreateAgentPage />);

      // Step 1 - should have 1 active progress bar
      const progressBars = document.querySelectorAll('.h-2');
      expect(progressBars.length).toBe(4);

      // Advance to step 2
      const user = userEvent.setup();
      await user.type(screen.getByTestId('name'), 'TestAgent');
      await user.type(screen.getByTestId('persona'), 'A test persona longer than 10');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Step 2: How Do They Look?')).toBeInTheDocument();
      });

      // Progress indicators should update
      expect(progressBars.length).toBe(4);
    });
  });

  describe('Full Wizard Flow', () => {
    it('completes entire wizard flow and submits', async () => {
      const user = userEvent.setup();
      render(<CreateAgentPage />);

      // Step 1: Identity
      expect(screen.getByText('Step 1: Who Are They?')).toBeInTheDocument();
      await user.type(screen.getByTestId('name'), 'CryptoWiz');
      await user.type(
        screen.getByTestId('persona'),
        'A blockchain expert who explains complex crypto concepts in simple terms'
      );
      await user.click(screen.getByText('Next'));

      // Step 2: Visual Style
      await waitFor(() => {
        expect(screen.getByText('Step 2: How Do They Look?')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Cyberpunk'));
      await user.type(screen.getByTestId('visualStyle'), ' with purple accents');
      await user.click(screen.getByText('Square'));
      await user.click(screen.getByText('Next'));

      // Step 3: Voice & Behavior
      await waitFor(() => {
        expect(screen.getByText('Step 3: How Do They Speak?')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('voiceTone'), 'Professional yet approachable');

      // Add topics
      const topicInput = screen.getByTestId('topicAffinity');
      await user.type(topicInput, 'DeFi');
      fireEvent.keyDown(topicInput, { key: 'Enter' });
      await user.type(topicInput, 'NFTs');
      fireEvent.keyDown(topicInput, { key: 'Enter' });

      // Add guardrails
      const guardrailInput = screen.getByTestId('guardrails');
      await user.type(guardrailInput, 'No financial advice');
      fireEvent.keyDown(guardrailInput, { key: 'Enter' });

      await user.click(screen.getByText('Next'));

      // Step 4: Review & Submit
      await waitFor(() => {
        expect(screen.getByText('Step 4: Ready to Bring Them to Life?')).toBeInTheDocument();
      });
      expect(screen.getByText('CryptoWiz')).toBeInTheDocument();

      await user.click(screen.getByText('Bring Them to Life'));

      // Verify mutation was called with complete data
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CryptoWiz',
          persona: 'A blockchain expert who explains complex crypto concepts in simple terms',
          visualStyle: expect.stringContaining('purple accents'),
          voiceTone: 'Professional yet approachable',
          topicAffinity: expect.arrayContaining(['DeFi', 'NFTs']),
          guardrails: expect.arrayContaining(['No financial advice']),
          visualStyleParams: expect.objectContaining({
            style: 'cyberpunk',
            aspectRatio: '1:1',
          }),
        }),
        expect.any(Object)
      );
    });
  });
});
