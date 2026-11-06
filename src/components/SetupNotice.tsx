export function SetupNotice() {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 text-sm leading-6 text-muted">
      <h2 className="text-base font-semibold text-white">Connect Supabase before signing in</h2>
      <p className="mt-2">
        This app does not include a password. Create a free Supabase project, run the database migration, turn off
        public sign-up, then add your own administrator. The steps are in the README.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5">
        <li>Copy <code className="text-white">.env.example</code> to <code className="text-white">.env.local</code>.</li>
        <li>Add the project URL and anon key.</li>
        <li>Run <code className="text-white">supabase/migrations/20261106170000_init.sql</code> in the Supabase SQL editor.</li>
        <li>Create a user in Authentication, then insert that user into <code className="text-white">administrators</code>.</li>
      </ol>
    </section>
  );
}
