import React, { useState, useMemo, useEffect, useCallback } from "react";
import ParentalGate from "@/components/ParentalGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMyPerson } from "@/hooks/useMyPerson";
import {
  Calendar as CalendarIcon, Cake, Plus, Edit, Trash2, ChevronLeft, ChevronRight,
  Eye, EyeOff, Globe, Home, User, Users, MapPin, Clock, X, Check,
  Repeat, Lock, Search as SearchIcon, Download, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer } from "vaul";
import { toast } from "@/components/ui/use-toast";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek,
  endOfWeek, addMonths, subMonths, isBefore, startOfDay, differenceInYears,
  isWithinInterval, parseISO, isSameMonth, differenceInDays, addDays
} from "date-fns";

const API_BASE = '/api';

function getPersonColor(personId) {
  if (!personId) return 'hsl(210, 65%, 55%)';
  const hash = parseInt(personId.slice(0, 8), 16);
  return `hsl(${hash % 360}, 65%, 55%)`;
}

const SCOPE_OPTIONS = [
  { value: 'private', label: 'Mine', icon: User },
  { value: 'galaxy', label: 'Galaxy', icon: Home },
  { value: 'universe', label: 'Everyone', icon: Globe },
];

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', icon: Lock, desc: 'Only you' },
  { value: 'galaxy', label: 'Galaxy', icon: Home, desc: 'Your household' },
  { value: 'universe', label: 'Everyone', icon: Globe, desc: 'All connected family' },
  { value: 'custom', label: 'Custom', icon: Users, desc: 'Specific people' },
];

