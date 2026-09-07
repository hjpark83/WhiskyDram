import { z } from "zod";
import { AGE_BANDS, DRINK_SCENES, GENDERS } from "@/data/persona";

/** "use server" 파일은 async 함수만 내보낼 수 있어서 스키마는 여기 둬요. */
export const personaSchema = z.object({
  ageBand: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || AGE_BANDS.some((a) => a.id === v), "나이대를 다시 골라주세요."),
  gender: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || GENDERS.some((g) => g.id === v), "성별을 다시 골라주세요."),
  scenes: z
    .array(z.string())
    .max(DRINK_SCENES.length)
    .refine((v) => v.every((s) => DRINK_SCENES.some((d) => d.id === s)), "마시는 상황을 다시 골라주세요."),
  likes: z.string().trim().max(200, "200자 안으로 적어주세요."),
  avoids: z.string().trim().max(200, "200자 안으로 적어주세요."),
});

export type PersonaInput = z.infer<typeof personaSchema>;
