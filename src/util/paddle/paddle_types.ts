export interface PaddleSubscription {
    data: PaddleSubscriptionData;
    meta: PaddleMeta;
}

export interface PaddleSubscriptionData {
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
    discount:               PaddleDiscount | null;
    collection_mode:        string;
    billing_details:        PaddleBillingDetails | null;
    current_billing_period: PaddleCurrentBillingPeriod | null;
    billing_cycle:          PaddleBillingCycle;
    scheduled_change:       PaddleScheduledChange | null;
    items:                  PaddleItem[];
    custom_data:            any;
    management_urls:        PaddleManagementUrls;
}

export interface PaddleDiscount
{
    id: string;
    starts_at: string;
    ends_at: string
}

export interface PaddleBillingCycle {
    frequency: number;
    interval:  string;
}

export interface PaddleBillingDetails {
    enable_checkout:        boolean;
    purchase_order_number:  string;
    additional_information: string | null;
    payment_terms:          PaddleBillingCycle;
}

export interface PaddleCurrentBillingPeriod {
    starts_at: Date;
    ends_at:   Date;
}

export interface PaddleItem {
    status:               string;
    quantity:             number;
    recurring:            boolean;
    created_at:           string;
    updated_at:           string;
    previously_billed_at: string | null;
    next_billed_at:       string | null;
    price:                PaddlePrice;
}

export interface PaddlePrice {
    id:            string;
    product_id:    string;
    description:   string;
    tax_mode:      string;
    billing_cycle: PaddleBillingCycle | null;
    unit_price:    PaddleUnitPrice;
}

export interface PaddleTrialDates {
    starts_at: string;
    ends_at: string;
}

export interface PaddleUnitPrice {
    amount:        string;
    currency_code: string;
}

export interface PaddleManagementUrls {
    update_payment_method: string | null;
    cancel:                string;
}

export interface PaddleScheduledChange {
    action:       string;
    effective_at: string;
    resume_at:    string | null;
}

export interface PaddleMeta {
    request_id: string;
}
