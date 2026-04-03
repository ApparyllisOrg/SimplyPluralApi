import { readFile } from "fs";
import { promisify } from "util";
import { config } from "../config";

export const mailTemplate_accountReminder = () => "mailTemplate_accountReminder";
export const mailTemplate_emailChanged = () => "mailTemplate_emailChanged";
export const mailTemplate_exportEmail = () => "mailTemplate_exportEmail";
export const mailTemplate_passwordChanged = () => "mailTemplate_passwordChanged";
export const mailTemplate_resetPassword = () => "mailTemplate_resetPassword";
export const mailTemplate_userReport = () => "mailTemplate_userReport";
export const mailTemplate_verifyEmail = () => "mailTemplate_verifyEmail";
export const mailTemplate_cancelledSubscription = () => "mailTemplate_cancelledSubscription";
export const mailTemplate_createdSubscription = () => "mailTemplate_createdSubscription";
export const mailTemplate_reactivatedSubscription = () => "mailTemplate_reactivatedSubscription";
export const mailTemplate_changedSubscription = () => "mailTemplate_changedSubscription";
export const mailTemplate_refundedSubscription = () => "mailTemplate_refundedSubscription";
export const mailTemplate_failedPaymentCancelSubscription = () => "mailTemplate_failedPaymentCancelSubscription";

export const pageTemplate_resetPassword = () => "pageTemplate_resetPassword"; 

const filename_accountReminder = () => "./templates/accountReminder.html";
const filename_emailChanged = () => "./templates/emailChanged.html";
const filename_exportEmail = () => "./templates/exportEmailTemplate.html";
const filename_passwordChanged = () => "./templates/passwordChangedEmail.html";
const filename_resetPassword = () => "./templates/resetPasswordEmail.html";
const filename_userReport = () => "./templates/userReportEmail.html";
const filename_verifyEmail = () => "./templates/verifyEmail.html";
const filename_cancelledSubscription = () => "./templates/subscription/cancelledSubscription.html";
const filename_createdSubscription = () => "./templates/subscription/createdSubscription.html";
const filename_reactivatedSubscription = () => "./templates/subscription/reactivatedSubscription.html";
const filename_changedSubscription = () => "./templates/subscription/changedSubscription.html";
const filename_refundedSubscription = () => "./templates/subscription/refundedSubscription.html";
const filename_failedPaymentCancelSubscription = () => "./templates/subscription/failedPaymentCancelSubscription.html";

const filename_resetPasswordPage = () => "./templates/pages/resetPassword.html";

let cachedMail_accountReminder: string | undefined = undefined;
let cachedMail_emailChanged: string | undefined = undefined;
let cachedMail_exportEmail: string | undefined = undefined;
let cachedMail_passwordChanged: string | undefined = undefined;
let cachedMail_resetPassword: string | undefined = undefined;
let cachedMail_userReport: string | undefined = undefined;
let cachedMail_verifyEmail: string | undefined = undefined;
let cachedMail_cancelledSubscription: string | undefined = undefined;
let cachedMail_createdSubscription: string | undefined = undefined;
let cachedMail_reactivatedSubscription: string | undefined = undefined;
let cachedMail_changedSubscription: string | undefined = undefined;
let cachedMail_refundedSubscription: string | undefined = undefined;
let cachedMail_failedPaymentCancelSubscription: string | undefined = undefined;

let cachedPage_resetPassword: string | undefined = undefined;

export function applyBrandingReplacements(content: string): string {
    const { branding, subscription, server } = config()
    const r = (str: string, placeholder: string, value: string) => str.split(placeholder).join(value)
    content = r(content, "{{brandUrl}}", branding.url ?? "")
    content = r(content, "{{brandLogoUrl}}", branding.logoUrl ?? "")
    content = r(content, "{{brandLegalEntity}}", branding.legalEntity ?? "")
    content = r(content, "{{brandName}}", branding.name)
    content = r(content, "{{subscriptionUrl}}", subscription?.plusRootUrl ?? "")
    content = r(content, "{{subscriptionName}}", subscription?.name ?? "")
    content = r(content, "{{baseUrl}}", server.baseUrl)
    return content
}

export const loadTemplates = async () => {
    const getFile = promisify(readFile);
    const load = async (path: string) => applyBrandingReplacements(await getFile(path, "utf-8"))

    cachedMail_accountReminder = await load(filename_accountReminder())
    cachedMail_emailChanged = await load(filename_emailChanged())
    cachedMail_exportEmail = await load(filename_exportEmail())
    cachedMail_passwordChanged = await load(filename_passwordChanged())
    cachedMail_resetPassword = await load(filename_resetPassword())
    cachedMail_userReport = await load(filename_userReport())
    cachedMail_verifyEmail = await load(filename_verifyEmail())
    cachedMail_cancelledSubscription = await load(filename_cancelledSubscription())
    cachedMail_createdSubscription = await load(filename_createdSubscription())
    cachedMail_reactivatedSubscription = await load(filename_reactivatedSubscription())
    cachedMail_changedSubscription = await load(filename_changedSubscription())
    cachedMail_refundedSubscription = await load(filename_refundedSubscription())
    cachedMail_failedPaymentCancelSubscription = await load(filename_failedPaymentCancelSubscription())
    
    cachedPage_resetPassword = await load(filename_resetPasswordPage())
}

export const getTemplate = (template: string): string => {
    switch (template) {
        case mailTemplate_accountReminder(): return cachedMail_accountReminder!
        case mailTemplate_emailChanged(): return cachedMail_emailChanged!
        case mailTemplate_exportEmail(): return cachedMail_exportEmail!
        case mailTemplate_passwordChanged(): return cachedMail_passwordChanged!
        case mailTemplate_resetPassword(): return cachedMail_resetPassword!
        case mailTemplate_userReport(): return cachedMail_userReport!
        case mailTemplate_verifyEmail(): return cachedMail_verifyEmail!
        case mailTemplate_cancelledSubscription(): return cachedMail_cancelledSubscription!
        case mailTemplate_createdSubscription(): return cachedMail_createdSubscription!
        case mailTemplate_reactivatedSubscription(): return cachedMail_reactivatedSubscription!
        case mailTemplate_changedSubscription(): return cachedMail_changedSubscription!
        case mailTemplate_refundedSubscription(): return cachedMail_refundedSubscription!
        case mailTemplate_failedPaymentCancelSubscription(): return cachedMail_failedPaymentCancelSubscription!
        
        case pageTemplate_resetPassword(): return cachedPage_resetPassword!
    }

    return '';
}