async function fetchCalendarEvents({ scope, startDate, endDate }) {
  const params = new URLSearchParams({ scope });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const response = await fetch(`${API_BASE}/calendar/events?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch events');
  return response.json();
}

async function createCalendarEvent(data) {
  const response = await fetch(`${API_BASE}/calendar/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create event');
  return response.json();
}

async function updateCalendarEvent(id, data) {
  const response = await fetch(`${API_BASE}/calendar/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update event');
  return response.json();
}

async function deleteCalendarEvent(id) {
  const response = await fetch(`${API_BASE}/calendar/events/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to delete event');
  return response.json();
}

async function fetchGoogleStatus() {
  const response = await fetch(`${API_BASE}/calendar/google/status`, { credentials: 'include' });
  if (!response.ok) return { connected: false };
  return response.json();
}

async function fetchGoogleEvents({ start, end }) {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  const response = await fetch(`${API_BASE}/calendar/google/events?${params}`, { credentials: 'include' });
  if (!response.ok) return [];
  return response.json();
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scope, setScope] = useState('galaxy');
  const [selectedDay, setSelectedDay] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const queryClient = useQueryClient();
  const { data: myPerson } = useMyPerson();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = format(startOfWeek(monthStart), 'yyyy-MM-dd');
  const endDate = format(endOfWeek(monthEnd), 'yyyy-MM-dd');

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['calendarEvents', scope, startDate, endDate],
    queryFn: () => fetchCalendarEvents({ scope, startDate, endDate }),
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: fetchGoogleStatus,
    staleTime: 5 * 60 * 1000,
  });

  const { data: googleEvents = [] } = useQuery({
    queryKey: ['googleEvents', startDate, endDate],
    queryFn: () => fetchGoogleEvents({ start: startDate, end: endDate }),
    enabled: !!googleStatus?.connected,
    staleTime: 2 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCalendarEvent(id),
    onSuccess: () => queryClient.invalidateQueries(['calendarEvents']),
  });

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [currentDate]);

  const birthdays = useMemo(() => {
    return people
      .filter(p => p.birth_date && p.privacy_level !== 'private')
      .map(p => {
        const bd = new Date(p.birth_date + 'T00:00:00');
        return { person: p, month: bd.getMonth(), day: bd.getDate(), birthDate: bd };
      });
  }, [people]);

  const getBirthdaysForDay = useCallback((day) => {
    return birthdays
      .filter(b => b.month === day.getMonth() && b.day === day.getDate())
      .map(b => ({
        type: 'birthday',
        person: b.person,
        age: differenceInYears(day, b.birthDate),
        title: `${b.person.name}'s Birthday`,
      }));
  }, [birthdays]);

  const getEventsForDay = useCallback((day) => {
    return events.filter(e => {
      const eventDate = new Date(e.date + 'T00:00:00');
      if (e.end_date) {
        const end = new Date(e.end_date + 'T00:00:00');
        if (isWithinInterval(day, { start: eventDate, end })) return true;
      } else if (isSameDay(eventDate, day)) {
        return true;
      }
      if (e.is_recurring && e.recurrence_rule) {
        const origin = new Date(e.date + 'T00:00:00');
        if (isBefore(day, origin)) return false;
        const diff = differenceInDays(day, origin);
        if (diff === 0) return false;
        if (e.recurrence_rule === 'weekly' && diff % 7 === 0) return true;
        if (e.recurrence_rule === 'monthly' && day.getDate() === origin.getDate()) return true;
        if (e.recurrence_rule === 'yearly' && day.getDate() === origin.getDate() && day.getMonth() === origin.getMonth()) return true;
      }
      return false;
    });
  }, [events]);

  const getGoogleEventsForDay = useCallback((day) => {
    if (!googleStatus?.connected) return [];
    return googleEvents.filter(e => {
      const eDate = new Date(e.start);
      return isSameDay(eDate, day);
    });
  }, [googleEvents, googleStatus]);

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const upcoming = [];

    birthdays.forEach(b => {
      const thisYear = today.getFullYear();
      const nextBd = new Date(thisYear, b.month, b.day);
      if (isBefore(nextBd, today)) nextBd.setFullYear(thisYear + 1);
      const daysUntil = Math.ceil((nextBd - today) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 30) {
        upcoming.push({
          type: 'birthday', date: nextBd, daysUntil, person: b.person,
          age: differenceInYears(nextBd, b.birthDate),
          title: `${b.person.name}'s Birthday`,
        });
      }
    });

    events.forEach(event => {
      const eventDate = new Date(event.date + 'T00:00:00');
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0 && daysUntil <= 30) {
        upcoming.push({
          type: 'event', date: eventDate, daysUntil, event,
          title: event.title, creatorName: event.creator_name,
        });
      }
      if (event.is_recurring && event.recurrence_rule) {
        const origin = new Date(event.date + 'T00:00:00');
        for (let d = 1; d <= 30; d++) {
          const checkDate = addDays(today, d);
          if (isBefore(checkDate, origin) || isSameDay(checkDate, origin)) continue;
          const diff = differenceInDays(checkDate, origin);
          let matches = false;
          if (event.recurrence_rule === 'weekly' && diff % 7 === 0) matches = true;
          if (event.recurrence_rule === 'monthly' && checkDate.getDate() === origin.getDate()) matches = true;
          if (event.recurrence_rule === 'yearly' && checkDate.getDate() === origin.getDate() && checkDate.getMonth() === origin.getMonth()) matches = true;
          if (matches && !upcoming.some(u => u.event?.id === event.id && u.daysUntil === d)) {
            upcoming.push({
              type: 'event', date: checkDate, daysUntil: d, event,
              title: event.title, creatorName: event.creator_name,
            });
          }
        }
      }
    });

    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [birthdays, events]);

  const groupedUpcoming = useMemo(() => {
    const groups = { today: [], thisWeek: [], thisMonth: [], later: [] };
    upcomingEvents.forEach(item => {
      if (item.daysUntil === 0) groups.today.push(item);
      else if (item.daysUntil <= 7) groups.thisWeek.push(item);
      else if (item.daysUntil <= 30) groups.thisMonth.push(item);
      else groups.later.push(item);
    });
    return groups;
  }, [upcomingEvents]);

  const handleDayClick = (day) => {
    setSelectedDay(day);
  };

  const openAddEvent = (date) => {
    setEditingEvent(null);
    setShowEventForm(true);
    if (date) setSelectedDay(date);
  };

  const openEditEvent = (event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };


  const handleImportGoogleEvent = (ge) => {
    const startDate = ge.start ? ge.start.split('T')[0] : format(selectedDay, 'yyyy-MM-dd');
    const startTime = ge.start && ge.start.includes('T') ? ge.start.split('T')[1]?.slice(0, 5) : '';
    const endTime = ge.end && ge.end.includes('T') ? ge.end.split('T')[1]?.slice(0, 5) : '';
    const endDate = ge.end ? ge.end.split('T')[0] : '';

    setEditingEvent({
      _googleImport: true,
      google_id: ge.google_id,
      title: ge.title || '',
      description: ge.description || '',
      date: startDate,
      start_time: startTime,
      end_time: endTime,
      end_date: endDate !== startDate ? endDate : '',
      location: ge.location || '',
      event_type: 'other',
      visibility: 'galaxy',
    });
    setShowEventForm(true);
  };

  const dayDetailContent = selectedDay && (
    <DayDetail
      day={selectedDay}
      events={getEventsForDay(selectedDay)}
      birthdays={getBirthdaysForDay(selectedDay)}
      googleEvents={getGoogleEventsForDay(selectedDay)}
      people={people}
      myPersonId={myPerson?.id}
      onAddEvent={() => openAddEvent(selectedDay)}
      onEditEvent={openEditEvent}
      onDeleteEvent={(id) => deleteMutation.mutate(id)}
      onClose={() => setSelectedDay(null)}
      googleConnected={googleStatus?.connected}
      scope={scope}
      onImportGoogle={handleImportGoogleEvent}
    />
  );

  return (<ParentalGate featureKey="calendar">
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-amber-400" />
            Family Calendar
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/50">
            {SCOPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                    scope === opt.value
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {googleStatus?.connected ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
              <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {googleStatus.calendarName ? `Synced: ${googleStatus.calendarName}` : 'Google Synced'}
            </Badge>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="w-3 h-3" />
              Google Calendar available in Settings
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-100">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-1.5">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="border-slate-700 text-slate-400 hover:bg-slate-800 h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="border-slate-700 text-slate-400 hover:bg-slate-800 h-8 text-xs">
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="border-slate-700 text-slate-400 hover:bg-slate-800 h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 py-1.5">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const dayEvts = getEventsForDay(day);
              const dayBirthdays = getBirthdaysForDay(day);
              const dayGoogleEvts = getGoogleEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const totalItems = dayEvts.length + dayBirthdays.length + dayGoogleEvts.length;

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={`
                    min-h-[72px] sm:min-h-[88px] p-1.5 rounded-lg border transition-all text-left relative group
                    ${isCurrentMonth ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-900/20 border-slate-800/30'}
                    ${isToday ? 'ring-2 ring-amber-500/70 border-amber-500/30' : ''}
                    ${isSelected ? 'bg-slate-700/50 border-amber-500/50' : ''}
                    hover:bg-slate-700/40 hover:border-slate-600/50
                  `}
                >
                  <div className={`text-xs font-medium mb-1 ${
                    isToday ? 'text-amber-400' :
                    isCurrentMonth ? 'text-slate-200' : 'text-slate-600'
                  }`}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-0.5">
                    {dayBirthdays.slice(0, 1).map((b, i) => (
                      <div key={`b-${i}`} className="flex items-center gap-0.5 text-[10px] sm:text-[11px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 truncate">
                        <Cake className="w-2.5 h-2.5 sm:w-2 sm:h-2 flex-shrink-0" />
                        <span className="truncate">{b.person.name}</span>
                      </div>
                    ))}
                    {dayEvts.slice(0, isMobile ? 1 : 2).map((evt, i) => (
                      <div
                        key={`e-${i}`}
                        className="text-[10px] sm:text-[11px] px-1 py-0.5 rounded text-white truncate"
                        style={{ backgroundColor: getPersonColor(evt.created_by) + '33', color: getPersonColor(evt.created_by) }}
                      >
                        {evt.title}
                      </div>
                    ))}
                    {dayGoogleEvts.slice(0, 1).map((ge, i) => (
                      <div key={`g-${i}`} className="text-[10px] sm:text-[11px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-300 truncate">
                        {ge.title}
                      </div>
                    ))}
                  </div>

                  {totalItems > (isMobile ? 2 : 3) && (
                    <div className="text-[9px] text-slate-500 mt-0.5 px-1">
                      +{totalItems - (isMobile ? 2 : 3)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Upcoming</h3>
              <Button
                size="sm"
                onClick={() => openAddEvent(new Date())}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-7 text-xs px-2"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {groupedUpcoming.today.length > 0 && (
                  <UpcomingGroup label="Today" items={groupedUpcoming.today} onEdit={openEditEvent} onDelete={(id) => deleteMutation.mutate(id)} myPersonId={myPerson?.id} />
                )}
                {groupedUpcoming.thisWeek.length > 0 && (
                  <UpcomingGroup label="This Week" items={groupedUpcoming.thisWeek} onEdit={openEditEvent} onDelete={(id) => deleteMutation.mutate(id)} myPersonId={myPerson?.id} />
                )}
                {groupedUpcoming.thisMonth.length > 0 && (
                  <UpcomingGroup label="This Month" items={groupedUpcoming.thisMonth} onEdit={openEditEvent} onDelete={(id) => deleteMutation.mutate(id)} myPersonId={myPerson?.id} />
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No upcoming events</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobile && selectedDay ? (
        <Drawer.Root open={!!selectedDay} onOpenChange={(open) => { if (!open) setSelectedDay(null); }}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 rounded-t-2xl max-h-[80vh] flex flex-col">
              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-600 my-3" />
              <div className="overflow-y-auto px-4 pb-6 flex-1">
                {dayDetailContent}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ) : selectedDay ? (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900/95 backdrop-blur-sm border-l border-slate-700 z-40 shadow-2xl overflow-y-auto">
          <div className="p-5">
            {dayDetailContent}
          </div>
        </div>
      ) : null}

      {selectedDay && !isMobile && (
        <div className="fixed inset-0 z-30" onClick={() => setSelectedDay(null)} />
      )}

      <EventForm
        open={showEventForm}
        onClose={() => { setShowEventForm(false); setEditingEvent(null); }}
        event={editingEvent}
        people={people}
        defaultDate={selectedDay}
        googleConnected={googleStatus?.connected}
      />
    </div>
  </ParentalGate>);
}

function UpcomingGroup({ label, items, onEdit, onDelete, myPersonId }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {item.type === 'birthday' ? (
                  <div className="flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-slate-200 truncate">{item.person.name}</span>
                    <span className="text-xs text-slate-500">turning {item.age}</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPersonColor(item.event?.created_by) }} />
                      <span className="text-sm text-slate-200 truncate">{item.title}</span>
                    </div>
                    {item.event?.location && (
                      <div className="flex items-center gap-1 mt-0.5 ml-3.5">
                        <MapPin className="w-2.5 h-2.5 text-slate-500" />
                        <span className="text-[10px] text-slate-500 truncate">{item.event.location}</span>
                      </div>
                    )}
                    {item.creatorName && (
                      <span className="text-[10px] text-slate-500 ml-3.5">{item.creatorName}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Badge className={`text-[10px] px-1.5 py-0 ${
                  item.daysUntil === 0 ? "bg-amber-500/30 text-amber-300 border-amber-500/30" :
                  item.daysUntil <= 3 ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                  "bg-slate-700/50 text-slate-400 border-slate-600/30"
                }`}>
                  {item.daysUntil === 0 ? "Today" : item.daysUntil === 1 ? "Tomorrow" : `${item.daysUntil}d`}
                </Badge>
                {item.type === 'event' && item.event?.created_by === myPersonId && (
                  <div className="flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(item.event)} className="p-1 text-slate-500 hover:text-slate-300">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(item.event.id)} className="p-1 text-slate-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayDetail({ day, events, birthdays, googleEvents, people, myPersonId, onAddEvent, onEditEvent, onDeleteEvent, onClose, googleConnected, scope, onImportGoogle }) {
  const visibilityIcon = (vis) => {
    switch (vis) {
      case 'private': return <Lock className="w-3 h-3" />;
      case 'galaxy': return <Home className="w-3 h-3" />;
      case 'universe': return <Globe className="w-3 h-3" />;
      case 'custom': return <Users className="w-3 h-3" />;
      default: return <Home className="w-3 h-3" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{format(day, 'EEEE')}</h3>
          <p className="text-sm text-slate-400">{format(day, 'MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAddEvent} className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" />
            Add Event
          </Button>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {birthdays.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider mb-2">Birthdays</p>
          {birthdays.map((b, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-1.5">
              <Cake className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-sm text-slate-200">{b.person.name}</span>
                <span className="text-xs text-slate-400 ml-2">turning {b.age}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Events</p>
          {events.map((evt, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/40 mb-1.5 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPersonColor(evt.created_by) }} />
                    <span className="text-sm font-medium text-slate-200">{evt.title}</span>
                    {evt.google_event_id && googleConnected && (
                      <svg className="w-3 h-3 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" title="Synced to Google Calendar">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    <span className="text-slate-500" title={evt.visibility || 'galaxy'}>
                      {visibilityIcon(evt.visibility)}
                    </span>
                  </div>
                  {(evt.start_time || evt.location || evt.creator_name) && (
                    <div className="flex flex-wrap gap-3 mt-1.5 ml-[18px]">
                      {evt.start_time && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {evt.start_time.slice(0, 5)}{evt.end_time ? ` - ${evt.end_time.slice(0, 5)}` : ''}
                        </span>
                      )}
                      {evt.location && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3 h-3" />
                          {evt.location}
                        </span>
                      )}
                      {evt.creator_name && (
                        <span className="text-xs text-slate-500">by {evt.creator_name}</span>
                      )}
                    </div>
                  )}
                  {evt.description && (
                    <p className="text-xs text-slate-400 mt-1 ml-[18px]">{evt.description}</p>
                  )}
                </div>
                {evt.created_by === myPersonId && (
                  <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditEvent(evt)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDeleteEvent(evt.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {googleEvents.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-blue-400/70 uppercase tracking-wider mb-2">Google Calendar</p>
          {googleEvents.map((ge, i) => (
            <div key={i} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 mb-1.5 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    <span className="text-sm text-slate-300">{ge.title}</span>
                  </div>
                  {ge.location && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 mt-1 ml-[22px]">
                      <MapPin className="w-3 h-3" /> {ge.location}
                    </span>
                  )}
                  {!ge.all_day && ge.start && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 ml-[22px]">
                      <Clock className="w-3 h-3" /> {format(new Date(ge.start), 'h:mm a')}
                      {ge.end && ` - ${format(new Date(ge.end), 'h:mm a')}`}
                    </span>
                  )}
                </div>
                {onImportGoogle && (
                  <button
                    onClick={() => onImportGoogle(ge)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                    title="Import to StarThread"
                  >
                    <Download className="w-3 h-3" />
                    Import
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && birthdays.length === 0 && googleEvents.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No events on this day</p>
          <Button size="sm" variant="ghost" onClick={onAddEvent} className="text-amber-400 hover:text-amber-300 mt-2 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Add one
          </Button>
        </div>
      )}
    </div>
  );
}

function EventForm({ open, onClose, event, people, defaultDate, googleConnected }) {
  const queryClient = useQueryClient();
  const { data: myPerson } = useMyPerson();
  const [loading, setLoading] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [personSearch, setPersonSearch] = useState('');

  const initialState = {
    title: '', description: '', date: '', end_date: '', start_time: '', end_time: '',
    event_type: 'other', location: '', visibility: 'galaxy', shared_with: [],
    person_ids: [], is_recurring: false, recurrence_rule: '', sync_to_google: false,
  };

  const [formData, setFormData] = useState(initialState);

  const isGoogleImport = !!event?._googleImport;

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        date: event.date || '',
        end_date: event.end_date || '',
        start_time: event.start_time ? event.start_time.slice(0, 5) : '',
        end_time: event.end_time ? event.end_time.slice(0, 5) : '',
        event_type: event.event_type || 'other',
        location: event.location || '',
        visibility: event.visibility || 'galaxy',
        shared_with: event.shared_with || [],
        person_ids: event.person_ids || [],
        is_recurring: event.is_recurring || false,
        recurrence_rule: event.recurrence_rule || '',
        sync_to_google: false,
      });
      setShowCustomPicker(event.visibility === 'custom');
    } else {
      setFormData({
        ...initialState,
        date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
      });
      setShowCustomPicker(false);
    }
  }, [event, defaultDate, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        date: formData.date,
        end_date: formData.end_date || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        event_type: formData.event_type,
        location: formData.location || null,
        visibility: formData.visibility,
        shared_with: formData.visibility === 'custom' ? formData.shared_with : null,
        person_ids: formData.person_ids.length > 0 ? formData.person_ids : null,
        is_recurring: formData.is_recurring,
        recurrence_rule: formData.is_recurring ? formData.recurrence_rule : null,
      };

      let result;
      if (isGoogleImport) {
        const response = await fetch(`${API_BASE}/calendar/google/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            google_id: event.google_id,
            title: payload.title,
            description: payload.description,
            date: payload.date,
            start_time: payload.start_time,
            end_time: payload.end_time,
            end_date: payload.end_date,
            location: payload.location,
            visibility: payload.visibility,
          }),
        });
        if (!response.ok) throw new Error('Import failed');
        result = await response.json();
        toast({ title: 'Event imported to StarThread' });
      } else if (event?.id) {
        result = await updateCalendarEvent(event.id, payload);
      } else {
        result = await createCalendarEvent(payload);
      }

      if (!isGoogleImport && formData.sync_to_google && googleConnected && result?.id) {
        try {
          await fetch(`${API_BASE}/calendar/google/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              event_id: result.id,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          });
        } catch (err) {
          console.error('Failed to sync to Google:', err);
        }
      }

      queryClient.invalidateQueries(['calendarEvents']);
      onClose();
    } catch (err) {
      console.error('Failed to save event:', err);
      toast({ title: isGoogleImport ? 'Failed to import event' : 'Failed to save event', variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredPeople = people.filter(p =>
    p.id !== myPerson?.id &&
    p.name.toLowerCase().includes(personSearch.toLowerCase())
  );

  const toggleSharedWith = (personId) => {
    setFormData(prev => ({
      ...prev,
      shared_with: prev.shared_with.includes(personId)
        ? prev.shared_with.filter(id => id !== personId)
        : [...prev.shared_with, personId]
    }));
  };

  const toggleTaggedPerson = (personId) => {
    setFormData(prev => ({
      ...prev,
      person_ids: prev.person_ids.includes(personId)
        ? prev.person_ids.filter(id => id !== personId)
        : [...prev.person_ids, personId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {isGoogleImport ? 'Import from Google Calendar' : event ? 'Edit Event' : 'New Event'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="Event title"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Start Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">End Date</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
                placeholder="Same day"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Start Time</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">End Time</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100 pl-8"
                placeholder="Add location"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="Event details"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Type</Label>
              <Select value={formData.event_type} onValueChange={(v) => setFormData({ ...formData, event_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="anniversary">Anniversary</SelectItem>
                  <SelectItem value="celebration">Celebration</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Who Can See This</Label>
              <Select
                value={formData.visibility}
                onValueChange={(v) => {
                  setFormData({ ...formData, visibility: v });
                  setShowCustomPicker(v === 'custom');
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {VISIBILITY_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{opt.label}</span>
                          <span className="text-xs text-slate-500 ml-1">({opt.desc})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showCustomPicker && (
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Share with specific people</Label>
              <Input
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
                placeholder="Search family members..."
              />
              <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                {filteredPeople.slice(0, 10).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSharedWith(p.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                      formData.shared_with.includes(p.id)
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    {formData.shared_with.includes(p.id) && <Check className="w-3 h-3 text-amber-400" />}
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked, recurrence_rule: e.target.checked ? 'weekly' : '' })}
                className="rounded border-slate-600 bg-slate-800 text-amber-500"
              />
              <span className="text-sm text-slate-300 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5" /> Recurring event
              </span>
            </label>
            {formData.is_recurring && (
              <Select value={formData.recurrence_rule} onValueChange={(v) => setFormData({ ...formData, recurrence_rule: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {googleConnected && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sync_to_google}
                onChange={(e) => setFormData({ ...formData, sync_to_google: e.target.checked })}
                className="rounded border-slate-600 bg-slate-800 text-amber-500"
              />
              <span className="text-sm text-slate-300 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sync to Google Calendar
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 h-8 text-sm">
              Cancel
            </Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-8 text-sm" disabled={loading}>
              {loading ? "Saving..." : isGoogleImport ? "Import Event" : (event ? "Update" : "Create Event")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
