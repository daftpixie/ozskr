/**
 * Settings Page
 * User preferences and account settings (Phase 2+ placeholder)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, User, Bell, Shield } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Customize your journey
        </p>
      </div>

      {/* Coming Soon */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Settings Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-solana-purple/10">
              <SettingsIcon className="h-10 w-10 text-solana-purple" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-white">
              Account Settings
            </h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              Customize your profile, notification preferences, and security
              settings. Full settings interface coming soon.
            </p>
          </div>

          {/* Preview Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-purple/10">
                <User className="h-5 w-5 text-solana-purple" />
              </div>
              <h4 className="font-medium text-white">Profile</h4>
              <p className="text-sm text-muted-foreground">
                Display name, avatar, and bio customization
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-green/10">
                <Bell className="h-5 w-5 text-solana-green" />
              </div>
              <h4 className="font-medium text-white">Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Configure alerts for agent activity and updates
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brick-gold/10">
                <Shield className="h-5 w-5 text-brick-gold" />
              </div>
              <h4 className="font-medium text-white">Security</h4>
              <p className="text-sm text-muted-foreground">
                Wallet management and session settings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
