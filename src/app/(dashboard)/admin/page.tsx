'use client';

/**
 * Admin Alpha Dashboard
 * Shows platform metrics, whitelist management, and feedback overview.
 * Returns 404-like page for non-admin wallets.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  Zap,
  Share2,
  DollarSign,
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

interface PlatformSummary {
  totalUsers: number;
  totalGenerations: number;
  totalPublishes: number;
  totalCostUsd: number;
}

interface WhitelistEntry {
  id: string;
  wallet_address: string;
  access_tier: string;
  notes: string | null;
  added_by: string;
  created_at: string;
}

interface ErrorAlert {
  path: string;
  errorRate: string;
  message: string;
}

interface CharacterWallet {
  id: string;
  name: string;
  agent_pubkey: string | null;
  wallet: { walletId: string; publicKey: string } | null;
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminDeniedReason, setAdminDeniedReason] = useState<string | null>(null);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [errorAlerts, setErrorAlerts] = useState<ErrorAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Whitelist single-add form state
  const [newWallet, setNewWallet] = useState('');
  const [newTier, setNewTier] = useState<'ALPHA' | 'BETA' | 'EARLY_ACCESS'>('ALPHA');
  const [newNotes, setNewNotes] = useState('');
  const [addingWallet, setAddingWallet] = useState(false);

  // Whitelist batch-add state
  const [showBatch, setShowBatch] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchTier, setBatchTier] = useState<'ALPHA' | 'BETA' | 'EARLY_ACCESS'>('ALPHA');
  const [batchNotes, setBatchNotes] = useState('');
  const [batchResult, setBatchResult] = useState<{ added: number; skipped: number } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Character wallets state
  const [characters, setCharacters] = useState<CharacterWallet[]>([]);
  const [reprovisioningId, setReprovisioningId] = useState<string | null>(null);
  const [reprovisionResult, setReprovisionResult] = useState<Record<string, string>>({});

  // Copy-address state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ozskr_auth_token');
      if (!token) {
        setAdminDeniedReason('No auth token in localStorage — connect your wallet first.');
        setIsAdmin(false);
        return;
      }

      // Decode the JWT payload (base64url, no verification needed client-side)
      let walletFromToken: string | null = null;
      try {
        const payloadB64 = token.split('.')[1];
        if (payloadB64) {
          const decoded = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
          walletFromToken = typeof decoded.wallet_address === 'string' ? decoded.wallet_address : null;
        }
      } catch { /* ignore decode errors */ }

      const headers = { Authorization: `Bearer ${token}` };

      // Try admin summary to check if user is admin
      const summaryRes = await fetch('/api/admin/metrics/summary', { headers });

      if (summaryRes.status === 403 || summaryRes.status === 401) {
        setAdminDeniedReason(
          walletFromToken
            ? `Wallet ${walletFromToken.slice(0, 8)}…${walletFromToken.slice(-4)} is not in ADMIN_WALLETS.`
            : `HTTP ${summaryRes.status} — token may be expired or wallet not in ADMIN_WALLETS.`,
        );
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);

      const [summaryData, whitelistRes, errorsRes, charactersRes] = await Promise.all([
        summaryRes.json() as Promise<PlatformSummary>,
        fetch('/api/admin-whitelist', { headers }).then(r => r.ok ? r.json() : { entries: [] }),
        fetch('/api/admin/metrics/errors', { headers }).then(r => r.ok ? r.json() : { alerts: [] }),
        fetch('/api/admin/characters', { headers }).then(r => r.ok ? r.json() : { characters: [] }),
      ]);

      setSummary(summaryData);
      setWhitelist((whitelistRes as { entries: WhitelistEntry[] }).entries ?? []);
      setErrorAlerts((errorsRes as { alerts: ErrorAlert[] }).alerts ?? []);
      setCharacters((charactersRes as { characters: CharacterWallet[] }).characters ?? []);
    } catch (err) {
      setAdminDeniedReason(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddWallet = async () => {
    if (!newWallet || newWallet.length < 32) return;
    setAddingWallet(true);

    try {
      const token = localStorage.getItem('ozskr_auth_token');
      const res = await fetch('/api/admin-whitelist', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: newWallet,
          accessTier: newTier,
          notes: newNotes || undefined,
        }),
      });

      if (res.ok) {
        setNewWallet('');
        setNewNotes('');
        await fetchData();
      }
    } finally {
      setAddingWallet(false);
    }
  };

  const handleRemoveWallet = async (wallet: string) => {
    const token = localStorage.getItem('ozskr_auth_token');
    await fetch(`/api/admin-whitelist/${wallet}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchData();
  };

  const handleBatchAdd = async () => {
    const wallets = batchText
      .split(/[\n,\s]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 32 && w.length <= 44);
    if (wallets.length === 0) return;

    setBatchLoading(true);
    setBatchResult(null);
    try {
      const token = localStorage.getItem('ozskr_auth_token');
      const res = await fetch('/api/admin-whitelist/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallets: wallets.map((w) => ({
            walletAddress: w,
            accessTier: batchTier,
            notes: batchNotes || undefined,
          })),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { added: number; skipped: number };
        setBatchResult(data);
        setBatchText('');
        setBatchNotes('');
        await fetchData();
      }
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCopyAddress = (id: string, address: string) => {
    void navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleReprovisionWallet = async (characterId: string, force = false) => {
    setReprovisioningId(characterId);
    setReprovisionResult((prev) => ({ ...prev, [characterId]: '' }));
    try {
      const token = localStorage.getItem('ozskr_auth_token');
      const url = `/api/admin/characters/${characterId}/provision-wallet${force ? '?force=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { publicKey?: string; alreadyExisted?: boolean; error?: string; code?: string };
      if (res.ok) {
        const label = data.alreadyExisted ? 'Already existed' : 'Provisioned';
        setReprovisionResult((prev) => ({
          ...prev,
          [characterId]: `${label}: ${data.publicKey?.slice(0, 8)}…${data.publicKey?.slice(-4)}`,
        }));
        await fetchData();
      } else {
        setReprovisionResult((prev) => ({
          ...prev,
          [characterId]: `Error: ${data.error ?? 'Unknown'} (${data.code ?? res.status})`,
        }));
      }
    } catch (err) {
      setReprovisionResult((prev) => ({
        ...prev,
        [characterId]: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }));
    } finally {
      setReprovisioningId(null);
    }
  };

  // Non-admin: show 404
  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Page Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        {process.env.NODE_ENV === 'development' && adminDeniedReason && (
          <p className="mt-4 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 font-mono text-xs text-yellow-400">
            [dev] {adminDeniedReason}
          </p>
        )}
      </div>
    );
  }

  // Loading
  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solana-purple border-t-transparent" />
        <span className="ml-3 text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Alpha Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform metrics and whitelist management</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} className="text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Error Alerts */}
      {errorAlerts.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts ({errorAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errorAlerts.map((alert, i) => (
                <div key={i} className="text-xs text-red-300">
                  <span className="font-mono">{alert.path}</span> — {alert.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-5 w-5 text-solana-purple" />
              <div>
                <p className="font-display text-xl font-bold text-white">{summary.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Users</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="flex items-center gap-3 p-4">
              <Zap className="h-5 w-5 text-solana-green" />
              <div>
                <p className="font-display text-xl font-bold text-white">{summary.totalGenerations}</p>
                <p className="text-xs text-muted-foreground">Generations</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="flex items-center gap-3 p-4">
              <Share2 className="h-5 w-5 text-brick-gold" />
              <div>
                <p className="font-display text-xl font-bold text-white">{summary.totalPublishes}</p>
                <p className="text-xs text-muted-foreground">Publishes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-5 w-5 text-solana-purple" />
              <div>
                <p className="font-display text-xl font-bold text-white">${summary.totalCostUsd.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Cost</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Character Wallets */}
      {characters.length > 0 && (
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-solana-purple" />
              Character Agent Wallets ({characters.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {characters.map((ch) => {
                const hasMapping = ch.wallet !== null;
                const pubkey = ch.wallet?.publicKey ?? ch.agent_pubkey;
                const result = reprovisionResult[ch.id];
                const isReprovisioning = reprovisioningId === ch.id;
                return (
                  <div
                    key={ch.id}
                    className="flex flex-col gap-1 rounded-md border border-white/5 bg-white/[0.01] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">{ch.name}</span>
                        <Badge
                          variant="outline"
                          className={hasMapping
                            ? 'border-solana-green/30 text-solana-green text-[10px]'
                            : 'border-red-500/30 text-red-400 text-[10px]'}
                        >
                          {hasMapping ? 'TEE' : pubkey ? 'local' : 'none'}
                        </Badge>
                      </div>
                      {pubkey && (
                        <span className="font-mono text-[11px] text-zinc-500">
                          {pubkey.slice(0, 8)}…{pubkey.slice(-4)}
                        </span>
                      )}
                      {result && (
                        <span className={`text-[11px] ${result.startsWith('Error') ? 'text-red-400' : 'text-solana-green'}`}>
                          {result}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!hasMapping && (
                        <Button
                          size="sm"
                          disabled={isReprovisioning}
                          onClick={() => handleReprovisionWallet(ch.id)}
                          className="h-7 bg-solana-purple text-white hover:bg-solana-purple/90 text-xs"
                        >
                          <KeyRound className="mr-1 h-3 w-3" />
                          {isReprovisioning ? 'Provisioning…' : 'Provision'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isReprovisioning}
                        onClick={() => handleReprovisionWallet(ch.id, true)}
                        className="h-7 border-white/10 text-zinc-400 hover:text-white text-xs"
                        title="Delete existing mapping and provision a fresh wallet"
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        {isReprovisioning ? '…' : 'Re-provision'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Whitelist Management */}
      <Card className="border-white/5 bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-solana-green" />
            Alpha Whitelist ({whitelist.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Single Add Form */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Wallet address"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as typeof newTier)}
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm"
            >
              <option value="ALPHA">ALPHA</option>
              <option value="BETA">BETA</option>
              <option value="EARLY_ACCESS">EARLY_ACCESS</option>
            </select>
            <Input
              placeholder="Notes (optional)"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-40 text-xs"
            />
            <Button
              size="sm"
              onClick={handleAddWallet}
              disabled={!newWallet || newWallet.length < 32 || addingWallet}
              className="bg-solana-green text-black hover:bg-solana-green/90"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>

          {/* Batch Add Toggle */}
          <button
            onClick={() => setShowBatch((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white"
          >
            {showBatch ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Batch add (paste multiple addresses)
          </button>

          {/* Batch Add Form */}
          {showBatch && (
            <div className="space-y-2 rounded-md border border-white/5 bg-white/[0.01] p-3">
              <p className="text-xs text-muted-foreground">
                One address per line, or comma/space-separated. Up to 100 wallets.
              </p>
              <Textarea
                placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU&#10;So11111111111111111111111111111111111111112&#10;..."
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                className="min-h-24 font-mono text-xs"
                rows={5}
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={batchTier}
                  onChange={(e) => setBatchTier(e.target.value as typeof batchTier)}
                  className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs"
                >
                  <option value="ALPHA">ALPHA</option>
                  <option value="BETA">BETA</option>
                  <option value="EARLY_ACCESS">EARLY_ACCESS</option>
                </select>
                <Input
                  placeholder="Notes (optional)"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="w-40 text-xs"
                />
                <span className="text-xs text-muted-foreground">
                  {batchText.split(/[\n,\s]+/).filter((w) => w.trim().length >= 32).length} valid
                </span>
                <Button
                  size="sm"
                  onClick={handleBatchAdd}
                  disabled={
                    batchLoading ||
                    batchText.split(/[\n,\s]+/).filter((w) => w.trim().length >= 32).length === 0
                  }
                  className="bg-solana-green text-black hover:bg-solana-green/90"
                >
                  {batchLoading ? 'Adding…' : 'Batch Add'}
                </Button>
              </div>
              {batchResult && (
                <p className="text-xs text-solana-green">
                  Added {batchResult.added}, skipped {batchResult.skipped} (already whitelisted)
                </p>
              )}
            </div>
          )}

          {/* Whitelist Table */}
          {whitelist.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No whitelisted wallets yet
            </p>
          ) : (
            <div className="space-y-2">
              {whitelist.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.01] px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCopyAddress(entry.id, entry.wallet_address)}
                      className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-white"
                      title="Copy full address"
                    >
                      {copiedId === entry.id ? (
                        <Check className="h-3 w-3 text-solana-green" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {entry.wallet_address.slice(0, 8)}…{entry.wallet_address.slice(-4)}
                    </button>
                    <Badge
                      variant="outline"
                      className={
                        entry.access_tier === 'ALPHA'
                          ? 'border-solana-green/30 text-solana-green'
                          : entry.access_tier === 'BETA'
                            ? 'border-solana-purple/30 text-solana-purple'
                            : 'border-brick-gold/30 text-brick-gold'
                      }
                    >
                      {entry.access_tier}
                    </Badge>
                    {entry.notes && (
                      <span className="text-xs text-muted-foreground">{entry.notes}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveWallet(entry.wallet_address)}
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
