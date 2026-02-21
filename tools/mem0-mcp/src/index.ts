/**
 * ozskr.ai Mem0 MCP Server
 *
 * Provides persistent development workflow memory via Mem0.
 * Runs as a stdio MCP server for Claude Code integration.
 *
 * Tools:
 *   store_memory     — Store a development memory (decision, pattern, bug, etc.)
 *   search_memory    — Search memories by natural language query
 *   get_agent_context — Retrieve all memories relevant to a specific agent domain
 *   store_handoff    — Store session handoff context for continuity
 *   delete_memory    — Remove an outdated or incorrect memory
 *
 * Environment:
 *   MEM0_API_KEY — Required. Mem0 platform API key.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MemoryClient } from 'mem0ai';
import { z } from 'zod';

const USER_ID = 'ozskr-dev';

const VALID_CATEGORIES = [
  'architecture-decision',
  'completed-task',
  'known-bug',
  'pattern',
  'dependency',
  'config',
  'handoff-context',
] as const;

const VALID_AGENTS = [
  'solana-dev',
  'frontend-dev',
  'ai-agent-dev',
  'api-architect',
  'test-writer',
  'security-auditor',
  'code-reviewer',
  'devops-infra',
  'content-writer',
  'social-integration-dev',
  'glinda-cmo',
  'toto-funding',
] as const;

function createClient(): MemoryClient {
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) {
    throw new Error('MEM0_API_KEY environment variable is required');
  }
  return new MemoryClient({ apiKey });
}

const server = new McpServer(
  { name: 'ozskr-mem0', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// ─── store_memory ────────────────────────────────────────────────────────────

server.registerTool(
  'store_memory',
  {
    description:
      'Store a development workflow memory. Use for architecture decisions, patterns, completed tasks, known bugs, dependency notes, config details.',
    inputSchema: {
      content: z.string().describe('The memory content to store'),
      category: z
        .enum(VALID_CATEGORIES)
        .describe('Memory category'),
      agent: z
        .enum(VALID_AGENTS)
        .optional()
        .describe('Owning agent domain (optional)'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Additional tags for filtering'),
    },
  },
  async ({ content, category, agent, tags }) => {
    try {
      const client = createClient();
      const metadata: Record<string, unknown> = { category };
      if (agent) metadata.agent = agent;
      if (tags?.length) metadata.tags = tags;

      const result = await client.add(
        [{ role: 'user', content }],
        { user_id: USER_ID, metadata },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { success: true, memories: result },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error storing memory: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── search_memory ───────────────────────────────────────────────────────────

server.registerTool(
  'search_memory',
  {
    description:
      'Search development memories by natural language query. Returns relevant memories ranked by similarity.',
    inputSchema: {
      query: z.string().describe('Natural language search query'),
      category: z
        .enum(VALID_CATEGORIES)
        .optional()
        .describe('Filter by category'),
      agent: z
        .enum(VALID_AGENTS)
        .optional()
        .describe('Filter by owning agent'),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max results (default 10)'),
    },
  },
  async ({ query, category, agent, limit }) => {
    try {
      const client = createClient();
      const filters: Record<string, unknown> = {};
      if (category) filters.category = category;
      if (agent) filters.agent = agent;

      const results = await client.search(query, {
        user_id: USER_ID,
        limit: limit ?? 10,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { success: true, count: results.length, memories: results },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error searching memories: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── get_agent_context ───────────────────────────────────────────────────────

server.registerTool(
  'get_agent_context',
  {
    description:
      'Retrieve all memories relevant to a specific agent domain. Use at the start of an agent session to load context.',
    inputSchema: {
      agent: z.enum(VALID_AGENTS).describe('Agent domain to get context for'),
      include_handoffs: z
        .boolean()
        .optional()
        .describe('Include recent handoff context (default true)'),
    },
  },
  async ({ agent, include_handoffs }) => {
    try {
      const client = createClient();

      // Fetch agent-specific memories
      const agentMemories = await client.search(
        `${agent} development context patterns decisions`,
        {
          user_id: USER_ID,
          limit: 20,
          filters: { agent },
        },
      );

      // Optionally include handoff context
      let handoffs: unknown[] = [];
      if (include_handoffs !== false) {
        const handoffResults = await client.search(
          `handoff context for ${agent}`,
          {
            user_id: USER_ID,
            limit: 5,
            filters: { category: 'handoff-context' },
          },
        );
        handoffs = handoffResults;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                agent,
                memories: agentMemories,
                handoffs,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error getting agent context: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── store_handoff ───────────────────────────────────────────────────────────

server.registerTool(
  'store_handoff',
  {
    description:
      'Store session handoff context for continuity across sessions. Include current state, pending work, blockers, and next steps.',
    inputSchema: {
      context: z
        .string()
        .describe('Handoff context: current state, pending work, blockers, next steps'),
      agent: z
        .enum(VALID_AGENTS)
        .optional()
        .describe('Primary agent domain for this handoff'),
      session_summary: z
        .string()
        .optional()
        .describe('Brief summary of what was accomplished this session'),
    },
  },
  async ({ context, agent, session_summary }) => {
    try {
      const client = createClient();
      const metadata: Record<string, unknown> = {
        category: 'handoff-context',
        timestamp: new Date().toISOString(),
      };
      if (agent) metadata.agent = agent;
      if (session_summary) metadata.session_summary = session_summary;

      const content = session_summary
        ? `Session handoff:\n\nSummary: ${session_summary}\n\nContext: ${context}`
        : `Session handoff:\n\n${context}`;

      const result = await client.add(
        [{ role: 'user', content }],
        { user_id: USER_ID, metadata },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { success: true, memories: result },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error storing handoff: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── delete_memory ───────────────────────────────────────────────────────────

server.registerTool(
  'delete_memory',
  {
    description:
      'Delete an outdated or incorrect memory by its ID. Use search_memory first to find the ID.',
    inputSchema: {
      memory_id: z.string().describe('The memory ID to delete'),
    },
  },
  async ({ memory_id }) => {
    try {
      const client = createClient();
      const result = await client.delete(memory_id);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, ...result }, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error deleting memory: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Start server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now listening on stdio
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
