import { logger } from "../logger";
import { getCollection } from "../mongo";
import { automatedRemindersDueEvent, removeDeletedReminders } from "./automatedReminder";
import { notifyFrontDue, notifyPrivateFrontDue, notifySharedFrontDue } from "./frontChange";
import { repeatRemindersDueEvent, repeatRemindersEvent } from "./repeatReminders";
import promclient from "prom-client";
import { getStartOfDay, isPrimaryInstace } from "../../util";

type bindFunc = (uid: string, event: any) => void;
const _boundEvents = new Map<string, bindFunc>();

const bindEvents = async () => {
	_boundEvents.set("repeatReminders", repeatRemindersEvent);
	_boundEvents.set("automatedReminders", removeDeletedReminders);
	_boundEvents.set("scheduledRepeatReminder", repeatRemindersDueEvent);
	_boundEvents.set("scheduledAutomatedReminder", automatedRemindersDueEvent);
	_boundEvents.set("frontChangeShared", notifySharedFrontDue);
	_boundEvents.set("frontChangePrivate", notifyPrivateFrontDue);
	_boundEvents.set("frontChange", notifyFrontDue);
};

const counter = new promclient.Gauge({
	name: "apparyllis_api_daily_users",
	help: "Counter for the amount of daily users, resets daily and counts up until the end of the day",
});

const runDailyUserCounter = async () => {
	const event = await getCollection("events").findOne({ date: getStartOfDay().toDate(), event: "dailyUsage" });
	if (event) {
		counter.set(event.count);
	}
};

const runEvents = async () => {
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

	runDailyUserCounter();

	// Re-run after 300ms
	setTimeout(runEvents, 300);
};

export const performDelete = (target: string, uid: any, delay: number) => {
	if (_boundEvents.has(target)) enqueueEvent(target, uid, delay);
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
	if (isPrimaryInstace() || process.env.DEVELOPMENT === 'true') {
		runEvents();
		// Todo: Edit this so that every server can run queued events and that
		// getting queued events is atomic, so only one server handles the documents it got returned
		// We don't want to run runEvents twice on two servers and have it return
		// the same events on both. It needs to return atomically.
		if (process.env.LOCALEVENTS === "true") {
			bindEvents();
			console.log("Bound to events, started event controller");
		}
	}
};
