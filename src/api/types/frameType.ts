export const frameType = {
	type: "object",
	anyOf: [
		{
			properties: {
				bgShape: { type: ["string", "null"], pattern: "^[A-Za-z0-9]{0,50}$" },
				bgClip: { type: ["string", "null"], pattern: "^[A-Za-z0-9]{0,50}$" },
				bgStartColor: { type: ["string", "null"] },
				bgEndColor: { type: ["string", "null"] },
			},
			additionalProperties: false,
			required: ["bgShape", "bgClip", "bgStartColor", "bgEndColor"],
		},
		{
			properties: {},
			additionalProperties: false,
			required: [],
		},
	],
};

export type Frame = {
	bgShape: string;
	bgClip: string;
	bgStartColor: string;
	bgEndColor: string;
};
