import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="text-center max-w-xl px-4">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Social Ads Intelligence
        </h1>
        <p className="text-slate-600 mb-8">
          Meta Ads analytics dashboard. Ingest data via Make.com, visualize
          performance, and get actionable recommendations.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="/auth/signin">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
