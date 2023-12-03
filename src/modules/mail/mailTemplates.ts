import { readFile } from "fs";
import { promisify } from "util";

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

export const loadTemplates = async () => {
    const getFile = promisify(readFile);

    cachedMail_accountReminder = await getFile(filename_accountReminder(), "utf-8")
    cachedMail_emailChanged = await getFile(filename_emailChanged(), "utf-8")
    cachedMail_exportEmail = await getFile(filename_exportEmail(), "utf-8")
    cachedMail_passwordChanged = await getFile(filename_passwordChanged(), "utf-8")
    cachedMail_resetPassword = await getFile(filename_resetPassword(), "utf-8")
    cachedMail_userReport = await getFile(filename_userReport(), "utf-8")
    cachedMail_verifyEmail = await getFile(filename_verifyEmail(), "utf-8")
    cachedMail_cancelledSubscription = await getFile(filename_cancelledSubscription(), "utf-8")
    cachedMail_createdSubscription = await getFile(filename_createdSubscription(), "utf-8")
    cachedMail_reactivatedSubscription = await getFile(filename_reactivatedSubscription(), "utf-8")
    cachedMail_changedSubscription = await getFile(filename_changedSubscription(), "utf-8")
    cachedMail_refundedSubscription = await getFile(filename_refundedSubscription(), "utf-8")
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
    }

    return '';
}