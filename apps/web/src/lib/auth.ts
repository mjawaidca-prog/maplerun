/**
 * Auth.js v5 configuration — magic link (Resend) + Google OAuth.
 *
 * Session strategy: JWT (stateless, no DB session lookups per request).
 * The Prisma adapter is used only for User/Account persistence; sessions
 * live in signed JWTs. companyId is attached during sign-in from Membership.
 */

import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Resend({
      from: process.env.AUTH_RESEND_FROM ?? "noreply@nexvarlab.com",
    }),
    // Google OAuth — works when AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET are set
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-request",
    error: "/sign-in",
  },

  callbacks: {
    /**
     * Attach the user's primary companyId to the JWT.
     * A user with multiple memberships gets their first (or most recent) company.
     * Switching companies is a separate UX concern.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // Look up the user's first membership to set default companyId
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
          select: { companyId: true },
        });
        if (membership) {
          token.companyId = membership.companyId;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.companyId = token.companyId as string | undefined;
      }
      return session;
    },
  },
});
