import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type AuthValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<"mfa" | "ok">;
  verifyMfa: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function adminUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase.from("administrators").select("user_id").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return userId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    client.auth.getSession().then(async ({ data }) => {
      const next = data.session;
      const allowed = next ? Boolean(await adminUserId()) : false;
      if (!active) return;
      if (next && !allowed) await client.auth.signOut();
      setSession(allowed ? next : null);
      setIsAdmin(allowed);
      setLoading(false);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setIsAdmin(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      configured: supabaseConfigured,
      loading,
      session,
      isAdmin,
      email: session?.user.email ?? null,
      async signIn(email, password) {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (level?.currentLevel === "aal1" && level.nextLevel === "aal2") return "mfa";
        const allowed = await adminUserId();
        if (!allowed) {
          await supabase.auth.signOut();
          throw new Error("This account is not a Syntrex Group Limited administrator.");
        }
        setIsAdmin(true);
        return "ok";
      },
      async verifyMfa(code) {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;
        const factor = factors.totp[0];
        if (!factor) throw new Error("No authenticator is enrolled for this account.");
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (challengeError) throw challengeError;
        const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
        if (error) throw error;
        const allowed = await adminUserId();
        if (!allowed) {
          await supabase.auth.signOut();
          throw new Error("This account is not a Syntrex Group Limited administrator.");
        }
        setIsAdmin(true);
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        setIsAdmin(false);
      },
    }),
    [isAdmin, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
}
