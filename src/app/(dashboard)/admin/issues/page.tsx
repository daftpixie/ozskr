'use client';

/**
 * Admin Issue Tracker
 * Table view of alpha issues with severity/status filters and quick actions.
 * Returns 404-like page for non-admin wallets.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bug,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'wontfix';
  reporter_wallet: string | null;
  admin_notes: string | null;
  related_feature: string | null;
  survey_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface IssueStats {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/30 text-red-400 bg-red-500/10',
  high: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
  medium: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
  low: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
};

const STATUS_ICONS: Record<string, typeof AlertCircle> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
  wontfix: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  open: 'text-yellow-400',
  in_progress: 'text-blue-400',
  resolved: 'text-green-400',
  wontfix: 'text-muted-foreground',
};

export default function AdminIssuesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('ozskr_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        setIsAdmin(false);
        return;
      }

      const params = new URLSearchParams();
      if (severityFilter) params.set('severity', severityFilter);
      if (statusFilter) params.set('status', statusFilter);

      const [issuesRes, statsRes] = await Promise.all([
        fetch(`/api/admin-issues?${params}`, { headers }),
        fetch('/api/admin-issues/stats', { headers }),
      ]);

      if (issuesRes.status === 404) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);

      const issuesData = await issuesRes.json() as { issues: Issue[] };
      const statsData = await statsRes.json() as IssueStats;

      setIssues(issuesData.issues ?? []);
      setStats(statsData);
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateIssue = async (id: string, updates: Record<string, unknown>) => {
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`/api/admin-issues/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      await fetchData();
    }
  };

  // Non-admin: 404
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

  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solana-purple border-t-transparent" />
        <span className="ml-3 text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Issue Tracker</h1>
          <p className="text-sm text-muted-foreground">Alpha bug triage and tracking</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} className="text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="p-3 text-center">
              <p className="font-display text-lg font-bold text-white">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          {['critical', 'high', 'medium', 'low'].map((sev) => (
            <Card key={sev} className="border-white/5 bg-white/[0.02]">
              <CardContent className="p-3 text-center">
                <p className="font-display text-lg font-bold text-white">
                  {stats.bySeverity[sev] ?? 0}
                </p>
                <p className="text-xs capitalize text-muted-foreground">{sev}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-sm"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="wontfix">Won&apos;t Fix</option>
        </select>
      </div>

      {/* Issues List */}
      <Card className="border-white/5 bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="h-4 w-4 text-solana-purple" />
            Issues ({issues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No issues found
            </p>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => {
                const StatusIcon = STATUS_ICONS[issue.status] ?? AlertCircle;
                const isExpanded = expandedId === issue.id;

                return (
                  <div
                    key={issue.id}
                    className="rounded-md border border-white/5 bg-white/[0.01]"
                  >
                    {/* Row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <StatusIcon className={`h-4 w-4 shrink-0 ${STATUS_COLORS[issue.status]}`} />
                      <Badge className={`shrink-0 text-[10px] ${SEVERITY_COLORS[issue.severity]}`}>
                        {issue.severity}
                      </Badge>
                      <span className="flex-1 truncate text-sm text-white">{issue.title}</span>
                      {issue.related_feature && (
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {issue.related_feature}
                        </span>
                      )}
                      <span className="hidden text-xs text-muted-foreground md:inline">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-white/5 px-4 py-3 space-y-3">
                        {issue.description && (
                          <p className="text-sm text-muted-foreground">{issue.description}</p>
                        )}

                        {issue.reporter_wallet && (
                          <p className="text-xs text-muted-foreground">
                            Reporter:{' '}
                            <span className="font-mono">
                              {issue.reporter_wallet.slice(0, 8)}...{issue.reporter_wallet.slice(-4)}
                            </span>
                          </p>
                        )}

                        {issue.admin_notes && (
                          <div className="rounded bg-white/[0.03] p-2">
                            <p className="text-xs font-medium text-muted-foreground">Admin Notes</p>
                            <p className="text-sm text-white">{issue.admin_notes}</p>
                          </div>
                        )}

                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-2">
                          {issue.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => updateIssue(issue.id, { status: 'in_progress' })}
                            >
                              Start Working
                            </Button>
                          )}
                          {(issue.status === 'open' || issue.status === 'in_progress') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-green-400 hover:text-green-300"
                                onClick={() => updateIssue(issue.id, { status: 'resolved' })}
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => updateIssue(issue.id, { status: 'wontfix' })}
                              >
                                Won&apos;t Fix
                              </Button>
                            </>
                          )}
                          {issue.severity !== 'critical' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-400 hover:text-red-300"
                              onClick={() => updateIssue(issue.id, { severity: 'critical' })}
                            >
                              Escalate
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
