BEGIN;
ALTER TABLE "platform_invoices" ADD COLUMN     "billing_order_id" UUID;

CREATE TABLE "billing_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "expected_subscription_id" UUID,
    "expected_subscription_version" INTEGER,
    "applied_subscription_id" UUID,
    "kind" VARCHAR(20) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'QUOTED',
    "timing" VARCHAR(16) NOT NULL,
    "cycle" VARCHAR(10) NOT NULL,
    "seats" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,3) NOT NULL,
    "subtotal" DECIMAL(12,3) NOT NULL,
    "discount" DECIMAL(12,3) NOT NULL,
    "total_due" DECIMAL(12,3) NOT NULL,
    "renewal_total" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "coupon_id" UUID,
    "coupon_snapshot" JSONB NOT NULL DEFAULT '{}',
    "plan_snapshot" JSONB NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "applied_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "client_key" UUID,
    "request_hash" VARCHAR(64),
    "error_code" VARCHAR(60),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_coupon_uses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'RESERVED',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_coupon_uses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID,
    "platform_actor_id" UUID,
    "order_id" UUID,
    "subscription_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_trial_uses" (
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_trial_uses_pkey" PRIMARY KEY ("organization_id")
);

CREATE INDEX "billing_orders_organization_id_status_created_at_idx" ON "billing_orders"("organization_id", "status", "created_at");

CREATE INDEX "billing_orders_status_effective_at_idx" ON "billing_orders"("status", "effective_at");

CREATE UNIQUE INDEX "billing_orders_organization_id_id_key" ON "billing_orders"("organization_id", "id");

CREATE UNIQUE INDEX "billing_orders_organization_id_client_key_key" ON "billing_orders"("organization_id", "client_key");

CREATE UNIQUE INDEX "billing_coupon_uses_order_id_key" ON "billing_coupon_uses"("order_id");

CREATE INDEX "billing_coupon_uses_coupon_id_state_idx" ON "billing_coupon_uses"("coupon_id", "state");

CREATE INDEX "billing_coupon_uses_organization_id_coupon_id_state_idx" ON "billing_coupon_uses"("organization_id", "coupon_id", "state");

CREATE UNIQUE INDEX "billing_coupon_uses_organization_id_order_id_key" ON "billing_coupon_uses"("organization_id", "order_id");

CREATE INDEX "billing_events_organization_id_created_at_idx" ON "billing_events"("organization_id", "created_at");

CREATE UNIQUE INDEX "platform_invoices_billing_order_id_key" ON "platform_invoices"("billing_order_id");

CREATE UNIQUE INDEX "platform_invoices_organization_id_id_key" ON "platform_invoices"("organization_id", "id");

CREATE UNIQUE INDEX "platform_invoices_organization_id_billing_order_id_key" ON "platform_invoices"("organization_id", "billing_order_id");

CREATE UNIQUE INDEX "platform_subscriptions_organization_id_id_key" ON "platform_subscriptions"("organization_id", "id");

ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_organization_id_billing_order_id_fkey" FOREIGN KEY ("organization_id", "billing_order_id") REFERENCES "billing_orders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_organization_id_membership_id_user_id_fkey" FOREIGN KEY ("organization_id", "membership_id", "user_id") REFERENCES "memberships"("organization_id", "id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_session_id_user_id_fkey" FOREIGN KEY ("session_id", "user_id") REFERENCES "user_sessions"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_organization_id_expected_subscription_id_fkey" FOREIGN KEY ("organization_id", "expected_subscription_id") REFERENCES "platform_subscriptions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_organization_id_applied_subscription_id_fkey" FOREIGN KEY ("organization_id", "applied_subscription_id") REFERENCES "platform_subscriptions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "billing_coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_coupon_uses" ADD CONSTRAINT "billing_coupon_uses_organization_id_order_id_fkey" FOREIGN KEY ("organization_id", "order_id") REFERENCES "billing_orders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_coupon_uses" ADD CONSTRAINT "billing_coupon_uses_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "billing_coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_platform_actor_id_fkey" FOREIGN KEY ("platform_actor_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_order_id_fkey" FOREIGN KEY ("organization_id", "order_id") REFERENCES "billing_orders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_subscription_id_fkey" FOREIGN KEY ("organization_id", "subscription_id") REFERENCES "platform_subscriptions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_trial_uses" ADD CONSTRAINT "billing_trial_uses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_trial_uses" ADD CONSTRAINT "billing_trial_uses_organization_id_membership_id_user_id_fkey" FOREIGN KEY ("organization_id", "membership_id", "user_id") REFERENCES "memberships"("organization_id", "id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_trial_uses" ADD CONSTRAINT "billing_trial_uses_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE platform_subscriptions ADD COLUMN usage_anchor_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE platform_subscriptions SET usage_anchor_at=created_at;
COMMIT;
