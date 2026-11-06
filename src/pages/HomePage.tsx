import { Link } from "react-router-dom";
import { btnPrimary } from "@/lib/styles";

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <p className="text-xs tracking-wide text-accent">Syntrex Group Limited</p>
      <h1 className="mt-2 text-4xl font-semibold">Google Review NFC Dashboard</h1>
      <p className="mt-3 text-muted">Customer review links open the business page directly. Staff tools stay private.</p>
      <Link className={`${btnPrimary} mt-6 w-fit`} to="/login">
        Staff sign in
      </Link>
    </main>
  );
}
