// app/auth/signin/page.tsx
import { signIn } from "@/lib/auth";
import { HiMail } from "react-icons/hi";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#09090b] px-4">
      <div className="w-full max-w-md space-y-8 rounded-[40px] bg-white dark:bg-zinc-900 p-10 shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-linear-to-br from-indigo-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 mb-4">
            <span className="text-white font-black text-2xl">A</span>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Welcome Back</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sign in to sync your academic progress</p>
        </div>

        <div className="space-y-3">
          {/* GitHub Action */}
          <form action={async () => { "use server"; await signIn("github", { redirectTo: "/Dashboard" }) }}>
            <button className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-all active:scale-95">
              <img src="https://authjs.dev/img/providers/github.svg" className="w-5 h-5 dark:invert" alt="GitHub" />
              Continue with GitHub
            </button>
          </form>

          {/* Google Action */}
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/Dashboard"}) }}>
            <button className="w-full flex items-center justify-center gap-3 py-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all active:scale-95">
              <img src="https://authjs.dev/img/providers/google.svg" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-200 dark:border-zinc-800"></span></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black text-zinc-400 tracking-widest"><span className="bg-white dark:bg-zinc-900 px-4">Magic Link</span></div>
          </div>

          {/* Email Action */}
          <form action={async (formData) => { 
            "use server"; 
            const email = formData.get("email") as string;
            await signIn("nodemailer", { email, redirectTo: "/Dashboard" });
          }} className="space-y-3">
            <div className="relative">
              <HiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
              <input 
                name="email" 
                type="email" 
                placeholder="Enter your university email" 
                required 
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-transparent py-4 pl-12 pr-4 outline-none focus:ring-2 ring-purple-500/20 transition-all dark:text-white"
              />
            </div>
            <button type="submit" className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-95">
              Send Login Link
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}