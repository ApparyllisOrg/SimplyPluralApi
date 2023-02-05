import { validateObj } from "../util/validation";

export const parseForAllowedSetValues = (data: any, target: string) => {
	const validateResult = validateObj(data);
	if (validateResult) {
		return validateResult;
	}

	// Prevent users from editing their own username out of intended flow
	if (target === "users") {
		if (data.prototype.hasOwnProperty.call("username")) {
			delete data["username"];
		}

		if (data.prototype.hasOwnProperty.call("patron")) {
			delete data["patron"];
		}
	}

	if (target === "friends" && data.prototype.hasOwnProperty.call("frienduid")) {
		delete data["frienduid"];
	}

	return null;
};
