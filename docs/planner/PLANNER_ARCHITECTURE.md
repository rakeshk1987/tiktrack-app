# TikTrack Planner Overhaul (Master Calendar Architecture)

## 1) Product Architecture

TikTrack Planner becomes a **single master calendar system** used by both child and parent experiences.

- Single source of truth: `events` collection
- Program-driven scheduling: `programs` + `event_templates`
- Calendar-first UX: month/week/day/list views
- Child view: Focused two-tab layout ("Calendar" and "Activities"). Activities created by the parent are grouped under the "Activities" tab for clarity.
- Parent view = full control, recurring editor, conflict and burnout visibility

Core design principles:
- Mobile-first for Android PWA
- Dark premium minimal visual language
- One shared data model with role-based UI capabilities
- Future-proof for Google Calendar sync (without OAuth implementation now)

---

## 2) Module & Folder Structure

```txt
src/features/planner/
  types/
    planner.types.ts
  constants/
    planner.constants.ts
  utils/
    planner.time.ts
    planner.recurrence.ts
    planner.conflicts.ts
    planner.burnout.ts
    planner.agenda.ts
  services/
    planner.firestore.ts
    planner.sync.adapter.ts
  hooks/
    usePlannerEvents.ts
    usePlannerPrograms.ts
    usePlannerInsights.ts
  components/
    shared/
      PlannerShell.tsx
      PlannerFilterBar.tsx
      PlannerLegend.tsx
      PlannerEventChip.tsx
      PlannerEventModal.tsx
      PlannerAgendaList.tsx
      PlannerConflictBanner.tsx
    child/
      ChildPlannerHero.tsx
      ChildTodayAgenda.tsx
      ChildUpcomingRail.tsx
      ChildExamCountdown.tsx
      ChildQuestTimeline.tsx
      ChildQuickAdd.tsx
    parent/
      ParentPlannerSidebar.tsx
      ParentPlannerCalendarPanel.tsx
      ParentProgramManager.tsx
      ParentRecurringEditor.tsx
      ParentWeeklyOverview.tsx
      ParentConflictPanel.tsx
      ParentBurnoutPanel.tsx
      ParentExamTracker.tsx
      ParentSyncStatus.tsx
      SchoolTimetableTable.tsx
  pages/
    ChildPlannerV2Page.tsx
    ParentPlannerV2Page.tsx
```

---

## 3) Firestore Schema (Collections)

### `programs`
Document id: `programId`

```ts
{
  family_id: string,
  child_id: string,
  name: string,
  icon: string,
  color: string,
  category: 'school' | 'tuition' | 'extracurricular' | 'exam' | 'personal' | 'custom',
  reminder_defaults: {
    minutes_before: number[],
    push_enabled: boolean
  },
  recurrence_rule: string | null, // RRULE-ish string for template default
  is_active: boolean,
  created_by: 'parent' | 'system',
  created_at: string,
  updated_at: string
}
```

### `events` (MASTER CALENDAR)
Document id: `eventId`

```ts
{
  family_id: string,
  child_id: string,
  parent_id: string,
  title: string,
  description: string,
  category: 'school' | 'exam' | 'homework' | 'extracurricular' | 'tuition' | 'personal' | 'custom' | 'holiday' | 'rest_day',
  color: string,
  start_at: string, // ISO
  end_at: string,   // ISO
  all_day: boolean,
  timezone: string,
  recurrence: {
    type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
    interval: number,
    by_week_days: number[],
    by_month_days: number[],
    until: string | null,
    count: number | null,
    rrule: string | null
  },
  linked_program_id: string | null,
  linked_task_ids: string[],
  participant_ids: string[],
  reminder_ids: string[],
  source: 'manual' | 'program' | 'automation' | 'import',
  sync: {
    google_enabled: boolean,
    google_event_id: string | null,
    sync_status: 'not_configured' | 'pending' | 'synced' | 'failed',
    last_sync_at: string | null,
    sync_error: string | null
  },
  created_by: 'parent' | 'child' | 'system',
  created_at: string,
  updated_at: string,
  deleted_at: string | null
}
```

### `event_reminders`
```ts
{
  event_id: string,
  family_id: string,
  child_id: string,
  remind_at: string,
  offset_minutes: number,
  channel: 'push' | 'in_app',
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled',
  created_at: string,
  updated_at: string
}
```

### `event_participants`
```ts
{
  event_id: string,
  user_id: string,
  role: 'child' | 'parent' | 'co_parent',
  response: 'pending' | 'accepted' | 'declined',
  created_at: string,
  updated_at: string
}
```

### `event_templates`
```ts
{
  family_id: string,
  child_id: string,
  program_id: string | null,
  name: string,
  category: string,
  duration_minutes: number,
  recurrence_rule: string,
  default_start_time: string,
  default_end_time: string,
  default_reminder_offsets: number[],
  is_active: boolean,
  created_at: string,
  updated_at: string
}
```

### `calendar_sync`
```ts
{
  family_id: string,
  provider: 'google',
  status: 'not_connected' | 'connected' | 'token_expired' | 'error',
  calendars: {
    father_calendar_id: string | null,
    mother_calendar_id: string | null,
    child_calendar_id: string | null
  },
  sync_scope: {
    push_events: boolean,
    pull_events: boolean
  },
  last_sync_at: string | null,
  last_error: string | null,
  updated_at: string
}
```

---

