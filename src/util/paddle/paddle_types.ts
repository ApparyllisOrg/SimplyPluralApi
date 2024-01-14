export interface LemonSubscription {
    data: LemonSubscriptionData;
    meta: LemonMeta;
}

export interface LemonSubscriptionData {
    id:                     string;
    status:                 string;
    customer_id:            string;
    address_id:             string;
    business_id:            string | null;
    currency_code:          string;
    created_at:             string;
    updated_at:             string;
    started_at:             string | null;
    first_billed_at:        string | null;
    next_billed_at:         string | null;
    paused_at:              string | null;
    canceled_at:            string | null;
    discount:               LemonDiscount | null;
    collection_mode:        string;
    billing_details:        LemonBillingDetails | null;
    current_billing_period: LemonCurrentBillingPeriod | null;
    billing_cycle:          LemonBillingCycle;
    scheduled_change:       LemonScheduledChange | null;
    items:                  LemonItem[];
    custom_data:            any;
    management_urls:        LemonManagementUrls;
}

export interface LemonDiscount
{
    id: string;
    starts_at: string;
    ends_at: string
}

export interface LemonBillingCycle {
    frequency: number;
    interval:  string;
}

export interface LemonBillingDetails {
    enable_checkout:        boolean;
    purchase_order_number:  string;
    additional_information: string | null;
    payment_terms:          LemonBillingCycle;
}

export interface LemonCurrentBillingPeriod {
    starts_at: Date;
    ends_at:   Date;
}

export interface LemonItem {
    status:               string;
    quantity:             number;
    recurring:            boolean;
    created_at:           string;
    updated_at:           string;
    previously_billed_at: string | null;
    next_billed_at:       string | null;
    price:                LemonPrice;
}

export interface LemonPrice {
    id:            string;
    product_id:    string;
    description:   string;
    tax_mode:      string;
    billing_cycle: LemonBillingCycle | null;
    unit_price:    LemonUnitPrice;
}

export interface LemonTrialDates {
    starts_at: string;
    ends_at: string;
}

export interface LemonUnitPrice {
    amount:        string;
    currency_code: string;
}

export interface LemonManagementUrls {
    update_payment_method: string | null;
    cancel:                string;
}

export interface LemonScheduledChange {
    action:       string;
    effective_at: string;
    resume_at:    string | null;
}

export interface LemonMeta {
    request_id: string;
}
