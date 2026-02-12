/**
 * API Mock Helpers for E2E Tests
 * Centralized API mock setup using Playwright route interception
 */

import type { Page } from '@playwright/test';

/**
 * Setup all API mocks with realistic test data.
 * Intercepts all API routes and returns mock responses.
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // Health endpoint
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ozskr.ai API',
        version: '0.1.0',
      }),
    });
  });

  // Auth endpoints
  await page.route('**/api/auth/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'test-jwt-token-for-e2e',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        user: {
          walletAddress: 'TestWa11etAddress1111111111111111111111111',
          displayName: null,
          avatarUrl: null,
        },
      }),
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Successfully logged out',
      }),
    });
  });

  // Characters/AI endpoints
  await page.route('**/api/ai/characters?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'char-001',
            walletAddress: 'TestWa11etAddress1111111111111111111111111',
            name: 'CryptoWiz',
            persona: 'A crypto-savvy influencer with deep technical knowledge',
            visualStyle: 'cyberpunk',
            voiceTone: 'professional',
            guardrails: ['no-financial-advice', 'verify-facts'],
            topicAffinity: ['defi', 'nfts', 'web3'],
            mem0Namespace: 'char-001',
            status: 'active',
            visualStyleParams: { mood: 'energetic', color_palette: 'neon' },
            socialAccounts: ['twitter'],
            generationCount: 42,
            lastGeneratedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'char-002',
            walletAddress: 'TestWa11etAddress1111111111111111111111111',
            name: 'MemeLord',
            persona: 'A witty meme creator focused on crypto culture',
            visualStyle: 'dank',
            voiceTone: 'casual',
            guardrails: ['no-hate-speech'],
            topicAffinity: ['memes', 'nfts', 'community'],
            mem0Namespace: 'char-002',
            status: 'active',
            visualStyleParams: { style: 'comic', font: 'impact' },
            socialAccounts: ['twitter', 'instagram'],
            generationCount: 128,
            lastGeneratedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      }),
    });
  });

  await page.route('**/api/ai/characters/char-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'char-001',
        walletAddress: 'TestWa11etAddress1111111111111111111111111',
        name: 'CryptoWiz',
        persona: 'A crypto-savvy influencer with deep technical knowledge',
        visualStyle: 'cyberpunk',
        voiceTone: 'professional',
        guardrails: ['no-financial-advice', 'verify-facts'],
        topicAffinity: ['defi', 'nfts', 'web3'],
        mem0Namespace: 'char-001',
        status: 'active',
        visualStyleParams: { mood: 'energetic', color_palette: 'neon' },
        socialAccounts: ['twitter'],
        generationCount: 42,
        lastGeneratedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
  });

  await page.route('**/api/ai/characters', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'char-new-001',
          walletAddress: 'TestWa11etAddress1111111111111111111111111',
          name: 'NewAgent',
          persona: 'Test agent persona',
          visualStyle: 'minimal',
          voiceTone: 'friendly',
          guardrails: [],
          topicAffinity: ['general'],
          mem0Namespace: 'char-new-001',
          status: 'active',
          visualStyleParams: {},
          socialAccounts: [],
          generationCount: 0,
          lastGeneratedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    }
  });

  // Content generation (SSE streaming)
  await page.route('**/api/ai/generate', async (route) => {
    const sseData = [
      'data: {"stage":"loading_character","message":"Loading character DNA","progress":20}\n\n',
      'data: {"stage":"enhancing_prompt","message":"Enhancing prompt with context","progress":40}\n\n',
      'data: {"stage":"generating_content","message":"Generating content","progress":60}\n\n',
      'data: {"stage":"quality_check","message":"Checking quality","progress":80}\n\n',
      'data: {"stage":"complete","message":"Generation complete","progress":100,"result":{"id":"gen-001","outputText":"This is the generated content text","outputUrl":"https://fal.ai/mock/image.png","generationType":"image","modelUsed":"fal-ai/flux-pro"}}\n\n',
    ].join('');

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: sseData,
    });
  });

  // Trading endpoints
  await page.route('**/api/trading/quote*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inputAmount: '1000000000',
        outputAmount: '150000000',
        slippageBps: 50,
        priceImpactPct: 0.12,
        route: ['SOL', 'USDC'],
        estimatedFeeUsd: 0.05,
      }),
    });
  });

  await page.route('**/api/trading/swap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'swap-001',
        walletAddress: 'TestWa11etAddress1111111111111111111111111',
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inputAmount: '1000000000',
        outputAmount: '150000000',
        slippageBps: 50,
        priorityFeeLamports: '5000',
        jupiterOrderId: 'jup-order-123',
        transactionSignature: 'sig-123',
        status: 'pending',
        errorMessage: null,
        simulationResult: { err: null },
        createdAt: new Date().toISOString(),
        confirmedAt: null,
      }),
    });
  });

  await page.route('**/api/trading/portfolio', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balances: [
          {
            tokenMint: 'So11111111111111111111111111111111111111112',
            balance: '5000000000',
            decimals: 9,
            usdValue: 500.0,
          },
          {
            tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            balance: '1500000000',
            decimals: 6,
            usdValue: 1500.0,
          },
        ],
        totalUsdValue: 2000.0,
      }),
    });
  });

  // Schedules endpoints
  await page.route('**/api/ai/schedules?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'sched-001',
            characterId: 'char-001',
            cronExpression: '0 9 * * *',
            timezone: 'America/New_York',
            isActive: true,
            generationType: 'text',
            platforms: ['twitter'],
            lastRunAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            nextRunAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      }),
    });
  });

  await page.route('**/api/ai/schedules', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sched-new-001',
          characterId: 'char-001',
          cronExpression: '0 12 * * *',
          timezone: 'UTC',
          isActive: true,
          generationType: 'image',
          platforms: ['twitter'],
          lastRunAt: null,
          nextRunAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    }
  });

  // Social endpoints
  await page.route('**/api/social/accounts?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'social-001',
            walletAddress: 'TestWa11etAddress1111111111111111111111111',
            platform: 'twitter',
            platformAccountId: 'twitter-123',
            platformUsername: '@cryptowiz',
            isConnected: true,
            connectedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            lastPostedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      }),
    });
  });

  await page.route('**/api/social/posts?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'post-001',
            contentGenerationId: 'gen-001',
            socialAccountId: 'social-001',
            platform: 'twitter',
            postId: 'tweet-123',
            postUrl: 'https://twitter.com/cryptowiz/status/123',
            status: 'published',
            postedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            errorMessage: null,
            engagementMetrics: {
              likes: 42,
              retweets: 12,
              comments: 8,
            },
            lastMetricsUpdate: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'post-002',
            contentGenerationId: 'gen-002',
            socialAccountId: 'social-001',
            platform: 'twitter',
            postId: 'tweet-124',
            postUrl: 'https://twitter.com/cryptowiz/status/124',
            status: 'scheduled',
            postedAt: null,
            errorMessage: null,
            engagementMetrics: null,
            lastMetricsUpdate: null,
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      }),
    });
  });

  // Gamification endpoints
  await page.route('**/api/gamification/me/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        walletAddress: 'TestWa11etAddress1111111111111111111111111',
        totalPoints: 1250,
        currentStreakDays: 5,
        longestStreakDays: 12,
        lastActiveDate: new Date().toISOString().split('T')[0],
        totalAgentsCreated: 3,
        totalContentGenerated: 47,
        totalPostsPublished: 38,
        tier: 'creator',
        updatedAt: new Date().toISOString(),
        tierProgress: {
          currentTier: 'creator',
          nextTier: 'influencer',
          currentPoints: 1250,
          pointsToNextTier: 750,
          progressPercentage: 62.5,
        },
      }),
    });
  });

  await page.route('**/api/gamification/me/achievements', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unlocked: [
          {
            id: 'ach-001',
            slug: 'first-steps',
            name: 'First Steps',
            description: 'Create your first AI agent',
            icon: 'rocket',
            category: 'creation',
            requirementType: 'milestone',
            requirementValue: 1,
            pointsReward: 50,
            tierRequired: null,
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            unlockedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'ach-002',
            slug: 'content-machine',
            name: 'Content Machine',
            description: 'Generate 50 pieces of content',
            icon: 'zap',
            category: 'creation',
            requirementType: 'milestone',
            requirementValue: 50,
            pointsReward: 100,
            tierRequired: null,
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            unlockedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'ach-003',
            slug: 'on-fire',
            name: 'On Fire!',
            description: 'Maintain a 5-day streak',
            icon: 'flame',
            category: 'streak',
            requirementType: 'streak',
            requirementValue: 5,
            pointsReward: 75,
            tierRequired: null,
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            unlockedAt: new Date().toISOString(),
          },
        ],
        locked: [
          {
            id: 'ach-004',
            slug: 'multi-agent',
            name: 'Multi-Agent Master',
            description: 'Create 5 different agents',
            icon: 'users',
            category: 'creation',
            requirementType: 'milestone',
            requirementValue: 5,
            pointsReward: 150,
            tierRequired: null,
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 60,
            currentValue: 3,
          },
          {
            id: 'ach-005',
            slug: 'viral-hit',
            name: 'Viral Hit',
            description: 'Get 1000+ likes on a single post',
            icon: 'trending-up',
            category: 'engagement',
            requirementType: 'milestone',
            requirementValue: 1000,
            pointsReward: 200,
            tierRequired: 'creator',
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 0,
            currentValue: 0,
          },
          {
            id: 'ach-006',
            slug: 'unstoppable',
            name: 'Unstoppable',
            description: 'Maintain a 30-day streak',
            icon: 'flame',
            category: 'streak',
            requirementType: 'streak',
            requirementValue: 30,
            pointsReward: 300,
            tierRequired: null,
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 16,
            currentValue: 5,
          },
          {
            id: 'ach-007',
            slug: 'century-club',
            name: 'Century Club',
            description: 'Publish 100 posts',
            icon: 'check-circle',
            category: 'publishing',
            requirementType: 'milestone',
            requirementValue: 100,
            pointsReward: 250,
            tierRequired: null,
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 38,
            currentValue: 38,
          },
          {
            id: 'ach-008',
            slug: 'influencer-status',
            name: 'Influencer Status',
            description: 'Reach 5000 total points',
            icon: 'star',
            category: 'engagement',
            requirementType: 'milestone',
            requirementValue: 5000,
            pointsReward: 500,
            tierRequired: 'influencer',
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 25,
            currentValue: 1250,
          },
        ],
      }),
    });
  });

  await page.route('**/api/gamification/leaderboard?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        period: 'all_time',
        entries: [
          {
            walletAddress: 'TopUser1111111111111111111111111111111111',
            displayName: 'CryptoKing',
            totalPoints: 8500,
            rank: 1,
            tier: 'legend',
          },
          {
            walletAddress: 'TopUser2222222222222222222222222222222222',
            displayName: 'MemeLord99',
            totalPoints: 7200,
            rank: 2,
            tier: 'influencer',
          },
          {
            walletAddress: 'TopUser3333333333333333333333333333333333',
            displayName: null,
            totalPoints: 5800,
            rank: 3,
            tier: 'influencer',
          },
          {
            walletAddress: 'TestWa11etAddress1111111111111111111111111',
            displayName: null,
            totalPoints: 1250,
            rank: 42,
            tier: 'creator',
          },
        ],
        cachedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route('**/api/gamification/leaderboard/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currentUser: {
          walletAddress: 'TestWa11etAddress1111111111111111111111111',
          displayName: null,
          totalPoints: 1250,
          rank: 42,
          tier: 'creator',
        },
        above: [
          {
            walletAddress: 'User40000000000000000000000000000000000000',
            displayName: 'ContentMaster',
            totalPoints: 1320,
            rank: 40,
            tier: 'creator',
          },
          {
            walletAddress: 'User41000000000000000000000000000000000000',
            displayName: null,
            totalPoints: 1280,
            rank: 41,
            tier: 'creator',
          },
        ],
        below: [
          {
            walletAddress: 'User43000000000000000000000000000000000000',
            displayName: 'NewCreator',
            totalPoints: 1210,
            rank: 43,
            tier: 'creator',
          },
          {
            walletAddress: 'User44000000000000000000000000000000000000',
            displayName: null,
            totalPoints: 1180,
            rank: 44,
            tier: 'beginner',
          },
        ],
      }),
    });
  });

  // Analytics endpoint
  await page.route('**/api/analytics/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalGenerations: 47,
        totalPublished: 38,
        totalEngagement: 1842,
        avgQualityScore: 8.2,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      }),
    });
  });
}
