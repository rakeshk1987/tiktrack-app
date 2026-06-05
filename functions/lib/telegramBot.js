"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramWebhook = exports.telegramMiniAppDeleteSchedule = exports.telegramMiniAppListWeek = exports.telegramMiniAppListToday = exports.telegramMiniAppCreateSchedule = exports.telegramMiniAppBootstrap = void 0;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
const SESSION_TTL_HOURS = 12;
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function botToken() {
    var _a;
    return ((_a = functions.config().telegram) === null || _a === void 0 ? void 0 : _a.bot_token) || process.env.TELEGRAM_BOT_TOKEN || '';
}
function webhookSecret() {
    var _a;
    return ((_a = functions.config().telegram) === null || _a === void 0 ? void 0 : _a.webhook_secret) || process.env.TELEGRAM_WEBHOOK_SECRET || '';
}
function miniAppUrl() {
    var _a;
    return ((_a = functions.config().telegram) === null || _a === void 0 ? void 0 : _a.mini_app_url) || process.env.TELEGRAM_MINI_APP_URL || '';
}
function sessionExpiry() {
    return admin.firestore.Timestamp.fromDate(new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000));
}
function normalizeText(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function callbackButton(text, data) {
    return { text, callback_data: data };
}
function webAppButton(text, url) {
    return { text, web_app: { url } };
}
function rows(items, size, mapItem) {
    const result = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size).map(mapItem));
    }
    return result;
}
async function telegramApi(method, payload) {
    const token = botToken();
    if (!token) {
        console.warn('Telegram bot token is not configured.');
        return;
    }
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const body = await response.text();
        console.error(`Telegram API ${method} failed`, response.status, body);
    }
}
async function sendMessage(chatId, text, inlineKeyboard) {
    await telegramApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
    });
}
async function answerCallback(callbackId) {
    await telegramApi('answerCallbackQuery', { callback_query_id: callbackId });
}
async function loadLink(telegramUserId) {
    const snap = await db.collection('telegram_links').doc(String(telegramUserId)).get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    if (data.status !== 'active' || !data.family_id)
        return null;
    return data;
}
async function loadSession(telegramUserId) {
    var _a;
    const snap = await db.collection('telegram_sessions').doc(String(telegramUserId)).get();
    if (!snap.exists)
        return null;
    const session = snap.data();
    if (((_a = session.expires_at) === null || _a === void 0 ? void 0 : _a.toDate().getTime()) < Date.now())
        return null;
    return session;
}
async function saveSession(telegramUserId, session) {
    await db.collection('telegram_sessions').doc(String(telegramUserId)).set(Object.assign(Object.assign({}, session), { updated_at: new Date().toISOString(), expires_at: sessionExpiry() }));
}
async function clearSession(telegramUserId) {
    await db.collection('telegram_sessions').doc(String(telegramUserId)).delete();
}
async function getChildren(familyId) {
    const usersSnap = await db.collection('users')
        .where('role', '==', 'child_user')
        .where('linked_family_id', '==', familyId)
        .limit(20)
        .get();
    const fromUsers = usersSnap.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            name: String(data.name || data.email || 'Child').replace('@tiktrack.family', ''),
        };
    });
    if (fromUsers.length)
        return fromUsers;
    const profilesSnap = await db.collection('child_profile')
        .where('family_id', '==', familyId)
        .limit(20)
        .get();
    return profilesSnap.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, name: String(data.name || 'Child') };
    });
}
async function getPrograms(familyId, childId) {
    const snap = await db.collection('programs')
        .where('family_id', '==', familyId)
        .where('child_id', '==', childId)
        .limit(30)
        .get();
    return snap.docs
        .map((doc) => {
        const data = doc.data();
        const modules = Array.isArray(data.modules) && data.modules.length ? data.modules.map(String) : ['tasks'];
        return {
            id: doc.id,
            name: String(data.name || 'Activity'),
            modules,
        };
    })
        .filter((program) => program.name.trim().length > 0);
}
async function sendUnauthorised(chatId) {
    await sendMessage(chatId, [
        'TikTrack Telegram is not linked yet.',
        '',
        'Ask a parent admin to create a Telegram link code in TikTrack, then send:',
        '<code>/link YOUR_CODE</code>',
    ].join('\n'));
}
async function showChildPicker(chatId, telegramUserId, link) {
    const children = await getChildren(link.family_id);
    if (children.length === 0) {
        await sendMessage(chatId, 'No child profiles found for this family yet.');
        return;
    }
    if (children.length === 1) {
        await saveSession(telegramUserId, {
            chat_id: chatId,
            family_id: link.family_id,
            step: 'select_action',
            draft: { childId: children[0].id, childName: children[0].name },
        });
        await showMainMenu(chatId, telegramUserId, link.family_id, children[0]);
        return;
    }
    await saveSession(telegramUserId, {
        chat_id: chatId,
        family_id: link.family_id,
        step: 'select_child',
        draft: {},
    });
    await sendMessage(chatId, 'Which child are we working with?', rows(children, 1, (child) => callbackButton(child.name, `child:${child.id}`)));
}
async function showMainMenu(chatId, telegramUserId, familyId, child) {
    await saveSession(telegramUserId, {
        chat_id: chatId,
        family_id: familyId,
        step: 'select_action',
        draft: { childId: child.id, childName: child.name },
    });
    const appUrl = miniAppUrl();
    const keyboard = [
        [callbackButton('Add schedule', 'action:add')],
        [callbackButton('View today', 'action:view_today'), callbackButton('View week', 'action:view_week')],
        [callbackButton('Routines', 'action:routines'), callbackButton('Rewards', 'action:rewards')],
        [callbackButton('Change child', 'action:change_child')],
    ];
    if (appUrl)
        keyboard.unshift([webAppButton('Open TikTrack Mini App', appUrl)]);
    await sendMessage(chatId, `<b>${child.name}</b>\nWhat do you want to do?`, keyboard);
}
async function showTypePicker(chatId, telegramUserId, session) {
    await saveSession(telegramUserId, Object.assign(Object.assign({}, session), { step: 'select_type' }));
    await sendMessage(chatId, 'What are you adding?', [
        [callbackButton('Task', 'type:task'), callbackButton('Event', 'type:event'), callbackButton('Exam', 'type:exam')],
        [callbackButton('Cancel', 'cancel')],
    ]);
}
function typeAllowedByProgram(type, program) {
    if (!program)
        return true;
    if (type === 'task')
        return program.modules.includes('tasks');
    if (type === 'event')
        return program.modules.includes('events');
    return program.modules.includes('exams');
}
async function showActivityPicker(chatId, telegramUserId, session) {
    const childId = session.draft.childId;
    const scheduleType = session.draft.scheduleType;
    if (!childId || !scheduleType) {
        await sendMessage(chatId, 'I lost the schedule context. Please start again with <code>hi</code>.');
        await clearSession(telegramUserId);
        return;
    }
    const programs = await getPrograms(session.family_id, childId);
    const validPrograms = programs.filter((program) => typeAllowedByProgram(scheduleType, program));
    const invalidPrograms = programs.filter((program) => !typeAllowedByProgram(scheduleType, program));
    const keyboard = [
        [callbackButton('No activity', 'activity:none')],
        ...rows(validPrograms, 1, (program) => callbackButton(program.name, `activity:${program.id}`)),
        [callbackButton('Back', 'action:add'), callbackButton('Cancel', 'cancel')],
    ];
    const note = invalidPrograms.length
        ? `\n\nHidden because ${scheduleType}s are not enabled: ${invalidPrograms.map((p) => p.name).join(', ')}`
        : '';
    await saveSession(telegramUserId, Object.assign(Object.assign({}, session), { step: 'select_activity' }));
    await sendMessage(chatId, `Choose activity for this ${scheduleType}.${note}`, keyboard);
}
function parseWeekday(text) {
    const normalized = normalizeText(text);
    for (let i = 0; i < DAY_NAMES.length; i += 1) {
        const day = DAY_NAMES[i];
        if (normalized.includes(day))
            return i;
    }
    return null;
}
function parseTime(text) {
    var _a;
    const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (!match)
        return null;
    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const meridiem = (_a = match[3]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (hour > 23 || minute > 59)
        return null;
    if (meridiem === 'pm' && hour < 12)
        hour += 12;
    if (meridiem === 'am' && hour === 12)
        hour = 0;
    return { hour, minute };
}
function nextDateForWeekday(day, from = new Date()) {
    const result = new Date(from);
    result.setHours(0, 0, 0, 0);
    const delta = (day - result.getDay() + 7) % 7 || 7;
    result.setDate(result.getDate() + delta);
    return result;
}
function parseDateTime(text) {
    const normalized = normalizeText(text);
    const time = parseTime(text) || { hour: 9, minute: 0 };
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    const isoDateMatch = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    const slashDateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
    const weekday = parseWeekday(text);
    if (normalized.includes('tomorrow')) {
        date.setDate(date.getDate() + 1);
    }
    else if (normalized.includes('today')) {
        // keep today
    }
    else if (isoDateMatch) {
        date = new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]));
    }
    else if (slashDateMatch) {
        const year = slashDateMatch[3] ? Number(slashDateMatch[3]) : new Date().getFullYear();
        date = new Date(year, Number(slashDateMatch[2]) - 1, Number(slashDateMatch[1]));
    }
    else if (weekday !== null) {
        date = nextDateForWeekday(weekday);
    }
    else {
        return null;
    }
    date.setHours(time.hour, time.minute, 0, 0);
    const end = new Date(date.getTime() + 60 * 60 * 1000);
    const isWeekly = normalized.includes('weekly') || normalized.includes('every week') || normalized.includes('every ') || normalized.includes('repeat weekly');
    const isDaily = normalized.includes('daily') || normalized.includes('every day');
    const recurrenceType = isDaily ? 'daily' : isWeekly ? 'weekly' : 'none';
    const recurrenceDays = recurrenceType === 'weekly' ? [weekday !== null && weekday !== void 0 ? weekday : date.getDay()] : [];
    return {
        startAt: date.toISOString(),
        endAt: end.toISOString(),
        recurrenceType,
        recurrenceDays,
    };
}
function dateWindowForDay(day = new Date()) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}
function dateOverlapsDay(dateValue, dayStart, dayEnd, recurrenceType, recurrenceDays) {
    if (!dateValue)
        return false;
    const base = new Date(dateValue);
    if (isNaN(base.getTime()))
        return false;
    if (!recurrenceType || recurrenceType === 'none') {
        return base.getTime() >= dayStart.getTime() && base.getTime() < dayEnd.getTime();
    }
    if (base.getTime() >= dayEnd.getTime())
        return false;
    if (recurrenceType === 'daily')
        return true;
    if (recurrenceType === 'weekly') {
        const days = Array.isArray(recurrenceDays) && recurrenceDays.length ? recurrenceDays : [base.getDay()];
        return days.includes(dayStart.getDay());
    }
    return base.getTime() >= dayStart.getTime() && base.getTime() < dayEnd.getTime();
}
function occurrenceStartForDay(dateValue, dayStart) {
    const base = new Date(dateValue);
    const occurrence = new Date(dayStart);
    occurrence.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
    return occurrence.toISOString();
}
async function programNameMap(familyId, childId) {
    const programs = await getPrograms(familyId, childId);
    return new Map(programs.map((program) => [program.id, program.name]));
}
async function listScheduleForDay(familyId, childId, day = new Date()) {
    const { start, end } = dateWindowForDay(day);
    const programs = await programNameMap(familyId, childId);
    const [tasksSnap, examsSnap, eventsSnap] = await Promise.all([
        db.collection('tasks').where('family_id', '==', familyId).where('child_id', '==', childId).limit(200).get(),
        db.collection('exams').where('family_id', '==', familyId).where('child_id', '==', childId).limit(200).get(),
        db.collection('events').where('family_id', '==', familyId).where('child_id', '==', childId).limit(200).get(),
    ]);
    const items = [];
    tasksSnap.docs.forEach((doc) => {
        const data = doc.data();
        const date = String(data.available_from || data.due_date || '');
        if (!dateOverlapsDay(date, start, end, data.recurrence_type, data.recurrence_days))
            return;
        items.push({
            id: doc.id,
            collection: 'tasks',
            type: 'task',
            title: String(data.title || 'Task'),
            startAt: occurrenceStartForDay(date, start),
            endAt: data.expires_at || data.end_date || null,
            childId,
            activityName: data.linked_program_id ? programs.get(String(data.linked_program_id)) || null : null,
        });
    });
    examsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const date = String(data.exam_date || data.date || '');
        if (!dateOverlapsDay(date, start, end, data.recurrence_type, data.recurrence_days))
            return;
        items.push({
            id: doc.id,
            collection: 'exams',
            type: 'exam',
            title: String(data.subject || data.title || 'Exam'),
            startAt: occurrenceStartForDay(date, start),
            endAt: null,
            childId,
            activityName: data.linked_program_id ? programs.get(String(data.linked_program_id)) || null : null,
        });
    });
    eventsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const date = String(data.start_at || data.date || '');
        if (!dateOverlapsDay(date, start, end, data.recurrence_type, data.recurrence_days))
            return;
        items.push({
            id: doc.id,
            collection: 'events',
            type: 'event',
            title: String(data.title || 'Event'),
            startAt: occurrenceStartForDay(date, start),
            endAt: data.end_at || null,
            childId,
            activityName: data.linked_program_id ? programs.get(String(data.linked_program_id)) || null : null,
        });
    });
    return items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
