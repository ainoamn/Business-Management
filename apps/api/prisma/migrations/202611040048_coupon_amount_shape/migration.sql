BEGIN;
ALTER TABLE billing_coupons ADD CONSTRAINT billing_coupon_amount_present CHECK((kind='PERCENT' AND basis_points IS NOT NULL AND amount IS NULL) OR (kind='FIXED' AND basis_points IS NULL AND amount IS NOT NULL));
COMMIT;
