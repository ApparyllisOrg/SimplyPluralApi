import { notifyUser } from "../../util";
import { getCollection, parseId } from "../mongo";

export const notifyOfFrontChange = async (uid: string, removed: boolean, memberId: string) => {

	// Removed doesn't do anything for now, this is placeholder code to add support for reacting to removal of front changes
	if (removed === true)
		return;

	const automatedReminders = getCollection("automatedReminders");
	const foundReminders = await automatedReminders.find({ uid: uid }).toArray();

	const foundMember = await getCollection("members").findOne({ _id: parseId(memberId) })
	const custom = !foundMember

	// enum ESelectedAction { MemberFront, Customfront, AnyFront } <= Dart code
	foundReminders.forEach((reminder: any) => {
		const selectedAction = reminder.type;
		if (selectedAction == 2) {
			scheduleAutomatedReminder(uid, reminder);
			return;
		}

		if (selectedAction == 1 && custom) {
			scheduleAutomatedReminder(uid, reminder);
			return;
		}

		if (selectedAction == 0 && !custom) {
			scheduleAutomatedReminder(uid, reminder);
			return;
		}
	});
};

export const scheduleAutomatedReminder = async (uid: string, data: any) => {
	const queuedEvents = getCollection("queuedEvents");

	const now = Date.now();
	const due = now + (data.delayInHours * 60 * 60 * 1000);

	queuedEvents.updateOne({
		uid: uid, event: "scheduledAutomatedReminder", reminderId: data._id
	}, { $set: { uid: uid, event: "scheduledAutomatedReminder", reminderId: data._id, due: due } }, { upsert: true });

	return;
};

export const automatedRemindersDueEvent = async (uid: string, event: any) => {
	const automatedReminders = getCollection("automatedReminders");
	const foundReminder = await automatedReminders.findOne({ uid: uid, _id: event.reminderId });
	if (foundReminder) { // We can delete the timer
		notifyUser(uid, "Reminder", foundReminder.message);
	}
};

export const removeDeletedReminders = async (uid: string) => {
	const automatedReminders = getCollection("automatedReminders");
	const queuedEvents = getCollection("queuedEvents");

	const foundReminders = await automatedReminders.find({ uid: uid }).toArray();
	const foundScheduledRemidners = await queuedEvents.find({ uid: uid }).toArray();

	foundScheduledRemidners.forEach((scheduledReminder: any) => {
		let found = false;

		foundReminders.forEach((reminder: any) => {
			if (reminder._id === scheduledReminder.reminderId) {
				found = true;
			}
		});

		if (found) {
			queuedEvents.deleteOne({ _id: scheduledReminder._id });
		}
	});
};