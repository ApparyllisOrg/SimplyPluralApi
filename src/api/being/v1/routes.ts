
import * as core from 'express-serve-static-core';
import { ApiKeyAccessType } from '../../../modules/api/keys';
import { isUserAuthenticated } from '../../../security/auth';
import { validateBody, validateId } from '../../../util/validation';

import * as symptom from './symptom';
import * as symptomLog from './symptomLog';
import * as medication from './medication';
import * as medicationLog from './medicationLog';
import * as user from './user';

export const setupV1routes = (app: core.Express) => {
	// Symptoms
	app.get("/being/v1/symptom/:id", isUserAuthenticated(ApiKeyAccessType.Read), symptom.get)
	app.get("/being/v1/symptoms", isUserAuthenticated(ApiKeyAccessType.Read), symptom.getAll)
	app.post("/being/v1/symptom/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(symptom.validatePostSymptomSchema), validateId, symptom.add)
	app.patch("/being/v1/symptom/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(symptom.validatePatchSymptomSchema), symptom.update)
	app.delete("/being/v1/symptom/:id", isUserAuthenticated(ApiKeyAccessType.Delete), symptom.del)

	// Symptom logs
	app.get("/being/v1/logs/symptom/:id", isUserAuthenticated(ApiKeyAccessType.Read), symptomLog.get)
	app.get("/being/v1/logs/symptoms", isUserAuthenticated(ApiKeyAccessType.Read), symptomLog.getSymptomLogs)
	app.post("/being/v1/logs/symptom/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(symptomLog.validatePostSymptomLogSchema), validateId, symptomLog.add)
	app.patch("/being/v1/logs/symptom/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(symptomLog.validatePatchSymptomLogSchema), symptomLog.update)
	app.delete("/being/v1/logs/symptom/:id", isUserAuthenticated(ApiKeyAccessType.Delete), symptomLog.del)

	// Medication
	app.get("/being/v1/medication/:id", isUserAuthenticated(ApiKeyAccessType.Read), medication.get)
	app.get("/being/v1/medications", isUserAuthenticated(ApiKeyAccessType.Read), medication.getAll)
	app.post("/being/v1/medication/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(medication.validatePostMedicationSchema), validateId, medication.add)
	app.patch("/being/v1/medication/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(medication.validatePatchMedicationSchema), medication.update)
	app.delete("/being/v1/medication/:id", isUserAuthenticated(ApiKeyAccessType.Delete), medication.del)

	// Medication logs
	app.get("/being/v1/logs/medication/:id", isUserAuthenticated(ApiKeyAccessType.Read), medicationLog.get)
	app.get("/being/v1/logs/medications", isUserAuthenticated(ApiKeyAccessType.Read), medicationLog.getMedicationLogs)
	app.post("/being/v1/logs/medication/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(medicationLog.validatePostMedicationLogSchema), validateId, medicationLog.add)
	app.patch("/being/v1/logs/medication/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(medicationLog.validatePatchMedicationLogSchema), medicationLog.update)
	app.delete("/being/v1/logs/medication/:id", isUserAuthenticated(ApiKeyAccessType.Delete), medicationLog.del)

	// User
	app.get("/being/v1/user/:id", isUserAuthenticated(ApiKeyAccessType.Read), user.get)
	app.patch("/being/v1/user/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(user.validateUserSchema), user.update)
	app.delete("/being/v1/user/:id", isUserAuthenticated(ApiKeyAccessType.Delete), user.del)
}
