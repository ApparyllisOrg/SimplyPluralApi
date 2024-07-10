import { logger } from "../logger";
import { db, getCollection } from "../mongo";
import { automatedRemindersDueEvent, removeDeletedReminders } from "./automatedReminder";
import { notifyFrontDue, notifyPrivateFrontDue, notifySharedFrontDue } from "./frontChange";
import { repeatRemindersDueEvent, repeatRemindersEvent } from "./repeatReminders";
import promclient from "prom-client";
import { getStartOfDay, isPrimaryInstace } from "../../util";
import * as MongoDb from "mongodb";

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

const users_counter = new promclient.Gauge({
	name: "apparyllis_api_daily_users",
	help: "Counter for the amount of daily users, resets daily and counts up until the end of the day",
});

const events_counter = new promclient.Counter({
	name: "apparyllis_api_event_controller_events",
	help: "Counter for events processed",
});

const events_counter_enqueued = new promclient.Counter({
	name: "apparyllis_api_event_controller_enqueued_events",
	help: "Counter for events enqueued",
});

const runDailyUserCounter = async () => {
	const event = await getCollection("events").findOne({ date: getStartOfDay().toDate(), event: "dailyUsage" });
	if (event) {
		users_counter.set(event.count);
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

		events_counter.inc()
	});
	queuedEvents.deleteMany({ due: { $lte: now } });

	runDailyUserCounter();

	// Re-run after 1000ms
	setTimeout(runEvents, 1000);
};

export const performEvent = (target: string, uid: string, delay: number) => {
	enqueueEvent(target, uid, delay);
};

const enqueueEvent = (event: string, uid: string, delay: number) => {
	const now = Date.now();
	const future = now + delay;
	const queuedEvents = getCollection("queuedEvents");
	queuedEvents.updateOne({ uid: uid, event: event }, { $set: { event: event, uid: uid, due: future } }, { upsert: true });

	events_counter_enqueued.inc()
};

export const init = () => {
	if (isPrimaryInstace()) {

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
