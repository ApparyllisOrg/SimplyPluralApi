import { Request, Response } from "express"
import { config } from "../../modules/config"

interface ApiConfig {
  oauth: {
    apple: boolean;
    google: boolean;
  }
  integrations: {
    pluralKit: boolean;
  }
  storage: {
    baseUrl: string;
  } | null;
  subscription: {
    name: string;
    url: string;
  } | null;
  branding: {
    name: string;
    legalEntity: string | null;
    url: string | null;
    logoUrl: string | null;
  }
}

const readApiConfig = (): ApiConfig => {
	const cfg = config()

	return {
		oauth: {
			apple: !!cfg.appleOAuth,
			google: !!cfg.googleOAuth,
		},
		integrations: {
			pluralKit: !!cfg.pluralKit,
		},
		storage: cfg.storage ? {
			baseUrl: cfg.storage.baseUrl,
		} : null,
		subscription: cfg.subscription ? {
			name: cfg.subscription.name,
			url: cfg.subscription.plusRootUrl,
		} : null,
		branding: {
			name: cfg.branding.name,
			legalEntity: cfg.branding.legalEntity,
			url: cfg.branding.url,
			logoUrl: cfg.branding.logoUrl,
		},
	}
}

let cachedConfig: ApiConfig | null = null

export const getApiConfig = (_req: Request, res: Response) => {
	if (!cachedConfig) {
		cachedConfig = readApiConfig()
	}

	res.status(200).send(cachedConfig)
}