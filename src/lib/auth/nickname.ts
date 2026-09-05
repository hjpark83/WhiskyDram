import { z } from "zod";

/**
 * 화면에 보일 이름. 사이트 전체에서 이 이름으로 불러요.
 * ("use server" 파일은 async 함수만 내보낼 수 있어서 여기에 따로 뒀어요.)
 */
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, { error: "닉네임은 2자 이상이어야 해요." })
  .max(12, { error: "닉네임은 12자까지 쓸 수 있어요." });