async function listScheduleForRange(familyId, childId, startDay = new Date(), dayCount = 7) {
    const days = Array.from({ length: dayCount }, (_, index) => {
        const day = new Date(startDay);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() + index);
        return day;
    });
    const byDay = await Promise.all(days.map((day) => listScheduleForDay(familyId, childId, day)));
    return byDay.flat().sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
function formatTime(value) {
    return new Date(value).toLocaleTimeString('en-IN', { timeZone: DEFAULT_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}
function formatDay(value) {
    return new Date(value).toLocaleDateString('en-IN', { timeZone: DEFAULT_TIME_ZONE, weekday: 'short', day: '2-digit', month: 'short' });
}
function scheduleTypeIcon(type) {
    if (type === 'exam')
        return 'Exam';
    if (type === 'event')
        return 'Event';
    return 'Task';
}
async function deleteScheduleItem(familyId, childId, collection, id) {
    const ref = db.collection(collection).doc(id);
    const snap = await ref.get();
    if (!snap.exists)
        return false;
    const data = snap.data() || {};
    if (data.family_id !== familyId || data.child_id !== childId)
        return false;
    await ref.delete();
    return true;
}
function inferType(text) {
    const normalized = normalizeText(text);
    if (/\b(exam|test|assessment)\b/.test(normalized))
        return 'exam';
    if (/\b(class|session|appointment|event|competition|tournament)\b/.test(normalized))
        return 'event';
    if (/\b(task|homework|worksheet|practice|assignment|read|reading)\b/.test(normalized))
        return 'task';
    return null;
}
function extractTitle(text, type) {
    const cleaned = text
        .replace(/\b(today|tomorrow|daily|weekly|every\s+\w+|repeat weekly|next\s+\w+)\b/gi, ' ')
        .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, ' ')
        .replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g, ' ')
        .replace(/\b\d{1,2}[/-]\d{1,2}([/-]20\d{2})?\b/g, ' ')
        .replace(new RegExp(`\\b${type}\\b`, 'gi'), ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned || (type === 'exam' ? 'Exam' : type === 'event' ? 'Event' : 'Task');
}
function buildDraftFromText(existing, text) {
    const scheduleType = existing.scheduleType || inferType(text) || 'task';
    const parsedDate = parseDateTime(text);
    return Object.assign(Object.assign({}, existing), { scheduleType, rawText: text, title: extractTitle(text, scheduleType), startAt: parsedDate === null || parsedDate === void 0 ? void 0 : parsedDate.startAt, endAt: parsedDate === null || parsedDate === void 0 ? void 0 : parsedDate.endAt, recurrenceType: (parsedDate === null || parsedDate === void 0 ? void 0 : parsedDate.recurrenceType) || 'none', recurrenceDays: (parsedDate === null || parsedDate === void 0 ? void 0 : parsedDate.recurrenceDays) || [] });
}
async function findDuplicate(familyId, draft) {
    if (!draft.childId || !draft.title || !draft.startAt || !draft.scheduleType)
        return null;
    const start = new Date(draft.startAt);
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const title = normalizeText(draft.title);
    if (draft.scheduleType === 'task') {
        const snap = await db.collection('tasks')
            .where('family_id', '==', familyId)
            .where('child_id', '==', draft.childId)
            .limit(50)
            .get();
        const duplicate = snap.docs.find((doc) => {
            const data = doc.data();
            const date = data.available_from || data.due_date;
            if (!date || normalizeText(String(data.title || '')) !== title)
                return false;
            const time = new Date(String(date)).getTime();
            return time >= dayStart.getTime() && time < dayEnd.getTime();
        });
        return duplicate ? duplicate.id : null;
    }
    if (draft.scheduleType === 'exam') {
        const snap = await db.collection('exams')
            .where('family_id', '==', familyId)
            .where('child_id', '==', draft.childId)
            .limit(50)
            .get();
        const duplicate = snap.docs.find((doc) => {
            const data = doc.data();
            if (!data.exam_date || normalizeText(String(data.subject || '')) !== title)
                return false;
            const time = new Date(String(data.exam_date)).getTime();
            return time >= dayStart.getTime() && time < dayEnd.getTime();
        });
        return duplicate ? duplicate.id : null;
    }
    const snap = await db.collection('events')
        .where('family_id', '==', familyId)
        .where('child_id', '==', draft.childId)
        .limit(50)
        .get();
    const duplicate = snap.docs.find((doc) => {
        const data = doc.data();
        const date = data.start_at || data.date;
        if (!date || normalizeText(String(data.title || '')) !== title)
            return false;
        const time = new Date(String(date)).getTime();
        return time >= dayStart.getTime() && time < dayEnd.getTime();
    });
    return duplicate ? duplicate.id : null;
}
function draftSummary(draft) {
    const start = draft.startAt ? new Date(draft.startAt).toLocaleString('en-IN', { timeZone: DEFAULT_TIME_ZONE }) : 'Missing date';
    const repeat = draft.recurrenceType && draft.recurrenceType !== 'none' ? `\nRepeat: ${draft.recurrenceType}` : '';
    return [
        `<b>Create ${draft.scheduleType}</b>`,
        `Child: ${draft.childName || draft.childId || 'Unknown'}`,
        `Activity: ${draft.programName || 'No activity'}`,
        `Title: ${draft.title || 'Untitled'}`,
        `Start: ${start}${repeat}`,
    ].join('\n');
}
async function createSchedule(familyId, draft) {
    if (!draft.childId || !draft.scheduleType || !draft.title || !draft.startAt || !draft.endAt) {
        throw new Error('Schedule draft is incomplete.');
    }
    if (new Date(draft.endAt).getTime() <= new Date(draft.startAt).getTime()) {
        throw new Error('Schedule end time must be after the start time.');
    }
    const now = new Date().toISOString();
    if (draft.scheduleType === 'task') {
        const ref = await db.collection('tasks').add({
            title: draft.title,
            description: draft.rawText || '',
            points: 1,
            star_value: 1,
            category: 'General',
            priority: 'medium',
            energy_level: 'medium',
            difficulty_level: 1,
            requires_proof: false,
            status: 'pending',
            child_id: draft.childId,
            available_from: draft.startAt,
            due_date: draft.startAt,
            expires_at: draft.endAt,
            end_date: draft.endAt,
            is_mandatory: false,
            recurrence_type: draft.recurrenceType || 'none',
            recurrence_days: draft.recurrenceDays || [],
            linked_program_id: draft.linkedProgramId || null,
            parent_id: familyId,
            family_id: familyId,
            created_by: 'telegram',
            created_at: now,
            updated_at: now,
        });
        return ref.id;
    }
    if (draft.scheduleType === 'exam') {
        const ref = await db.collection('exams').add({
            child_id: draft.childId,
            subject: draft.title,
            subject_id: '',
            exam_type: 'other',
            marks_scored: null,
            total_marks: null,
            points_allocated: null,
            points_earned: null,
            exam_date: draft.startAt,
            status: 'scheduled',
            syllabus_scope: draft.rawText || '',
            result_published_at: null,
            reminder_plan: ['7d', '3d', '1d', 'same_day'],
            linked_program_id: draft.linkedProgramId || null,
            recurrence_type: draft.recurrenceType || 'none',
            recurrence_days: draft.recurrenceDays || [],
            parent_id: familyId,
            family_id: familyId,
            created_by: 'telegram',
            created_at: now,
            updated_at: now,
        });
        return ref.id;
    }
    const ref = await db.collection('events').add({
        child_id: draft.childId,
        title: draft.title,
        type: 'event',
        date: draft.startAt,
        start_at: draft.startAt,
        end_at: draft.endAt,
        reminder_days_before: 0,
        linked_program_id: draft.linkedProgramId || null,
        recurrence_type: draft.recurrenceType || 'none',
        recurrence_days: draft.recurrenceDays || [],
        parent_id: familyId,
        family_id: familyId,
        created_by: 'telegram',
        created_at: now,
        updated_at: now,
    });
    return ref.id;
}
async function sendTodaySchedule(chatId, familyId, child) {
    const items = await listScheduleForDay(familyId, child.id);
    if (items.length === 0) {
        await sendMessage(chatId, `<b>${escapeHtml(child.name)} today</b>\nNo schedules for today.`);
        return;
    }
    const lines = items.map((item, index) => {
        const activity = item.activityName ? ` · ${escapeHtml(item.activityName)}` : '';
        return `${index + 1}. ${scheduleTypeIcon(item.type)} <b>${escapeHtml(item.title)}</b>\n   ${formatTime(item.startAt)}${activity}`;
    });
    await sendMessage(chatId, `<b>${escapeHtml(child.name)} today</b>\n\n${lines.join('\n')}`, [
        ...items.slice(0, 8).map((item, index) => [callbackButton(`Delete ${index + 1}`, `delete:today:${item.collection}:${item.id}`)]),
        [callbackButton('Back to menu', 'action:menu')],
    ]);
}
async function sendWeekSchedule(chatId, familyId, child) {
    const items = await listScheduleForRange(familyId, child.id);
    if (items.length === 0) {
        await sendMessage(chatId, `<b>${escapeHtml(child.name)} this week</b>\nNo schedules found for the next 7 days.`);
        return;
    }
    const lines = items.slice(0, 20).map((item, index) => {
        const activity = item.activityName ? ` · ${escapeHtml(item.activityName)}` : '';
        return `${index + 1}. ${formatDay(item.startAt)} ${formatTime(item.startAt)} · ${scheduleTypeIcon(item.type)} <b>${escapeHtml(item.title)}</b>${activity}`;
    });
    const overflow = items.length > 20 ? `\n\nShowing first 20 of ${items.length}. Open the Mini App for the full list.` : '';
    await sendMessage(chatId, `<b>${escapeHtml(child.name)} this week</b>\n\n${lines.join('\n')}${overflow}`, [
        ...items.slice(0, 8).map((item, index) => [callbackButton(`Delete ${index + 1}`, `delete:week:${item.collection}:${item.id}`)]),
        [callbackButton('Back to menu', 'action:menu')],
    ]);
}
function verifyTelegramInitData(initData) {
    const token = botToken();
    if (!token || !initData)
        return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash)
        return null;
    params.delete('hash');
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || Date.now() / 1000 - authDate > 24 * 60 * 60)
        return null;
    const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    const received = Buffer.from(hash, 'hex');
    const expected = Buffer.from(computed, 'hex');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected))
        return null;
    const rawUser = params.get('user');
    if (!rawUser)
        return null;
    try {
        const parsed = JSON.parse(rawUser);
        return typeof parsed.id === 'number' ? parsed : null;
    }
    catch (_a) {
        return null;
    }
}
function setCors(req, res) {
    var _a;
    const allowedOrigin = ((_a = functions.config().telegram) === null || _a === void 0 ? void 0 : _a.mini_app_origin) || process.env.TELEGRAM_MINI_APP_ORIGIN || '*';
    res.set('Access-Control-Allow-Origin', allowedOrigin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true;
    }
    return false;
}
async function requireMiniAppLink(req, res) {
    var _a;
    const initData = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.initData) || '');
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser) {
        res.status(401).json({ ok: false, error: 'Invalid Telegram session.' });
        return null;
    }
    const link = await loadLink(telegramUser.id);
    if (!link) {
        res.status(403).json({ ok: false, error: 'Telegram account is not linked to TikTrack.' });
        return null;
    }
    return { user: telegramUser, link };
}
exports.telegramMiniAppBootstrap = functions.https.onRequest(async (req, res) => {
    if (setCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed.' });
        return;
    }
    try {
        const auth = await requireMiniAppLink(req, res);
        if (!auth)
            return;
        const children = await getChildren(auth.link.family_id);
        const programsByChild = {};
        for (const child of children) {
            programsByChild[child.id] = await getPrograms(auth.link.family_id, child.id);
        }
        res.json({
            ok: true,
            familyId: auth.link.family_id,
            telegramUser: {
                id: auth.user.id,
                firstName: auth.user.first_name || '',
                username: auth.user.username || '',
            },
            children,
            programsByChild,
        });
    }
    catch (error) {
        console.error('Telegram mini app bootstrap failed', error);
        res.status(500).json({ ok: false, error: 'Could not load TikTrack context.' });
    }
});
exports.telegramMiniAppCreateSchedule = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    if (setCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed.' });
        return;
    }
    try {
        const auth = await requireMiniAppLink(req, res);
        if (!auth)
            return;
        const draft = (_a = req.body) === null || _a === void 0 ? void 0 : _a.draft;
        if (!(draft === null || draft === void 0 ? void 0 : draft.childId) || !draft.scheduleType || !draft.title || !draft.startAt || !draft.endAt) {
            res.status(400).json({ ok: false, error: 'Schedule details are incomplete.' });
            return;
        }
        if (new Date(draft.endAt).getTime() <= new Date(draft.startAt).getTime()) {
            res.status(400).json({ ok: false, error: 'End time must be after start time.' });
            return;
        }
        const children = await getChildren(auth.link.family_id);
        if (!children.some((child) => child.id === draft.childId)) {
            res.status(403).json({ ok: false, error: 'Child is not part of this family.' });
            return;
        }
        const programs = await getPrograms(auth.link.family_id, draft.childId);
        const program = draft.linkedProgramId ? programs.find((item) => item.id === draft.linkedProgramId) || null : null;
        if (draft.linkedProgramId && !program) {
            res.status(400).json({ ok: false, error: 'Selected activity was not found.' });
            return;
        }
        if (!typeAllowedByProgram(draft.scheduleType, program)) {
            res.status(400).json({ ok: false, error: 'Selected activity does not support this schedule type.' });
            return;
        }
        const duplicateId = await findDuplicate(auth.link.family_id, draft);
        if (duplicateId && !((_b = req.body) === null || _b === void 0 ? void 0 : _b.createAnyway)) {
            res.json({ ok: false, duplicateId, error: 'Possible duplicate found.' });
            return;
        }
        const id = await createSchedule(auth.link.family_id, Object.assign(Object.assign({}, draft), { title: draft.title.trim(), recurrenceType: draft.recurrenceType || 'none', recurrenceDays: draft.recurrenceDays || [], linkedProgramId: draft.linkedProgramId || null }));
        res.json({ ok: true, id });
    }
    catch (error) {
        console.error('Telegram mini app create schedule failed', error);
        res.status(500).json({ ok: false, error: 'Could not create schedule.' });
    }
});
exports.telegramMiniAppListToday = functions.https.onRequest(async (req, res) => {
    var _a;
    if (setCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed.' });
        return;
    }
    try {
        const auth = await requireMiniAppLink(req, res);
        if (!auth)
            return;
        const childId = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.childId) || '');
        const children = await getChildren(auth.link.family_id);
        if (!children.some((child) => child.id === childId)) {
            res.status(403).json({ ok: false, error: 'Child is not part of this family.' });
            return;
        }
        const items = await listScheduleForDay(auth.link.family_id, childId);
        res.json({ ok: true, items });
    }
    catch (error) {
        console.error('Telegram mini app list today failed', error);
        res.status(500).json({ ok: false, error: 'Could not load today schedule.' });
    }
});
exports.telegramMiniAppListWeek = functions.https.onRequest(async (req, res) => {
    var _a;
    if (setCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed.' });
        return;
    }
    try {
        const auth = await requireMiniAppLink(req, res);
        if (!auth)
            return;
        const childId = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.childId) || '');
        const children = await getChildren(auth.link.family_id);
        if (!children.some((child) => child.id === childId)) {
            res.status(403).json({ ok: false, error: 'Child is not part of this family.' });
            return;
        }
        const items = await listScheduleForRange(auth.link.family_id, childId);
        res.json({ ok: true, items });
    }
    catch (error) {
        console.error('Telegram mini app list week failed', error);
        res.status(500).json({ ok: false, error: 'Could not load week schedule.' });
    }
});
exports.telegramMiniAppDeleteSchedule = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c;
    if (setCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed.' });
        return;
    }
    try {
        const auth = await requireMiniAppLink(req, res);
        if (!auth)
            return;
        const childId = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.childId) || '');
        const collection = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.collection) || '');
        const id = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.id) || '');
        const validCollections = ['tasks', 'events', 'exams'];
        if (!childId || !id || !validCollections.includes(collection)) {
            res.status(400).json({ ok: false, error: 'Delete request is incomplete.' });
            return;
        }
        const deleted = await deleteScheduleItem(auth.link.family_id, childId, collection, id);
        if (!deleted) {
            res.status(404).json({ ok: false, error: 'Schedule was not found.' });
            return;
        }
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Telegram mini app delete schedule failed', error);
        res.status(500).json({ ok: false, error: 'Could not delete schedule.' });
    }
});
async function promptForDetails(chatId, telegramUserId, session) {
    await saveSession(telegramUserId, Object.assign(Object.assign({}, session), { step: 'await_details' }));
    await sendMessage(chatId, [
        `Send the ${session.draft.scheduleType || 'schedule'} details.`,
        '',
        'Examples:',
        '<code>Physics exam next Friday 9am</code>',
        '<code>Swimming class Saturday 6pm weekly</code>',
        '<code>Reading practice tomorrow 7pm</code>',
    ].join('\n'), [[callbackButton('Cancel', 'cancel')]]);
}
async function handleDetailsText(chatId, telegramUserId, session, text) {
    const draft = buildDraftFromText(session.draft, text);
    if (!draft.startAt) {
        await saveSession(telegramUserId, Object.assign(Object.assign({}, session), { step: 'await_details', draft }));
        await sendMessage(chatId, 'I could not find a date/time. Please include today, tomorrow, a weekday, or YYYY-MM-DD with a time.');
        return;
    }
    const duplicateId = await findDuplicate(session.family_id, draft);
    const nextSession = Object.assign(Object.assign({}, session), { step: 'confirm_create', draft });
    await saveSession(telegramUserId, nextSession);
    const duplicateWarning = duplicateId ? `\n\nPossible duplicate found: <code>${duplicateId}</code>` : '';
    await sendMessage(chatId, `${draftSummary(draft)}${duplicateWarning}`, [
        [callbackButton(duplicateId ? 'Create anyway' : 'Create', 'confirm:create'), callbackButton('Cancel', 'cancel')],
        duplicateId ? [callbackButton('Skip duplicate', 'cancel')] : [],
    ].filter((row) => row.length));
}
async function handleLinkCommand(chatId, telegramUser, code) {
    if (!code) {
        await sendMessage(chatId, 'Send <code>/link YOUR_CODE</code>.');
        return;
    }
    const codeRef = db.collection('telegram_link_codes').doc(code.trim().toUpperCase());
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
        await sendMessage(chatId, 'That link code was not found or has expired.');
        return;
    }
    const codeData = codeSnap.data() || {};
    const expiresAt = codeData.expires_at;
    if (expiresAt && expiresAt.toDate().getTime() < Date.now()) {
        await sendMessage(chatId, 'That link code has expired. Please create a new one in TikTrack.');
        return;
    }
    await db.collection('telegram_links').doc(String(telegramUser.id)).set({
        telegram_user_id: telegramUser.id,
        telegram_username: telegramUser.username || null,
        telegram_first_name: telegramUser.first_name || null,
        family_id: String(codeData.family_id),
        parent_id: codeData.parent_id ? String(codeData.parent_id) : null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });
    await codeRef.delete();
    await sendMessage(chatId, 'Telegram is now linked to TikTrack.');
    const link = await loadLink(telegramUser.id);
    if (link)
        await showChildPicker(chatId, telegramUser.id, link);
}
async function handleMessage(message) {
    if (!message.from)
        return;
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    if (text.startsWith('/link')) {
        await handleLinkCommand(chatId, message.from, text.replace('/link', '').trim());
        return;
    }
    const link = await loadLink(message.from.id);
    if (!link) {
        await sendUnauthorised(chatId);
        return;
    }
    const normalized = normalizeText(text);
    if (!text || normalized === 'hi' || normalized === 'hello' || text.startsWith('/start') || text.startsWith('/menu')) {
        await showChildPicker(chatId, message.from.id, link);
        return;
    }
    const session = await loadSession(message.from.id);
    if ((session === null || session === void 0 ? void 0 : session.step) === 'await_details' || (session === null || session === void 0 ? void 0 : session.step) === 'confirm_create') {
        await handleDetailsText(chatId, message.from.id, session, text);
        return;
    }
    const children = await getChildren(link.family_id);
    if (children.length === 1) {
        const draft = buildDraftFromText({ childId: children[0].id, childName: children[0].name }, text);
        const nextSession = {
            chat_id: chatId,
            family_id: link.family_id,
            step: draft.scheduleType ? 'select_activity' : 'select_type',
            draft,
            updated_at: new Date().toISOString(),
            expires_at: sessionExpiry(),
        };
        if (draft.scheduleType) {
            await showActivityPicker(chatId, message.from.id, nextSession);
        }
        else {
            await showTypePicker(chatId, message.from.id, nextSession);
        }
        return;
    }
    await saveSession(message.from.id, {
        chat_id: chatId,
        family_id: link.family_id,
        step: 'select_child',
        draft: { rawText: text },
    });
    await sendMessage(chatId, 'Which child is this for?', rows(children, 1, (child) => callbackButton(child.name, `child:${child.id}`)));
}
async function handleCallback(callback) {
    await answerCallback(callback.id);
    if (!callback.message || !callback.data)
        return;
    const chatId = callback.message.chat.id;
    const link = await loadLink(callback.from.id);
    if (!link) {
        await sendUnauthorised(chatId);
        return;
    }
    if (callback.data === 'cancel') {
        await clearSession(callback.from.id);
        await sendMessage(chatId, 'Cancelled.');
        return;
    }
    const session = await loadSession(callback.from.id);
    if (callback.data === 'action:change_child') {
        await showChildPicker(chatId, callback.from.id, link);
        return;
    }
    if (!session) {
        await showChildPicker(chatId, callback.from.id, link);
        return;
    }
    if (callback.data === 'action:menu') {
        const children = await getChildren(link.family_id);
        const child = children.find((item) => item.id === session.draft.childId);
        if (!child) {
            await showChildPicker(chatId, callback.from.id, link);
            return;
        }
        await showMainMenu(chatId, callback.from.id, link.family_id, child);
        return;
    }
    if (callback.data.startsWith('child:')) {
        const childId = callback.data.replace('child:', '');
        const children = await getChildren(link.family_id);
        const child = children.find((item) => item.id === childId);
        if (!child) {
            await sendMessage(chatId, 'That child was not found.');
            return;
        }
        const draft = Object.assign(Object.assign({}, session.draft), { childId: child.id, childName: child.name });
        if (draft.rawText) {
            await saveSession(callback.from.id, Object.assign(Object.assign({}, session), { step: 'select_type', draft }));
            await showTypePicker(chatId, callback.from.id, Object.assign(Object.assign({}, session), { draft }));
        }
        else {
            await showMainMenu(chatId, callback.from.id, link.family_id, child);
        }
        return;
    }
    if (callback.data === 'action:add') {
        await showTypePicker(chatId, callback.from.id, session);
        return;
    }
    if (callback.data === 'action:view_today') {
        const children = await getChildren(link.family_id);
        const child = children.find((item) => item.id === session.draft.childId);
        if (!child) {
            await showChildPicker(chatId, callback.from.id, link);
            return;
        }
        await sendTodaySchedule(chatId, link.family_id, child);
        return;
    }
    if (callback.data === 'action:view_week') {
        const children = await getChildren(link.family_id);
        const child = children.find((item) => item.id === session.draft.childId);
        if (!child) {
            await showChildPicker(chatId, callback.from.id, link);
            return;
        }
        await sendWeekSchedule(chatId, link.family_id, child);
        return;
    }
    if (callback.data === 'action:routines' || callback.data === 'action:rewards') {
        await sendMessage(chatId, 'This module is planned after planner add/view/delete is stable.');
        return;
    }
    if (callback.data.startsWith('type:')) {
        const scheduleType = callback.data.replace('type:', '');
        await showActivityPicker(chatId, callback.from.id, Object.assign(Object.assign({}, session), { step: 'select_activity', draft: Object.assign(Object.assign({}, session.draft), { scheduleType }) }));
        return;
    }
    if (callback.data.startsWith('activity:')) {
        const activityId = callback.data.replace('activity:', '');
        const programs = session.draft.childId ? await getPrograms(link.family_id, session.draft.childId) : [];
        const program = activityId === 'none' ? null : programs.find((item) => item.id === activityId) || null;
        if (!typeAllowedByProgram(session.draft.scheduleType || 'task', program)) {
            await sendMessage(chatId, 'That activity does not support this schedule type. Please choose another activity.');
            await showActivityPicker(chatId, callback.from.id, session);
            return;
        }
        const nextSession = Object.assign(Object.assign({}, session), { step: 'await_details', draft: Object.assign(Object.assign({}, session.draft), { linkedProgramId: (program === null || program === void 0 ? void 0 : program.id) || null, programName: (program === null || program === void 0 ? void 0 : program.name) || null }) });
        if (nextSession.draft.rawText) {
            await handleDetailsText(chatId, callback.from.id, nextSession, nextSession.draft.rawText);
        }
        else {
            await promptForDetails(chatId, callback.from.id, nextSession);
        }
        return;
    }
    if (callback.data === 'confirm:create') {
        const duplicateId = await findDuplicate(link.family_id, session.draft);
        if (duplicateId) {
            console.info('Creating Telegram schedule despite duplicate', duplicateId);
        }
        const id = await createSchedule(link.family_id, session.draft);
        await clearSession(callback.from.id);
        await sendMessage(chatId, `Created in TikTrack: <code>${id}</code>`);
        return;
    }
    if (callback.data.startsWith('delete:')) {
        const parts = callback.data.split(':');
        const source = parts.length === 4 ? parts[1] : 'today';
        const collectionRaw = parts.length === 4 ? parts[2] : parts[1];
        const id = parts.length === 4 ? parts[3] : parts[2];
        const collection = collectionRaw;
        const validCollections = ['tasks', 'events', 'exams'];
        if (!validCollections.includes(collection) || !id || !session.draft.childId) {
            await sendMessage(chatId, 'Could not delete that item. Please open today again.');
            return;
        }
        const deleted = await deleteScheduleItem(link.family_id, session.draft.childId, collection, id);
        if (!deleted) {
            await sendMessage(chatId, 'That schedule was already deleted or no longer belongs to this child.');
            return;
        }
        await sendMessage(chatId, 'Deleted from TikTrack.');
        const children = await getChildren(link.family_id);
        const child = children.find((item) => item.id === session.draft.childId);
        if (child && source === 'week')
            await sendWeekSchedule(chatId, link.family_id, child);
        if (child && source !== 'week')
            await sendTodaySchedule(chatId, link.family_id, child);
    }
}
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const expectedSecret = webhookSecret();
    if (expectedSecret) {
        const receivedSecret = req.header('x-telegram-bot-api-secret-token') || String(req.query.secret || '');
        if (receivedSecret !== expectedSecret) {
            res.status(401).send('Unauthorized');
            return;
        }
    }
    const update = req.body;
    try {
        if (update.message)
            await handleMessage(update.message);
        if (update.callback_query)
            await handleCallback(update.callback_query);
        res.status(200).send('ok');
    }
    catch (error) {
        console.error('Telegram webhook failed', error);
        res.status(200).send('ok');
    }
});
//# sourceMappingURL=telegramBot.js.map