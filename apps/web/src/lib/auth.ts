/**
 * Auth.js v5 configuration — magic link (Resend) + Google OAuth +
 * email/password (Credentials, scrypt hashes in User.passwordHash).
 *
 * Session strategy: JWT (stateless, no DB session lookups per request).
 * The Prisma adapter is used only for User/Account persistence; sessions
 * live in signed JWTs. companyId is attached during sign-in from Membership.
 */

import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyCredentials } from "@/lib/credentials";

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
    // Email + password — accounts are created by /api/register (no
    // email-verification gate, mirroring LedgerPro, so an accountant can
    // create a client's account for them; the owner can always reclaim
    // the account through the magic-link or Google sign-in for the same
    // email). authorize() returns null for every failure mode.
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";
        return verifyCredentials(email, password);
      },
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
