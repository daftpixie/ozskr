'use client';

/**
 * Profile Step Component
 * Collects user display name and content categories
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';

const CONTENT_CATEGORIES = [
  'crypto',
  'art',
  'tech',
  'lifestyle',
  'gaming',
  'memes',
] as const;

interface ProfileStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ProfileStep({ onNext, onBack }: ProfileStepProps) {
  const [displayName, setDisplayName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleContinue = () => {
    // For MVP, we're just storing selections in component state
    // In production, this would be saved to the user profile
    onNext();
  };

  return (
    <div className="animate-fade-in-up">
      <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-solana-purple to-solana-green">
            <User className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="font-display text-2xl text-white">
            Set Up Your Profile
          </CardTitle>
          <CardDescription className="mt-2 text-light-gray">
            Tell us a bit about yourself and your content interests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display Name Input */}
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium text-white">
              Display Name <span className="text-soft-gray">(optional)</span>
            </label>
            <Input
              id="displayName"
              type="text"
              placeholder="What should we call you?"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-void-black border-mid-gray text-white placeholder:text-soft-gray"
            />
          </div>

          {/* Content Categories */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white">
              Content Interests <span className="text-soft-gray">(select any)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.has(category);
                return (
                  <Badge
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`cursor-pointer px-4 py-2 text-sm transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white border-transparent'
                        : 'bg-void-black text-light-gray border-mid-gray hover:border-solana-purple'
                    }`}
                    variant="outline"
                  >
                    {category}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-4">
            <Button onClick={onBack} variant="outline">
              Back
            </Button>
            <Button
              onClick={handleContinue}
              className="bg-gradient-to-r from-solana-purple to-solana-green text-white hover:opacity-90"
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
