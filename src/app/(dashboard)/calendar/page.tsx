import type { Metadata } from 'next';
import { ContentCalendar } from '@/components/features/content-calendar';

export const metadata: Metadata = {
  title: 'Content Calendar — ozskr.ai',
};

export default function CalendarPage() {
  return <ContentCalendar />;
}
