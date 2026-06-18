import { NextResponse } from "next/server";
import { isInternalAuthEnabled, setInternalSession } from "@/lib/internal/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_GUEST_EMAIL = "novelforge.guest.internal@gmail.com";
const DEFAULT_GUEST_PASSWORD = "novelforge-internal-guest";

function getGuestCredentials() {
  const email = process.env.INTERNAL_GUEST_EMAIL?.trim() || DEFAULT_GUEST_EMAIL;
  const password =
    process.env.INTERNAL_GUEST_PASSWORD?.trim() || DEFAULT_GUEST_PASSWORD;

  if (!email.includes("@") || password.length < 6) {
    throw new Error(
      "INTERNAL_GUEST_EMAIL or INTERNAL_GUEST_PASSWORD is not configured correctly",
    );
  }

  return { email, password };
}

function isInvalidCredentials(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "invalid_credentials" ||
    /invalid login credentials/i.test(message)
  );
}

async function createGuestWithAdmin(email: string, password: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return false;
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      accountType: "internal_guest",
    },
  });

  if (error && !/already registered|already exists|already been registered/i.test(error.message)) {
    throw error;
  }

  return true;
}

export async function POST() {
  if (isInternalAuthEnabled()) {
    const response = NextResponse.json({ ok: true, mode: "internal" });
    setInternalSession(response);
    return response;
  }

  let email: string;
  let password: string;

  try {
    ({ email, password } = getGuestCredentials());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal guest credentials are not configured.",
      },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const firstSignIn = await supabase.auth.signInWithPassword({ email, password });

  if (!firstSignIn.error) {
    return NextResponse.json({ ok: true });
  }

  if (!isInvalidCredentials(firstSignIn.error)) {
    return NextResponse.json(
      { error: firstSignIn.error.message || "Guest sign-in failed." },
      { status: 401 },
    );
  }

  try {
    const createdWithAdmin = await createGuestWithAdmin(email, password);

    if (!createdWithAdmin) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            accountType: "internal_guest",
          },
        },
      });

      if (error) {
        return NextResponse.json(
          { error: error.message || "Guest account creation failed." },
          { status: 500 },
        );
      }

      if (!data.session) {
        return NextResponse.json(
          {
            error:
              "Guest account was created, but this Supabase project requires email confirmation. Disable email confirmation or configure SUPABASE_SERVICE_ROLE_KEY.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({ ok: true });
    }

    const secondSignIn = await supabase.auth.signInWithPassword({ email, password });

    if (secondSignIn.error) {
      return NextResponse.json(
        { error: secondSignIn.error.message || "Guest sign-in failed." },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Guest account initialization failed.",
      },
      { status: 500 },
    );
  }
}
