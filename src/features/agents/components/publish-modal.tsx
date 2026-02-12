/**
 * Publish Modal
 * Modal for publishing generated content to social platforms
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, Check, AlertCircle, ExternalLink, Twitter, Instagram, Youtube } from 'lucide-react';
import { useSocialAccounts, usePublishContent } from '@/hooks/use-social';
import { SocialPlatform, SocialPostStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import type { SocialPostResponse } from '@/types/social';

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentGenerationId: string;
  outputText?: string | null;
  outputUrl?: string | null;
}

const PLATFORM_ICONS = {
  [SocialPlatform.TWITTER]: Twitter,
  [SocialPlatform.INSTAGRAM]: Instagram,
  [SocialPlatform.TIKTOK]: Youtube,
  [SocialPlatform.YOUTUBE]: Youtube,
};

const PLATFORM_LABELS = {
  [SocialPlatform.TWITTER]: 'Twitter',
  [SocialPlatform.INSTAGRAM]: 'Instagram',
  [SocialPlatform.TIKTOK]: 'TikTok',
  [SocialPlatform.YOUTUBE]: 'YouTube',
};

export function PublishModal({
  open,
  onOpenChange,
  contentGenerationId,
  outputText,
  outputUrl,
}: PublishModalProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [caption, setCaption] = useState(outputText || '');
  const [publishedPosts, setPublishedPosts] = useState<SocialPostResponse[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useSocialAccounts();
  const { mutate: publishContent, isPending } = usePublishContent();

  const connectedAccounts = accounts?.filter(acc => acc.isConnected) || [];

  const togglePlatform = (accountId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handlePublish = () => {
    if (selectedPlatforms.length === 0) return;

    publishContent(
      {
        contentGenerationId,
        socialAccountIds: selectedPlatforms,
      },
      {
        onSuccess: (response) => {
          setPublishedPosts(response.posts);
          setIsPublished(true);
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSelectedPlatforms([]);
      setCaption(outputText || '');
      setPublishedPosts([]);
      setIsPublished(false);
    }, 300);
  };

  const getPostStatusColor = (status: SocialPostStatus) => {
    switch (status) {
      case SocialPostStatus.POSTED:
        return 'text-solana-green';
      case SocialPostStatus.FAILED:
        return 'text-destructive';
      case SocialPostStatus.QUEUED:
        return 'text-[#F59E0B]';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPostStatusIcon = (status: SocialPostStatus) => {
    switch (status) {
      case SocialPostStatus.POSTED:
        return <Check className="h-5 w-5 text-solana-green" />;
      case SocialPostStatus.FAILED:
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case SocialPostStatus.QUEUED:
        return <Loader2 className="h-5 w-5 animate-spin text-[#F59E0B]" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish Content</DialogTitle>
          <DialogDescription>
            Share your generated content to connected social platforms
          </DialogDescription>
        </DialogHeader>

        {!isPublished ? (
          <div className="space-y-4">
            {/* Content Preview */}
            <Card className="border-border/50 bg-card p-4">
              <div className="space-y-3">
                <Label className="text-sm">Content Preview</Label>
                {outputUrl && (
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                    <Image
                      src={outputUrl}
                      alt="Generated content"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 600px"
                    />
                  </div>
                )}
                {outputText && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {outputText}
                  </p>
                )}
              </div>
            </Card>

            {/* Caption Editor */}
            {outputText && (
              <div className="space-y-2">
                <Label htmlFor="caption">Caption (optional)</Label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder="Edit caption before publishing..."
                />
                <p className="text-xs text-muted-foreground">
                  {caption.length}/5000 characters
                </p>
              </div>
            )}

            {/* Platform Selection */}
            <div className="space-y-2">
              <Label>Select Platforms</Label>
              {accountsLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : connectedAccounts.length === 0 ? (
                <Card className="border-border/50 bg-card p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No connected social accounts. Connect accounts in settings to publish.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {connectedAccounts.map(account => {
                    const Icon = PLATFORM_ICONS[account.platform];
                    const isSelected = selectedPlatforms.includes(account.id);

                    return (
                      <button
                        key={account.id}
                        onClick={() => togglePlatform(account.id)}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-3 transition-colors',
                          'hover:border-solana-purple hover:bg-solana-purple/5',
                          isSelected && 'border-solana-purple bg-solana-purple/10'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            isSelected ? 'bg-solana-purple' : 'bg-muted'
                          )}>
                            <Icon className={cn(
                              'h-5 w-5',
                              isSelected ? 'text-white' : 'text-muted-foreground'
                            )} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-white">
                              {PLATFORM_LABELS[account.platform]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              @{account.platformUsername}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 text-solana-purple" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Publish Button */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={selectedPlatforms.length === 0 || isPending}
                className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  `Publish to ${selectedPlatforms.length} Platform${selectedPlatforms.length === 1 ? '' : 's'}`
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Message */}
            <Card className="border-solana-green/20 bg-solana-green/5 p-6">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-solana-green" />
                <div className="flex-1">
                  <h3 className="font-medium text-solana-green">
                    Content Queued for Publishing
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your content has been queued and will be published shortly.
                  </p>
                </div>
              </div>
            </Card>

            {/* Post Status */}
            <div className="space-y-2">
              <Label>Post Status</Label>
              <div className="space-y-2">
                {publishedPosts.map(post => {
                  const account = connectedAccounts.find(acc => acc.id === post.socialAccountId);
                  const Icon = account ? PLATFORM_ICONS[account.platform] : null;

                  return (
                    <Card
                      key={post.id}
                      className="border-border/50 bg-card p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {Icon && (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {account ? PLATFORM_LABELS[account.platform] : 'Unknown Platform'}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={cn('text-xs', getPostStatusColor(post.status))}
                              >
                                {post.status}
                              </Badge>
                              {post.postUrl && (
                                <a
                                  href={post.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-solana-purple hover:underline"
                                >
                                  View Post
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        {getPostStatusIcon(post.status)}
                      </div>
                      {post.errorMessage && (
                        <p className="mt-2 text-xs text-destructive">
                          Error: {post.errorMessage}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
