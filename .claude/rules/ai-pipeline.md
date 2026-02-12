---
paths:
  - "src/lib/ai/**/*.ts"
  - "src/features/agents/**/*.ts"
---

# AI Agent & Content Pipeline Rules

## Memory Safety

- Mem0 namespaces MUST be derived from the database `characters.mem0_namespace` column â€” NEVER from user input
- Cross-character memory access is forbidden â€” every memory operation includes the character's namespace
- Memory deletion must cascade when a character is deleted
- Character DNA is immutable at runtime â€” load once at agent init, never modify

## Prompt Engineering

- All Claude API calls MUST use prompt caching (`cache_control: ephemeral`) for character context
- Character DNA goes in the system prompt with cache_control
- User requests go in the user message (not cached)
- Never include user-supplied text directly in system prompts without sanitization

## Content Moderation

- ALL generated content MUST pass through the 3-stage moderation pipeline before storage or publishing
- Stage 1: AI text moderation (fast, automated)
- Stage 2: Image/video safety check (automated)
- Stage 3: Human review queue (for flagged content)
- No shortcut paths that bypass moderation â€” every content path goes through the pipeline

## Cost Awareness

- All fal.ai calls MUST include cost estimation before execution
- Log token usage, model, and cost for every Claude API call via Langfuse
- Track cache hit rates for prompt caching optimization
- Monitor Mem0 memory retrieval relevance scores

## Attribution

- All AI-generated content MUST have `metadata.generated_by` field
- Include model name, generation parameters, and timestamp
- Track content lineage: which character, which prompt, which model version
