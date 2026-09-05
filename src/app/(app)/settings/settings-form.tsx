"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateNickname, type SettingsState } from "./actions";

export function NicknameForm({ initial }: { initial: string }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(updateNickname, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          name="nickname"
          defaultValue={initial}
          required
          minLength={2}
          maxLength={12}
          autoComplete="nickname"
        />
        <p className="text-xs text-muted-foreground">2~12자. 홈 인사말과 공유 카드에 쓰여요.</p>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="text-sm text-amber-300" role="status">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </Button>
    </form>
  );
}
