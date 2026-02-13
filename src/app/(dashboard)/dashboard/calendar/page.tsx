/**
 * Content Calendar Page
 * Monthly calendar view showing scheduled content generation events
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Play, Calendar as CalendarIcon } from 'lucide-react';
import { useContentSchedules, useTriggerSchedule } from '@/hooks/use-schedules';
import { useCharacters } from '@/hooks/use-characters';
import { ScheduleModal } from '@/features/agents/components/schedule-modal';
import { cn } from '@/lib/utils';
import { ScheduleContentType } from '@/types/database';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: schedulesData, isLoading } = useContentSchedules();
  const { data: charactersData } = useCharacters();
  const triggerSchedule = useTriggerSchedule();

  const schedules = schedulesData?.data || [];
  const characters = charactersData?.data || [];

  // Get month details
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Navigate months
  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  // Check if a date has scheduled items
  const getSchedulesForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.filter(schedule => {
      const nextRun = schedule.nextRunAt.split('T')[0];
      return nextRun === dateStr && schedule.isActive;
    });
  };

  // Check if date is today
  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day &&
           today.getMonth() === month &&
           today.getFullYear() === year;
  };

  // Color coding for content types
  const getContentTypeColor = (type: ScheduleContentType) => {
    switch (type) {
      case ScheduleContentType.TEXT:
        return 'bg-solana-purple/20 border-solana-purple';
      case ScheduleContentType.IMAGE:
        return 'bg-solana-green/20 border-solana-green';
      case ScheduleContentType.VIDEO:
        return 'bg-[#F59E0B]/20 border-[#F59E0B]';
      default:
        return 'bg-muted border-border';
    }
  };

  // Get schedules for selected date
  const selectedDateSchedules = selectedDate
    ? getSchedulesForDate(selectedDate.getDate())
    : [];

  // Generate calendar grid
  const calendarDays = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Content Calendar</h1>
          <p className="mt-2 text-muted-foreground">
            Plan your journey along the yellow brick road
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Schedule
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar View */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {monthNames[month]} {year}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToToday}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={previousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={nextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex h-96 items-center justify-center">
                  <p className="text-muted-foreground">Loading calendar...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div
                        key={day}
                        className="p-2 text-center text-xs font-medium text-muted-foreground"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day, index) => {
                      if (day === null) {
                        return <div key={`empty-${index}`} className="aspect-square" />;
                      }

                      const daySchedules = getSchedulesForDate(day);
                      const hasSchedules = daySchedules.length > 0;
                      const isTodayDate = isToday(day);
                      const isSelected = selectedDate?.getDate() === day;

                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDate(new Date(year, month, day))}
                          className={cn(
                            'aspect-square rounded-lg border p-2 text-sm transition-colors',
                            'hover:border-solana-purple hover:bg-solana-purple/5',
                            isSelected && 'border-solana-purple bg-solana-purple/10',
                            isTodayDate && 'border-solana-green font-bold text-solana-green',
                            !hasSchedules && !isTodayDate && 'border-border text-muted-foreground'
                          )}
                        >
                          <div className="space-y-1">
                            <div className="text-left">{day}</div>
                            {hasSchedules && (
                              <div className="flex flex-wrap gap-1">
                                {daySchedules.slice(0, 2).map((schedule) => (
                                  <div
                                    key={schedule.id}
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full',
                                      schedule.contentType === ScheduleContentType.TEXT && 'bg-solana-purple',
                                      schedule.contentType === ScheduleContentType.IMAGE && 'bg-solana-green',
                                      schedule.contentType === ScheduleContentType.VIDEO && 'bg-[#F59E0B]'
                                    )}
                                  />
                                ))}
                                {daySchedules.length > 2 && (
                                  <span className="text-[8px] text-muted-foreground">
                                    +{daySchedules.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Day Details */}
        <div className="lg:col-span-1">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarIcon className="h-5 w-5" />
                {selectedDate
                  ? `${monthNames[selectedDate.getMonth()]} ${selectedDate.getDate()}`
                  : 'Select a date'
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate && selectedDateSchedules.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateSchedules.map((schedule) => {
                    const character = characters.find(c => c.id === schedule.characterId);
                    return (
                      <Card
                        key={schedule.id}
                        className={cn(
                          'border p-3',
                          getContentTypeColor(schedule.contentType)
                        )}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {schedule.contentType}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(schedule.nextRunAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => triggerSchedule.mutate(schedule.id)}
                                disabled={triggerSchedule.isPending}
                                title="Run now"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {character && (
                            <p className="text-sm font-medium text-white">
                              {character.name}
                            </p>
                          )}
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {schedule.promptTemplate}
                          </p>
                          {schedule.scheduleType === 'recurring' && (
                            <Badge variant="outline" className="text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : selectedDate ? (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-center text-sm text-muted-foreground">
                    No scheduled items for this date
                  </p>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-center text-sm text-muted-foreground">
                    Click on a date to view scheduled items
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="mt-4 border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-solana-purple" />
                <span className="text-xs text-muted-foreground">Text</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-solana-green" />
                <span className="text-xs text-muted-foreground">Image</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                <span className="text-xs text-muted-foreground">Video</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule Creation Modal */}
      <ScheduleModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
