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

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [errorAlerts, setErrorAlerts] = useState<ErrorAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Whitelist form state
  const [newWallet, setNewWallet] = useState('');
  const [newTier, setNewTier] = useState<'ALPHA' | 'BETA' | 'EARLY_ACCESS'>('ALPHA');
  const [newNotes, setNewNotes] = useState('');
  const [addingWallet, setAddingWallet] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ozskr_auth_token');
      if (!token) {
        setIsAdmin(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Try admin summary to check if user is admin
      const summaryRes = await fetch('/api/admin/metrics/summary', { headers });

      if (summaryRes.status === 403 || summaryRes.status === 401) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);

      const [summaryData, whitelistRes, errorsRes] = await Promise.all([
        summaryRes.json() as Promise<PlatformSummary>,
        fetch('/api/admin-whitelist', { headers }).then(r => r.ok ? r.json() : { entries: [] }),
        fetch('/api/admin/metrics/errors', { headers }).then(r => r.ok ? r.json() : { alerts: [] }),
      ]);

      setSummary(summaryData);
      setWhitelist((whitelistRes as { entries: WhitelistEntry[] }).entries ?? []);
      setErrorAlerts((errorsRes as { alerts: ErrorAlert[] }).alerts ?? []);
    } catch {
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

  // Non-admin: show 404
  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Page Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
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

      {/* Whitelist Management */}
      <Card className="border-white/5 bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-solana-green" />
            Alpha Whitelist ({whitelist.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Form */}
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
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.wallet_address.slice(0, 8)}...{entry.wallet_address.slice(-4)}
                    </span>
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
