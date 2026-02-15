// ---------------------------------------------------------------------------
// Gas Manager — Fee Payer Balance Monitoring
// ---------------------------------------------------------------------------

export interface GasManagerStatus {
  feePayerAddress: string;
  balanceLamports: bigint;
  balanceSol: number;
  alertThresholdSol: number;
  isHealthy: boolean;
  estimatedSettlementsRemaining: number;
}

/** Minimal RPC interface for gas management. */
export interface GasRpc {
  getBalance(
    address: string,
    options?: { commitment: string },
  ): { send(): Promise<{ value: bigint }> };
}

const LAMPORTS_PER_SOL = 1_000_000_000n;
const ESTIMATED_FEE_PER_SETTLEMENT = 10_000n;
const MINIMUM_SETTLEMENT_FEE = 5_000n;

export class GasManager {
  private rpc: GasRpc;
  private feePayerAddress: string;
  private alertThresholdSol: number;

  constructor(rpc: GasRpc, feePayerAddress: string, alertThresholdSol: number) {
    this.rpc = rpc;
    this.feePayerAddress = feePayerAddress;
    this.alertThresholdSol = alertThresholdSol;
  }

  async checkBalance(): Promise<GasManagerStatus> {
    const result = await this.rpc.getBalance(this.feePayerAddress, { commitment: 'confirmed' }).send();
    const balanceLamports = result.value;
    const balanceSol = Number(balanceLamports) / Number(LAMPORTS_PER_SOL);
    const isHealthy = balanceSol >= this.alertThresholdSol;
    const estimatedSettlementsRemaining = Number(balanceLamports / ESTIMATED_FEE_PER_SETTLEMENT);

    if (!isHealthy) {
      process.stderr.write(
        `[facilitator] WARNING: Fee payer balance low: ${balanceSol.toFixed(6)} SOL (threshold: ${this.alertThresholdSol} SOL)\n`,
      );
    }

    return {
      feePayerAddress: this.feePayerAddress,
      balanceLamports,
      balanceSol,
      alertThresholdSol: this.alertThresholdSol,
      isHealthy,
      estimatedSettlementsRemaining,
    };
  }

  async canAffordSettlement(): Promise<boolean> {
    try {
      const result = await this.rpc.getBalance(this.feePayerAddress, { commitment: 'confirmed' }).send();
      return result.value > MINIMUM_SETTLEMENT_FEE;
    } catch {
      // RPC failure — allow attempt, settlement will fail naturally
      return true;
    }
  }
}
