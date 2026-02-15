import { describe, it, expect, vi } from 'vitest';
import {
  simulateAndVerify,
  parseTransferInstructions,
  type SimulationRpc,
} from '../../src/settlement/simulate.js';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

function buildTransferCheckedIxData(amount: bigint, decimals: number): Uint8Array {
  const data = new Uint8Array(10);
  data[0] = 12; // TransferChecked discriminator
  // Write amount as u64 LE
  let val = amount;
  for (let i = 0; i < 8; i++) {
    data[1 + i] = Number(val & 0xFFn);
    val >>= 8n;
  }
  data[9] = decimals;
  return data;
}

function buildLegacyTransaction(
  programId: string,
  accountKeys: string[],
  accountIndexes: number[],
  ixData: Uint8Array,
): string {
  // Minimal legacy transaction: 1 signature + message
  const parts: number[] = [];

  // 1 signature (dummy)
  parts.push(1);
  for (let i = 0; i < 64; i++) parts.push(0);

  // Message header: numRequired=1, readonlySigned=0, readonlyUnsigned=0
  parts.push(1, 0, 0);

  // Account keys
  parts.push(accountKeys.length);
  for (let i = 0; i < accountKeys.length; i++) {
    // 32 bytes per key (dummy)
    for (let j = 0; j < 32; j++) parts.push(i);
  }

  // Recent blockhash (32 bytes)
  for (let i = 0; i < 32; i++) parts.push(0);

  // Instructions: 1 instruction
  parts.push(1);
  // Program ID index
  const programIdx = accountKeys.indexOf(programId);
  parts.push(programIdx >= 0 ? programIdx : 0);
  // Account indexes
  parts.push(accountIndexes.length);
  for (const idx of accountIndexes) parts.push(idx);
  // Data
  parts.push(ixData.length);
  for (const b of ixData) parts.push(b);

  return Buffer.from(parts).toString('base64');
}

describe('parseTransferInstructions', () => {
  it('extracts Token Program TransferChecked instruction', () => {
    const keys = ['source', 'mint', 'dest', 'authority', TOKEN_PROGRAM_ID];
    const ixData = buildTransferCheckedIxData(1000000n, 6);
    const txBase64 = buildLegacyTransaction(TOKEN_PROGRAM_ID, keys, [0, 1, 2, 3], ixData);

    const transfers = parseTransferInstructions(txBase64, keys);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].source).toBe('source');
    expect(transfers[0].mint).toBe('mint');
    expect(transfers[0].destination).toBe('dest');
    expect(transfers[0].amount).toBe(1000000n);
    expect(transfers[0].programId).toBe(TOKEN_PROGRAM_ID);
  });

  it('extracts Token-2022 TransferChecked instruction', () => {
    const keys = ['source', 'mint', 'dest', 'authority', TOKEN_2022_PROGRAM_ID];
    const ixData = buildTransferCheckedIxData(2000000n, 6);
    const txBase64 = buildLegacyTransaction(TOKEN_2022_PROGRAM_ID, keys, [0, 1, 2, 3], ixData);

    const transfers = parseTransferInstructions(txBase64, keys);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].programId).toBe(TOKEN_2022_PROGRAM_ID);
    expect(transfers[0].amount).toBe(2000000n);
  });

  it('returns empty for non-token instruction', () => {
    const keys = ['acct1', 'acct2', 'SystemProgram'];
    const ixData = new Uint8Array([0, 0, 0, 0]); // Not TransferChecked
    const txBase64 = buildLegacyTransaction('SystemProgram', keys, [0, 1], ixData);

    const transfers = parseTransferInstructions(txBase64, keys);
    expect(transfers).toHaveLength(0);
  });
});

describe('simulateAndVerify', () => {
  function createMockRpc(err: unknown = null, logs: string[] = [], units = 5000): SimulationRpc {
    return {
      simulateTransaction: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: { err, logs, unitsConsumed: units },
        }),
      }),
    };
  }

  const keys = ['source', 'mint', 'dest', 'authority', TOKEN_PROGRAM_ID];
  const ixData = buildTransferCheckedIxData(1000000n, 6);
  const txBase64 = buildLegacyTransaction(TOKEN_PROGRAM_ID, keys, [0, 1, 2, 3], ixData);

  it('succeeds when simulation passes and params match', async () => {
    const rpc = createMockRpc();
    const result = await simulateAndVerify(rpc, txBase64, keys, {
      expectedRecipient: 'dest',
      expectedAmount: 1000000n,
      expectedTokenMint: 'mint',
    });
    expect(result.success).toBe(true);
    expect(result.recipientVerified).toBe(true);
    expect(result.amountVerified).toBe(true);
    expect(result.tokenMintVerified).toBe(true);
  });

  it('fails when recipient does not match', async () => {
    const rpc = createMockRpc();
    const result = await simulateAndVerify(rpc, txBase64, keys, {
      expectedRecipient: 'wrong_dest',
      expectedAmount: 1000000n,
      expectedTokenMint: 'mint',
    });
    expect(result.success).toBe(false);
    expect(result.recipientVerified).toBe(false);
    expect(result.error).toContain('wrong_dest');
  });

  it('fails when amount is insufficient', async () => {
    const rpc = createMockRpc();
    const result = await simulateAndVerify(rpc, txBase64, keys, {
      expectedRecipient: 'dest',
      expectedAmount: 5000000n,
      expectedTokenMint: 'mint',
    });
    expect(result.success).toBe(false);
    expect(result.amountVerified).toBe(false);
  });

  it('fails when token mint does not match', async () => {
    const rpc = createMockRpc();
    const result = await simulateAndVerify(rpc, txBase64, keys, {
      expectedRecipient: 'dest',
      expectedAmount: 1000000n,
      expectedTokenMint: 'wrong_mint',
    });
    expect(result.success).toBe(false);
    expect(result.tokenMintVerified).toBe(false);
  });

  it('fails when simulation returns error', async () => {
    const rpc = createMockRpc({ InstructionError: [0, 'Custom'] });
    const result = await simulateAndVerify(rpc, txBase64, keys, {
      expectedRecipient: 'dest',
      expectedAmount: 1000000n,
      expectedTokenMint: 'mint',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Simulation failed');
  });

  it('fails when RPC throws', async () => {
    const rpc: SimulationRpc = {
      simulateTransaction: vi.fn().mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      }),
    };
    const result = await simulateAndVerify(rpc, txBase64, keys, {
      expectedRecipient: 'dest',
      expectedAmount: 1000000n,
      expectedTokenMint: 'mint',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('RPC error');
  });

  it('fails when no transfer instructions found', async () => {
    const rpc = createMockRpc();
    const noTransferKeys = ['acct1', 'acct2', 'SystemProgram'];
    const noTransferData = new Uint8Array([0, 0, 0, 0]);
    const noTransferTx = buildLegacyTransaction('SystemProgram', noTransferKeys, [0, 1], noTransferData);

    const result = await simulateAndVerify(rpc, noTransferTx, noTransferKeys, {
      expectedRecipient: 'dest',
      expectedAmount: 1000000n,
      expectedTokenMint: 'mint',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No SPL Transfer');
  });
});
