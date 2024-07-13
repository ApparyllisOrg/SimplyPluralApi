export const limitStringLength = (value: string | undefined, length: number, appendDots: boolean = false) => {
	let newValue = undefined
	if (value != null && value != undefined) {
		if (value.length > length) {
			newValue = value.substring(0, length) + (appendDots ? "..." : "")
		} else {
			newValue = value
		}
	}
	return newValue
}
