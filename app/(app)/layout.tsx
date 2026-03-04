import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/signin");
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/campaigns", label: "Campaigns" },
    { href: "/adsets", label: "Ad Sets" },
    { href: "/ads", label: "Ads" },
    { href: "/creatives", label: "Creatives" },
    { href: "/recommendations", label: "Recommendations" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-lg">
            Social Ads Intelligence
          </Link>
          <nav className="flex gap-6">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {session?.user?.email}
            </span>
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
