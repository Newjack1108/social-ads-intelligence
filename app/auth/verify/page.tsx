import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
        <p className="text-muted-foreground mb-6">
          A sign-in link has been sent to your email address.
        </p>
        <Button asChild>
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
