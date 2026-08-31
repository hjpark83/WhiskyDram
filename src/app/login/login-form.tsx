"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signInWithGoogle, signUp, type AuthState } from "./actions";

// Google provider is not yet configured in Supabase — hide the button until it is.
// Flip to true after enabling Providers > Google in the Supabase dashboard.
const GOOGLE_LOGIN_ENABLED = false;

function CredentialsForm({
  action,
  submitLabel,
  next,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
  next: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor={`${submitLabel}-email`}>이메일</Label>
        <Input
          id={`${submitLabel}-email`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${submitLabel}-password`}>비밀번호</Label>
        <Input
          id={`${submitLabel}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="6자 이상"
          required
          minLength={6}
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="text-sm text-muted-foreground" role="status">
          {state.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "잠시만요…" : submitLabel}
      </Button>
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="signin">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">로그인</TabsTrigger>
          <TabsTrigger value="signup">회원가입</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="pt-4">
          <CredentialsForm action={signIn} submitLabel="로그인" next={next} />
        </TabsContent>
        <TabsContent value="signup" className="pt-4">
          <CredentialsForm action={signUp} submitLabel="회원가입" next={next} />
        </TabsContent>
      </Tabs>

      {GOOGLE_LOGIN_ENABLED && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                또는
              </span>
            </div>
          </div>

          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="w-full">
              Google로 계속하기
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
