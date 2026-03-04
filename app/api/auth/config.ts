import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import type { Adapter } from "next-auth/adapters";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

function getEmailServer() {
  if (process.env.EMAIL_SERVER) {
    try {
      return JSON.parse(process.env.EMAIL_SERVER) as {
        host: string;
        port: number;
        auth: { user: string; pass: string };
      };
    } catch {
      console.error("EMAIL_SERVER invalid JSON, falling back to individual vars");
    }
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    const host = process.env.EMAIL_HOST ?? "smtp.gmail.com";
    const port = parseInt(process.env.EMAIL_PORT ?? "465", 10);
    return {
      host,
      port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    };
  }
  if (process.env.RESEND_API_KEY) {
    return {
      host: "smtp.resend.com",
      port: 465,
      auth: { user: "resend", pass: process.env.RESEND_API_KEY },
    };
  }
  console.warn(
    "Email not configured. Set EMAIL_USER + EMAIL_PASSWORD (Gmail) or RESEND_API_KEY or EMAIL_SERVER"
  );
  return {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: "", pass: "" },
  };
}

export const authOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    EmailProvider({
      server: getEmailServer(),
      from: process.env.EMAIL_FROM ?? "noreply@example.com",
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: { id?: string };
      user?: { id: string };
    }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
