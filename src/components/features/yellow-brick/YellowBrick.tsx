'use client';

/**
 * YellowBrick — Primary command/query bar placeholder.
 * WS1 will replace this with the full interactive implementation.
 * This placeholder preserves exact dimensions so the layout is correct.
 *
 * TODO(WS1): Replace with full YellowBrick interactive component once WS1 merges.
 */

export function YellowBrick() {
  return (
    <div
      className="w-full flex items-center gap-3 px-4"
      style={{
        height: '48px',
        background: '#18181B',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '4px',
        maxWidth: '672px',
      }}
    >
      <span style={{ color: '#F59E0B', fontSize: '16px' }}>✨</span>
      <span style={{ color: '#A1A1AA', fontSize: '14px', flex: 1 }}>
        Talk to your agent...
      </span>
      <span style={{ color: '#71717A', fontSize: '12px' }}>⌘K</span>
    </div>
  );
}

export default YellowBrick;
