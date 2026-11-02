-- Clerk identity link (Clerk auth track).
-- Additive only: nullable column + unique index. Existing rows keep
-- clerkUserId = NULL and link lazily on first Clerk sign-in (verified email).
ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;

CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
