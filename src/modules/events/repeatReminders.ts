import moment from "moment-timezone";
import { notifyUser } from "../../util";
import { getCollection } from "../mongo";

const scheduleReminder = async (uid: string, data: any, userData: any) => {
	const queuedEvents = getCollection("queuedEvents");

	const now = new Date();

	const hour: number = data.time.hour;
	const minute: number = data.time.minute;

	const timzone: string = userData.location;
	const formattedTime = data.startTime.year + "-" + ("00" + data.startTime.month).slice(-2)
		+ "-" + data.startTime.day + " " + ("00" + hour).slice(-2) + ":" + ("00" + minute).slice(-2);

	const initialTime = moment.tz(formattedTime, "YYYY-MM-DD HH:mm", true, timzone);

	if (initialTime.valueOf() > now.valueOf()) {
		queuedEvents.insertOne({
			uid: uid, event: "scheduledRepeatReminder", due:
				initialTime.valueOf(), message: data.message, reminderId: data._id
		});
		return;
	}

	const intervalInDays : number = data.dayInterval;

	const nextDue = initialTime.add(intervalInDays, "days").valueOf();

	queuedEvents.insertOne({ uid: uid, event: "scheduledRepeatReminder", due: nextDue, message: data.message, reminderId: data._id });
};

export const repeatRemindersEvent = async (uid: string) => {
	const repeatReminders = getCollection("repeatedReminders");
	const foundReminders = await repeatReminders.find({ uid: uid }).toArray();

	const privateUserData = await getCollection("private").findOne({ uid: uid });

	// Remove all scheduled repeat reminders
	const queuedEvents = getCollection("queuedEvents");
	await queuedEvents.deleteMany({ uid: uid, event: "scheduledRepeatReminder" });

	// Re-add all repeat reminders
	foundReminders.forEach((value,) => scheduleReminder(uid, value, privateUserData));
};

export const repeatRemindersDueEvent = async (uid: string, event: any) => {
	const privateUserData = await getCollection("private").findOne({ uid: uid });
	if (privateUserData) {
		notifyUser(uid, "Reminder", event.message);
		const repeatReminders = getCollection("repeatedReminders");
		const foundReminder = await repeatReminders.findOne({ uid: uid, _id: event.reminderId });
		if (foundReminder) { // We can delete the timer
			scheduleReminder(uid, foundReminder, privateUserData);
		}
	}
};
