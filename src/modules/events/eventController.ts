import { logger } from "../logger";
import { getCollection, isLive } from "../mongo";
import { automatedRemindersDueEvent, removeDeletedReminders } from "./automatedReminder";
import { frontChange } from "./frontChange";
import { repeatRemindersDueEvent, repeatRemindersEvent } from "./repeatReminders";
type bindFunc = (uid: string, event: any) => void;
const _boundEvents = new Map<string, bindFunc>();

const bindEvents = async () => {
	if (!isLive()) {
		setTimeout(bindEvents, 100);
		return;
	}

	_boundEvents.set("fronters", frontChange);
	_boundEvents.set("repeatReminders", repeatRemindersEvent);
	_boundEvents.set("automatedReminders", removeDeletedReminders);
	_boundEvents.set("scheduledRepeatReminder", repeatRemindersDueEvent);
	_boundEvents.set("scheduledAutomatedReminder", automatedRemindersDueEvent);
};

const runEvents = async () => {
	if (!isLive()) {
		setTimeout(runEvents, 100);
		return;
	}

	const now = Date.now();
	const queuedEvents = getCollection("queuedEvents");
	const overdueEvents = await queuedEvents.find({ due: { $lte: now } }).toArray();
	overdueEvents.forEach((event) => {
		// Try because if one event fails, we don't want any of the others to fail..
		try {
			const func = _boundEvents.get(event["event"]);
			if (func) func(event["uid"], event);
		} catch (e) {
			logger.error(e);
		}
	});
	queuedEvents.deleteMany({ due: { $lte: now } });

	// Re-run after 300ms
	setTimeout(runEvents, 300);
};

export const performDelete = (target: string, uid: any, delay: number) => {
	if (_boundEvents.has(target))
		enqueueEvent(target, uid, delay);
};

export const performEvent = (target: string, uid: string, delay: number) => {
	enqueueEvent(target, uid, delay);
};

const enqueueEvent = (event: string, uid: string, delay: number) => {
	const now = Date.now();
	const future = now + delay;
	const queuedEvents = getCollection("queuedEvents");
	queuedEvents.updateOne({ uid: uid, event: event }, { $set: { event: event, uid: uid, due: future } }, { upsert: true });
};

export const init = () => {
	runEvents();
	// Todo: Edit this so that every server can run queued events and that
	// getting queued events is atomic, so only one server handles the documents it got returned
	// We don't want to run runEvents twice on two servers and have it return
	// the same events on both. It needs to return atomically.
	if (!process.env.DEVELOPMENT || process.env.LOCALEVENTS) bindEvents();
};