## 4) UX Wireframe (Mobile)

- Top Tab Navigation: [Calendar] [Activities]
- "Activities" Tab: Hosts all parent-created programs/activities as sub-tabs.
- Floating bottom-right: quick add event/reminder (personal)
- Bottom nav: Home, Quests, Planner, Diary, Rewards

Interaction:
- Tap event -> compact bottom sheet (view/edit)
- Long press on day -> quick create modal
- Swipe left/right in agenda -> day navigation

---

## 5) UX Wireframe (Web)

Desktop split layout:
- Left sidebar: mini calendar, program filters, category toggles, quick actions
- Center: FullCalendar month/week/day/list panel (drag/drop enabled)
- Right panel: upcoming events, conflicts, burnout warning, exam tracker, sync status

Parent actions:
- Create program
- Create recurring schedule from template
- Drag event to reschedule
- Resolve overlap from conflict panel

Child actions:
- View today agenda
- Add personal reminder
- Mark planner-linked tasks complete

---

## 6) Responsive Strategy

- `sm`: agenda-first, list view, sticky action bar
- `md`: stacked calendar + insights cards
- `lg+`: 3-column planner shell (sidebar, calendar, insights)
- Event modal:
  - Mobile: bottom sheet (`max-h-[85vh]`)
  - Desktop: centered modal
- Touch targets minimum `44px`

---

## 7) Event Data Flow

1. Parent/child creates event/program.
2. UI validates payload and writes to Firestore via service layer.
3. If recurring rule exists, expansion engine computes visible instances for viewport.
4. Derived reminders are scheduled in `event_reminders`.
5. Insights engine computes:
   - conflicts
   - overload score
   - exam pressure windows
6. Child page consumes reduced read-model (today/upcoming summaries).

---

## 8) Recurring Logic

- Store canonical recurrence object + optional `rrule` string.
- Expand occurrences only for visible range (e.g., current month + buffer) to keep reads light.
- Support exceptions using `exdate` and detached instances in future iteration.

Algorithm (range expansion):
- Input: base event + recurrence + `rangeStart/rangeEnd`
- Iterate recurrence steps by interval
- Include instances that intersect range
- Respect `until` / `count`
- Return normalized instance list with deterministic `instance_id`

---

## 9) Conflict Detection Logic

Conflict when any two events for same child overlap in time:

- Sort by start time
- For each event, compare with next in sorted order
- Conflict if `next.start < current.end`
- Tag severity:
  - high: exam overlap
  - medium: school/tuition overlap
  - low: personal overlap

UI:
- Parent sees conflict banner + list with “Resolve” action
- Child sees simplified note (“Two activities overlap at 5:00 PM”)

---

## 10) Burnout Detection Strategy

Weekly workload score:
- Base load = total scheduled hours (weighted)
- Weight multipliers:
  - exam: 1.4
  - tuition: 1.2
  - extracurricular: 1.0
  - rest_day: -1.0 protective credit
- Consecutive busy days penalty
- Late-evening events penalty for school nights

Thresholds:
- `score >= 24`: heavy schedule warning
- `score >= 30`: burnout risk alert + suggest rest day

Recommendations:
- Auto-suggest one `rest_day`
- Suppress non-essential extracurricular cards in child exam mode week

---

## 11) School Timetable (Tabular)

Render timetable as table grid (not cards):
- Columns: Mon, Tue, Wed, Thu, Fri
- Rows: Period 1..N
- Cell: subject + optional room/teacher
- Responsive fallback on mobile: horizontal scroll table with sticky first column

---

## 12) State Management

- Keep global auth/profile in existing context
- Planner uses feature hooks with memoized selectors:
  - `usePlannerEvents(range, filters)`
  - `usePlannerPrograms()`
  - `usePlannerInsights(events)`
- No heavy global state library required initially
- Mock Data Policy: Mock data fallbacks are disabled (`useMockFallback: false`) in production to ensure only real data from Firestore is displayed.
- Cache strategy:
  - Firestore real-time for active month range
  - local derived memo for agenda and insights

---

## 13) FullCalendar Integration Plan

Required packages:
- `@fullcalendar/react`
- `@fullcalendar/daygrid`
- `@fullcalendar/timegrid`
- `@fullcalendar/interaction`
- `@fullcalendar/list`

Adapter contract (`planner.sync.adapter.ts` + calendar mapper):
- map Firestore event -> FullCalendar EventInput
- map FullCalendar drag/drop callback -> Firestore update payload
- recurrence mapping helper

Google sync preparation:
- `calendar_sync` documents store status/config
- `events.sync` stores per-event sync metadata
- future background function picks pending events and syncs provider

---

## 14) Animation & Visual System

- Subtle blur glass panels (`backdrop-blur-md`)
- Gradient shells with low-opacity radial overlays
- Animated transitions:
  - view switch fade/slide (`150-200ms`)
  - event hover glow (`box-shadow`)
  - conflict badge pulse for high severity
- Avoid cartoon visuals; keep typography clean and premium

---

## 15) Rollout Plan

Phase 1:
- Introduce planner feature module + types + services + insights utils
- Launch child agenda-first planner page

Phase 2:
- Parent full calendar + recurring editor + conflict panel
- School timetable table manager

Phase 3:
- Burnout recommendations + exam mode focus
- Sync status UI + background sync scaffolding

Phase 4:
- Google OAuth + 3-calendar sync implementation

