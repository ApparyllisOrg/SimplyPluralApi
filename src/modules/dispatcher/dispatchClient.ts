
import { logger } from '../logger';
import { ChangeEvent } from '../socket';
import { dispathDbEventReceived } from './dispatch';

import redis from "redis";

// Todo: Set url to connect to
export const client = redis.createClient();

export const initializeRedis = async () => {
	client.on('error', (err) => logger.error("[REDIS] " + err));

	await client.connect();

	const subscriber = client.duplicate();
	await subscriber.connect();

	await subscriber.subscribe('dbevent', (message) => {
		const jsonMessage: { [key: string]: string } = JSON.parse(message);
		const change: ChangeEvent = { documentId: jsonMessage.documentId, uid: jsonMessage.uid, collection: jsonMessage.collection, operationType: Number(jsonMessage.operationType) }
		dispathDbEventReceived(change)
	});
};