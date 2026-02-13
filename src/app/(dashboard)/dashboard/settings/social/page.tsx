/**
 * Social Accounts Settings Page
 * Manage connected social media platforms
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Twitter, Instagram, Youtube, Check, AlertCircle, Unplug } from 'lucide-react';
import { useSocialAccounts, useDisconnectSocialAccount } from '@/hooks/use-social';
import { SocialPlatform } from '@/types/database';
import { cn } from '@/lib/utils';

const PLATFORM_CONFIG = {
  [SocialPlatform.TWITTER]: {
    name: 'Twitter',
    icon: Twitter,
    color: 'from-[#1DA1F2] to-[#1DA1F2]',
    description: 'Connect your Twitter account to publish tweets and threads.',
  },
  [SocialPlatform.INSTAGRAM]: {
    name: 'Instagram',
    icon: Instagram,
    color: 'from-[#E1306C] to-[#F77737]',
    description: 'Connect your Instagram account to publish posts and stories.',
  },
  [SocialPlatform.TIKTOK]: {
    name: 'TikTok',
    icon: Youtube,
    color: 'from-[#000000] to-[#69C9D0]',
    description: 'Connect your TikTok account to publish videos.',
  },
  [SocialPlatform.YOUTUBE]: {
    name: 'YouTube',
    icon: Youtube,
    color: 'from-[#FF0000] to-[#FF0000]',
    description: 'Connect your YouTube account to publish videos.',
  },
};

export default function SocialAccountsPage() {
  const { data: accounts, isLoading } = useSocialAccounts();
  const { mutate: disconnectAccount, isPending: isDisconnecting } = useDisconnectSocialAccount();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleDisconnect = (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;

    setDisconnectingId(accountId);
    disconnectAccount(accountId, {
      onSettled: () => {
        setDisconnectingId(null);
      },
    });
  };

  const handleConnect = (platform: SocialPlatform) => {
    alert(`OAuth connection flow for ${PLATFORM_CONFIG[platform].name} will be implemented with Ayrshare integration.`);
  };

  const getConnectedAccount = (platform: SocialPlatform) => {
    return accounts?.find(acc => acc.platform === platform && acc.isConnected);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Social Accounts</h1>
        <p className="mt-2 text-muted-foreground">
          Connect your channels and share the magic
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Platform Cards */}
      {!isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
            const Icon = config.icon;
            const connectedAccount = getConnectedAccount(platform as SocialPlatform);
            const isConnected = !!connectedAccount;
            const isDisconnectingThis = disconnectingId === connectedAccount?.id;

            return (
              <Card
                key={platform}
                className={cn(
                  'border-border/50 bg-card transition-all',
                  isConnected && 'border-solana-green/30'
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full',
                        'bg-gradient-to-br',
                        config.color
                      )}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{config.name}</CardTitle>
                        {isConnected && connectedAccount && (
                          <Badge variant="secondary" className="mt-1 text-xs text-solana-green">
                            <Check className="mr-1 h-3 w-3" />
                            Connected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CardDescription className="mt-3">
                    {config.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isConnected && connectedAccount ? (
                    <div className="space-y-4">
                      {/* Connected Account Info */}
                      <div className="rounded-lg border border-border bg-muted/50 p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">
                            @{connectedAccount.platformUsername}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Connected on {new Date(connectedAccount.connectedAt).toLocaleDateString()}
                          </p>
                          {connectedAccount.lastPostedAt && (
                            <p className="text-xs text-muted-foreground">
                              Last posted: {new Date(connectedAccount.lastPostedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Disconnect Button */}
                      <Button
                        variant="outline"
                        onClick={() => handleDisconnect(connectedAccount.id)}
                        disabled={isDisconnecting}
                        className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        {isDisconnectingThis ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <Unplug className="mr-2 h-4 w-4" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Not Connected Info */}
                      <div className="rounded-lg border border-border bg-muted/50 p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            Not connected. Connect your account to publish content to {config.name}.
                          </p>
                        </div>
                      </div>

                      {/* Connect Button */}
                      <Button
                        onClick={() => handleConnect(platform as SocialPlatform)}
                        className={cn(
                          'w-full bg-gradient-to-r hover:opacity-90',
                          config.color
                        )}
                      >
                        Connect {config.name}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Help Section */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Social media accounts are connected via Ayrshare OAuth flow. Once connected,
            you can publish AI-generated content directly from the dashboard.
          </p>
          <p>
            Only approved content that passes moderation can be published to your
            connected platforms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
