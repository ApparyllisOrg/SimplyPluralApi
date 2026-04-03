import { config } from "./config"

export const isDevelopmentInstance = () => {
    return config().development
}

export const devLog = (message: string) => 
{
    if(isDevelopmentInstance())
    {
        console.log(message);
    }
}