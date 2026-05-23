import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { useEffect, useMemo, useState } from 'react';

interface ParentPlannerCalendarPanelProps {
  events: EventInput[];
  onSelectSlot?: (slot: DateSelectArg) => void;
  onClickEvent?: (arg: EventClickArg) => void;
  onEventDrop?: (arg: EventDropArg) => void;
  onEventResize?: (arg: { event: { id: string; start: Date | null; end: Date | null } ; revert: () => void }) => void;
}

export function ParentPlannerCalendarPanel({ events, onSelectSlot, onClickEvent, onEventDrop, onEventResize }: ParentPlannerCalendarPanelProps) {
  const plugins = useMemo(() => [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin], []);
  const [isCompact, setIsCompact] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia('(max-width: 640px)').matches));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(max-width: 640px)');
    const handleChange = () => setIsCompact(query.matches);
    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return (
    <section className="parent-planner-calendar min-w-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-2 shadow-[0_20px_65px_rgba(0,0,0,0.28)] sm:rounded-3xl sm:p-4 [&_.fc]:text-white [&_.fc-button]:bg-white/10 [&_.fc-button]:border-white/20 [&_.fc-button]:text-white">
      <FullCalendar
        plugins={plugins}
        initialView={isCompact ? 'listWeek' : 'dayGridMonth'}
        headerToolbar={isCompact ? { left: 'prev,next', center: 'title', right: 'today listWeek' } : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
        buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'List' }}
        scrollTime="07:00:00"
        events={events}
        selectable
        editable
        selectMirror
        dayMaxEvents
        height={isCompact ? 520 : 'auto'}
        progressiveEventRendering
        nowIndicator
        eventDisplay="block"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
        select={onSelectSlot}
        eventClick={onClickEvent}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
      />
    </section>
  );
}
