import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { useMemo } from 'react';

interface ParentPlannerCalendarPanelProps {
  events: EventInput[];
  onSelectSlot?: (slot: DateSelectArg) => void;
  onClickEvent?: (arg: EventClickArg) => void;
  onEventDrop?: (arg: EventDropArg) => void;
  onEventResize?: (arg: { event: { id: string; start: Date | null; end: Date | null } ; revert: () => void }) => void;
}

export function ParentPlannerCalendarPanel({ events, onSelectSlot, onClickEvent, onEventDrop, onEventResize }: ParentPlannerCalendarPanelProps) {
  const plugins = useMemo(() => [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin], []);

  return (
    <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-4 shadow-[0_20px_65px_rgba(0,0,0,0.28)] [&_.fc]:text-white [&_.fc-button]:bg-white/10 [&_.fc-button]:border-white/20 [&_.fc-button]:text-white">
      <FullCalendar
        plugins={plugins}
        initialView="dayGridMonth"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
        scrollTime="07:00:00"
        events={events}
        selectable
        editable
        selectMirror
        dayMaxEvents
        height="auto"
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
