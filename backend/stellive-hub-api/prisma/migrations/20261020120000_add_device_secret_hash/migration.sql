-- Nullable column: existing rows keep NULL (legacy, claimed on next register) and no table rewrite is needed.
ALTER TABLE "Device" ADD COLUMN "secretHash" TEXT;
