// ---------------------------------------------------------------------------
// Structured Audit Logger — Compliance Trail
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  timestamp: string;
  action: 'verify' | 'settle';
  status: 'success' | 'rejected' | 'failed';

  // Payment details
  payerAddress: string;
  recipientAddress: string;
  amount: string;
  tokenMint: string;
  network: string;

  // Governance results
  governanceResult: {
    ofac: string;
    delegation: string;
    budget: string;
    circuitBreaker: string;
    blockhash?: string;
    simulation?: string;
  };

  // Settlement details (settle only)
  txSignature?: string;
  simulationPassed?: boolean;
  blockhashValid?: boolean;
  gasPayerBalance?: string;

  // Context
  agentId?: string;
  latencyMs: number;
  errorReason?: string;
}

export interface AuditLogger {
  log(entry: AuditLogEntry): void;
}

/**
 * Console audit logger that writes structured JSON to stdout.
 * Processable by log aggregators (CloudWatch, Datadog, etc.).
 */
export class ConsoleAuditLogger implements AuditLogger {
  log(entry: AuditLogEntry): void {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

/**
 * In-memory audit logger for testing. Captures entries for assertions.
 */
export class InMemoryAuditLogger implements AuditLogger {
  readonly entries: AuditLogEntry[] = [];

  log(entry: AuditLogEntry): void {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries.length = 0;
  }
}
