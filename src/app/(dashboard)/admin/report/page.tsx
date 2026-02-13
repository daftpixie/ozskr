'use client';

/**
 * Admin Alpha Report Page
 * Displays aggregated alpha metrics with markdown export.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Download,
  Users,
  Zap,
  Bug,
  DollarSign,
  MessageSquare,
} from 'lucide-react';

interface ReportData {
  generatedAt: string;
  period: { start: string; end: string };
  users: { total: number; activeThisWeek: number; whitelisted: number; waitlisted: number };
  content: { totalGenerations: number; totalPublishes: number; generationsThisWeek: number };
  issues: { total: number; open: number; critical: number; resolved: number };
  costs: { totalUsd: number; aiCostUsd: number; socialCostUsd: number };
  feedback: { totalSurveys: number; avgRating: number | null };
}

export default function AdminReportPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('ozskr_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        setIsAdmin(false);
        return;
      }

      const res = await fetch('/api/admin-report', { headers });
      if (res.status === 404) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
      const data = await res.json() as ReportData;
      setReport(data);
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const downloadMarkdown = async () => {
    const headers = getAuthHeaders();
    const res = await fetch('/api/admin-report/markdown', { headers });
    if (!res.ok) return;

    const text = await res.text();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ozskr-alpha-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <span className="ml-3 text-sm text-muted-foreground">Generating report...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Alpha Report</h1>
          <p className="text-sm text-muted-foreground">
            {report ? `Generated ${new Date(report.generatedAt).toLocaleString()}` : 'Platform metrics overview'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchReport} className="text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadMarkdown}>
            <Download className="mr-2 h-4 w-4" />
            Export .md
          </Button>
        </div>
      </div>

      {report && (
        <>
          {/* Users Section */}
          <Card className="border-white/5 bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-solana-purple" />
                Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCell label="Total" value={report.users.total} />
                <StatCell label="Active This Week" value={report.users.activeThisWeek} />
                <StatCell label="Whitelisted" value={report.users.whitelisted} />
                <StatCell label="Waitlisted" value={report.users.waitlisted} />
              </div>
            </CardContent>
          </Card>

          {/* Content Section */}
          <Card className="border-white/5 bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-solana-green" />
                Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <StatCell label="Total Generations" value={report.content.totalGenerations} />
                <StatCell label="This Week" value={report.content.generationsThisWeek} />
                <StatCell label="Total Publishes" value={report.content.totalPublishes} />
              </div>
            </CardContent>
          </Card>

          {/* Issues Section */}
          <Card className="border-white/5 bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bug className="h-4 w-4 text-brick-gold" />
                Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCell label="Total" value={report.issues.total} />
                <StatCell label="Open" value={report.issues.open} color="text-yellow-400" />
                <StatCell label="Critical" value={report.issues.critical} color="text-red-400" />
                <StatCell label="Resolved" value={report.issues.resolved} color="text-green-400" />
              </div>
            </CardContent>
          </Card>

          {/* Costs + Feedback */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-solana-purple" />
                  Costs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">AI Inference</span>
                    <span className="font-mono text-white">${report.costs.aiCostUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Social Publishing</span>
                    <span className="font-mono text-white">${report.costs.socialCostUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2 text-sm font-medium">
                    <span className="text-white">Total</span>
                    <span className="font-mono text-white">${report.costs.totalUsd.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-solana-green" />
                  Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <StatCell label="Total Surveys" value={report.feedback.totalSurveys} />
                  <StatCell
                    label="Avg Rating"
                    value={report.feedback.avgRating !== null ? `${report.feedback.avgRating}/5` : 'N/A'}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className={`font-display text-xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
