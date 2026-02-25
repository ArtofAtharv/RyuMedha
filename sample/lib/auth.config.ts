import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export const authConfig = {
  pages: {
    signIn: "api/auth/signin",
  },
  providers: [
    Google({
      // Using "as string" fixes: 'string | undefined' is not assignable to type 'string'
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID as string,
      clientSecret: process.env.AUTH_GITHUB_SECRET as string,
    }),
  ],
  callbacks: {
    // Adding explicit types fixes: Binding element implicitly has 'any' type
    authorized({ auth, request: { nextUrl } }: { auth: any; request: { nextUrl: any } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.toLowerCase().startsWith("/dashboard");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to signin
      }
      return true;
    },
    async jwt({ token, user, trigger, session }: any) {
      if (user) {
        token.id = user.id;
        // token.programId = user.programId; 
      }
      
      // Update session when triggered from client
      if (trigger === "update" && session?.programId) {
        token.programId = session.programId; 
      }
      
      return token;
    },
    async session({ session, token }: any) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        // Explicitly cast to include custom property
        (session.user as any).programId = token.programId;
      }
      return session;
    }
  },
} satisfies NextAuthConfig;