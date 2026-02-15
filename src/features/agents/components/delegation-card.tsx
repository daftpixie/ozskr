'use client';

/**
 * Delegation Card
 * Displays agent delegation status and provides approve/revoke controls.
 * Integrates with Phantom wallet for on-chain SPL token delegation.
 */

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useDelegation,
  useDelegationTransactions,
  useApproveDelegation,
  useRevokeDelegation,
} from '@/hooks/use-delegation';
import { formatTokenAmount, parseTokenAmount } from '@/lib/solana/tokens';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Wallet,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Devnet USDC-Dev SPL token mint (Circle test faucet)
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_DECIMALS = 6;

interface DelegationCardProps {
  characterId: string;
  characterName: string;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 text-xs font-mono hover:text-foreground">
      {truncateAddress(address)}
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ExplorerLink({ signature, label }: { signature: string; label?: string }) {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  const url = `https://explorer.solana.com/tx/${signature}${clusterParam}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-solana-purple hover:underline"
    >
      {label || truncateAddress(signature)}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function DelegationCard({ characterId, characterName }: DelegationCardProps) {
  const { connected } = useWallet();
  const { data: delegation, isLoading, error } = useDelegation(characterId);
  const { data: txData } = useDelegationTransactions(characterId);
  const approveMutation = useApproveDelegation();
  const revokeMutation = useRevokeDelegation();

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('10');
  const [mintInput, setMintInput] = useState(DEVNET_USDC_MINT);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !delegation) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            {error?.message || 'Unable to load delegation status'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = delegation.delegationStatus;
  const isActive = status === 'active';
  const isRevoked = status === 'revoked';
  const hasAgent = !!delegation.agentPubkey;

  const statusConfig = {
    none: {
      icon: Shield,
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
      label: 'No Delegation',
    },
    pending: {
      icon: Shield,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      label: 'Pending',
    },
    active: {
      icon: ShieldCheck,
      color: 'text-solana-green',
      bg: 'bg-solana-green/10',
      label: 'Active',
    },
    revoked: {
      icon: ShieldOff,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      label: 'Revoked',
    },
  };

  const config = statusConfig[status] || statusConfig.none;
  const StatusIcon = config.icon;

  const handleApprove = async () => {
    try {
      const amount = parseTokenAmount(amountInput, USDC_DECIMALS);
      await approveMutation.mutateAsync({
        characterId,
        tokenMint: mintInput,
        amount,
        decimals: USDC_DECIMALS,
      });
      setApproveDialogOpen(false);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleRevoke = async () => {
    if (!delegation.delegationTokenMint) return;
    try {
      await revokeMutation.mutateAsync({
        characterId,
        tokenMint: delegation.delegationTokenMint,
      });
      setRevokeDialogOpen(false);
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-solana-purple" />
            <CardTitle>Agent Delegation</CardTitle>
          </div>
          <Badge className={cn('text-xs', config.bg, config.color, 'border-0')}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent wallet info */}
        {hasAgent && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Agent Wallet</span>
              <CopyAddress address={delegation.agentPubkey!} />
            </div>
            {isActive && delegation.delegationAmount && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Approved</span>
                  <span className="text-sm font-medium">
                    {formatTokenAmount(BigInt(delegation.delegationAmount), USDC_DECIMALS)} USDC
                  </span>
                </div>
                {delegation.delegationRemaining && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Remaining</span>
                    <span className="text-sm font-medium">
                      {formatTokenAmount(BigInt(delegation.delegationRemaining), USDC_DECIMALS)} USDC
                    </span>
                  </div>
                )}
              </>
            )}
            {delegation.delegationTxSignature && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tx</span>
                <ExplorerLink signature={delegation.delegationTxSignature} />
              </div>
            )}
          </div>
        )}

        {/* No agent key */}
        {!hasAgent && (
          <div className="flex flex-col items-center py-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <p className="mt-2 text-sm text-muted-foreground">
              No agent wallet found. This character needs to be recreated to generate an agent keypair.
            </p>
          </div>
        )}

        {/* Action buttons */}
        {hasAgent && connected && (
          <div className="flex gap-2">
            {/* Approve delegation */}
            {(status === 'none' || isRevoked) && (
              <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-solana-purple hover:bg-solana-purple/90"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Approve Delegation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve SPL Token Delegation</DialogTitle>
                    <DialogDescription>
                      Allow {characterName} to spend up to a set amount of tokens on your behalf.
                      This creates an on-chain approval via your wallet.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="token-mint">Token Mint Address</Label>
                      <Input
                        id="token-mint"
                        value={mintInput}
                        onChange={(e) => setMintInput(e.target.value)}
                        placeholder="Token mint address"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Default: Devnet USDC-Dev
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">Spending Cap (USDC)</Label>
                      <Input
                        id="amount"
                        type="text"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        placeholder="10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum amount the agent can spend. You can revoke at any time.
                      </p>
                    </div>

                    <div className="rounded-lg bg-yellow-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500" />
                        <p className="text-xs text-yellow-500">
                          This will open your wallet for signing. The agent will be able to
                          spend up to {amountInput} USDC from your token account.
                        </p>
                      </div>
                    </div>

                    {approveMutation.error && (
                      <div className="rounded-lg bg-destructive/10 p-3">
                        <p className="text-xs text-destructive">
                          {approveMutation.error.message}
                        </p>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setApproveDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending || !amountInput || !mintInput}
                      className="bg-solana-purple hover:bg-solana-purple/90"
                    >
                      {approveMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        'Approve in Wallet'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Revoke delegation */}
            {isActive && (
              <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Revoke
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Revoke Agent Delegation</DialogTitle>
                    <DialogDescription>
                      This will remove {characterName}&apos;s ability to spend tokens on your behalf.
                      The revocation is immediate and on-chain.
                    </DialogDescription>
                  </DialogHeader>

                  {revokeMutation.error && (
                    <div className="rounded-lg bg-destructive/10 p-3">
                      <p className="text-xs text-destructive">
                        {revokeMutation.error.message}
                      </p>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setRevokeDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRevoke}
                      disabled={revokeMutation.isPending}
                    >
                      {revokeMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Revoking...
                        </>
                      ) : (
                        'Revoke in Wallet'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {/* Wallet not connected */}
        {hasAgent && !connected && (
          <p className="text-xs text-muted-foreground">
            Connect your wallet to manage delegation.
          </p>
        )}

        {/* Transaction history */}
        {txData && txData.transactions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Agent Transactions</h4>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {txData.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={tx.status === 'confirmed' ? 'default' : 'secondary'}
                      className={cn(
                        'text-xs',
                        tx.status === 'confirmed' && 'bg-solana-green',
                      )}
                    >
                      {tx.status}
                    </Badge>
                    <span className="text-xs">
                      {formatTokenAmount(BigInt(tx.amount), USDC_DECIMALS)} USDC
                    </span>
                  </div>
                  <ExplorerLink signature={tx.txSignature} />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
