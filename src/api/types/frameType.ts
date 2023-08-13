export const frameType = {
    type: "object",
    properties: {
        bgShape: { type: "string", pattern: "^[A-Za-z0-9]{0,50}$" },
        bgClip: { type: "string", pattern: "^[A-Za-z0-9]{0,50}$" },
        bgStartColor: { type: "string" },
        bgEndColor: { type: "string" },
    },
    nullable: false,
    additionalProperties: false,
    required: ["bgShape", "bgClip", "bgStartColor", "bgEndColor"],
};
