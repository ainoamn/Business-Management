ALTER TABLE "users" ADD COLUMN "bhd_sub" UUID;
CREATE UNIQUE INDEX "users_bhd_sub_key" ON "users"("bhd_sub");
