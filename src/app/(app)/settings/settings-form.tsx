"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGE_BANDS, DRINK_SCENES, GENDERS, type Persona } from "@/data/persona";
import { updateNickname, updatePersona, type SettingsState } from "./actions";

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

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-amber-400/20 bg-background px-3 text-sm text-amber-50 outline-none focus:border-amber-400/60";

/**
 * 내 정보.
 *
 * 화면에서도 무엇이 추천에 쓰이고 무엇이 안 쓰이는지 밝혀요 — 물어봤으면
 * 어디에 쓰는지도 말해주는 게 맞아요.
 */
export function PersonaForm({ initial }: { initial: Persona }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(updatePersona, null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ageBand">나이대</Label>
          <select id="ageBand" name="ageBand" className={SELECT_CLASS} defaultValue={initial.ageBand ?? ""}>
            <option value="">선택 안 함</option>
            {AGE_BANDS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            도수·가격 감각을 맞추는 데 참고해요. 나이로 취향을 단정하지는 않아요.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">성별</Label>
          <select id="gender" name="gender" className={SELECT_CLASS} defaultValue={initial.gender ?? ""}>
            <option value="">선택 안 함</option>
            {GENDERS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            <strong>추천 계산에는 쓰지 않아요.</strong> 성별로 취향을 나누면 추천이 오히려 나빠져서요.
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-amber-50">주로 어떤 자리에서 마셔요?</legend>
        <p className="text-xs text-muted-foreground">여러 개 고를 수 있어요. 이건 추천에 바로 쓰여요.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {DRINK_SCENES.map((scene) => (
            <label
              key={scene.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-sm transition-colors has-[:checked]:border-amber-400/70 has-[:checked]:bg-amber-500/15"
            >
              <input
                type="checkbox"
                name="scenes"
                value={scene.id}
                defaultChecked={initial.scenes.includes(scene.id)}
                className="mt-0.5 accent-amber-500"
              />
              <span>
                <span className="block text-amber-50">{scene.label}</span>
                <span className="block text-xs text-muted-foreground">{scene.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="likes">좋아하는 향·맛 (선택)</Label>
        <Input
          id="likes"
          name="likes"
          defaultValue={initial.likes}
          maxLength={200}
          placeholder="예: 바닐라 같은 달콤한 향, 과일 향"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avoids">피하고 싶은 것 (선택)</Label>
        <Input
          id="avoids"
          name="avoids"
          defaultValue={initial.avoids}
          maxLength={200}
          placeholder="예: 소독약 냄새, 너무 독한 건 싫어요"
        />
        <p className="text-xs text-muted-foreground">
          여기 적은 건 추천할 때 꼭 지켜요.
        </p>
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
        {pending ? "저장 중…" : "내 정보 저장"}
      </Button>
    </form>
  );
}
