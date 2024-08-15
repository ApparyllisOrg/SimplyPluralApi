import { getCollection } from "../mongo"
import { Collection, ObjectId } from "mongodb"
import promclient from "prom-client"
import { messaging } from "firebase-admin"
import moment from "moment"
import { notify as socketNotify } from "../../modules/socket"
import { isUserSuspended } from "../../security"
import { logger } from "../logger"

export interface Notification {
	// Token this notification is addressed to
	token: string

	// uid of the instigator
	instigator: string

	// Message of the notificaton
	message: string

	// Title of the notification
	title: string

	// When the notification expires
	expireAt: Date

	// Unique Id of the notification
	_id: ObjectId | undefined
}

export const pollNotifications = async (token: string): Promise<Notification[]> => {
	const pendingNotifications = await getCollection("notifications").find({ token }).toArray()
	if (pendingNotifications.length > 0) {
		const polledNotifications: Array<Notification> = pendingNotifications.map((element) => {
			return { token: token, instigator: element.instigator, message: element.message, title: element.title, expireAt: element.expireAt, _id: element._id }
		})
		return polledNotifications
	}

	return []
}

export const deleteNotification = async (_id: ObjectId) => {
	await getCollection("notifications").deleteOne({ _id })
}

export const scheduleNotification = async (notification: Notification) => {
	await getCollection("notifications").insertOne(notification)
}

const counter = new promclient.Counter({
	name: "apparyllis_api_notifs",
	help: "Counter for notifs sent",
})

interface NotificationPrivateCollection {
	_id: ObjectId | string
	uid: string
	notificationHistory: { timestamp: number; title: string; message: string }[]
	notificationToken: string[]
}

const sendNotification = async (notification: Notification) => {
	counter.inc()

	scheduleNotification(notification)

	// Firebase backwards support
	{
		const sendPayload = {
			token: notification.token,
			notification: { title: notification.title, body: notification.message },
			apns: { headers: { "apns-expiration": Math.round(notification.expireAt.getUTCSeconds()).toString() } },
		}
		messaging()
			.send(sendPayload)
			.catch(async (error) => {
				if (error.code === "messaging/registration-token-not-registered") {
					const privateCollection: Collection<NotificationPrivateCollection> = getCollection("private")
					privateCollection.updateOne({ uid: notification.instigator, _id: notification.instigator }, { $pull: { notificationToken: notification.token } })
				} else {
					logger.log("error", error)
				}
			})
	}
}

export const notifyUser = async (instigator: string, target: string, title: string, message: string, lifetime?: number | undefined) => {
	// Don't send empty notifications
	if (!message) {
		return
	}

	// Don't send notifications to users who are suspended
	const isSuspended = await isUserSuspended(target)
	if (isSuspended) {
		return
	}

	socketNotify(target, title, message)

	if (message.length > 1000) {
		message = message.substring(0, 999)
	}

	const privateCollection: Collection<NotificationPrivateCollection> = getCollection("private")
	const privateData = await privateCollection.findOne({ uid: target, _id: target })
	if (privateData) {
		const notificationLifetime = lifetime ?? 1000 * 60 * 60 * 6

		privateCollection.updateOne(
			{ uid: target, _id: target },
			{
				$push: {
					notificationHistory: {
						$each: [
							{
								timestamp: Date.now(),
								title,
								message,
							},
						],
						$slice: -30,
					},
				},
			}
		)

		const token = privateData["notificationToken"]
		if (Array.isArray(token)) {
			token.forEach((element) => {
				sendNotification({ token: element, title, message, expireAt: new Date(moment.now().valueOf() + notificationLifetime), instigator, _id: undefined })
			})
		}
	}
}
