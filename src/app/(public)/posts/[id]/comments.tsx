"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMMENT_BODY_MAX, type PostComment } from "@/lib/community/posts";
import { addComment, deleteComment, type CommentFormState } from "../actions";

export function Comments({
  postId,
  comments,
  signedIn,
}: {
  postId: string;
  comments: PostComment[];
  signedIn: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<CommentFormState, FormData>(
    async (prev, formData) => {
      const result = await addComment(prev, formData);
      // 성공했을 때만 입력칸을 비워요 (실패하면 쓴 글이 날아가면 안 되니까요)
      if (!result?.error) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg text-amber-100">댓글 {comments.length}개</h2>

      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-amber-200/90">{c.authorName}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={c.createdAt}>
                      {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
                </div>
                {c.canDelete && (
                  <form action={deleteComment} className="shrink-0">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="postId" value={postId} />
                    <Button type="submit" size="sm" variant="ghost">
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">댓글 지우기</span>
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {signedIn ? (
        <form ref={formRef} action={formAction} className="space-y-2">
          <input type="hidden" name="postId" value={postId} />
          <label htmlFor="comment-body" className="sr-only">
            댓글
          </label>
          <textarea
            id="comment-body"
            name="body"
            rows={3}
            required
            minLength={2}
            maxLength={COMMENT_BODY_MAX}
            placeholder="궁금한 점이나 나도 마셔본 이야기를 남겨주세요."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
          />
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "다는 중…" : "댓글 달기"}
          </Button>
        </form>
      ) : (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          <Link href={`/login?next=/posts/${postId}`} className="text-amber-300 hover:underline">
            로그인
          </Link>
          하면 댓글을 남길 수 있어요.
        </p>
      )}
    </section>
  );
}
