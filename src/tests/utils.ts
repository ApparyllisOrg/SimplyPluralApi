
let _token = "";

export const setTestToken = (token: string) =>
{
	_token = token
}

export const getTestToken = () => _token

export const getTestAxiosUrl = (route: string) => "http://localhost:3000/" + route