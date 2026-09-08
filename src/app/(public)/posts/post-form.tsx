"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POST_BODY_MAX, POST_TITLE_MAX, type Post } from "@/lib/community/posts";
import { cn } from "@/lib/utils";
import { createPost, updatePost, type PostFormState } from "./actions";

export interface WhiskyOption {
  id: string;
  label: string;
}

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40";

export function PostForm({
  whiskies,
  post,
  defaultWhiskyId,
}: {
  whiskies: WhiskyOption[];
  /** 수정할 때만 넘겨요 */
  post?: Post;
  /** 위스키 상세에서 "이 병 후기 쓰기" 로 들어온 경우 */
  defaultWhiskyId?: string;
}) {
  const editing = Boolean(post);
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    editing ? updatePost : createPost,
    null,
  );

  const [query, setQuery] = useState("");
  const [whiskyId, setWhiskyId] = useState(post?.whiskyId ?? defaultWhiskyId ?? "");
  const [rating, setRating] = useState(post?.rating ?? 0);

  // 500병이 넘어서 <select> 에 다 넣으면 찾기가 어려워요. 검색으로 좁혀요.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return whiskies.filter((w) => w.label.toLowerCase().includes(q)).slice(0, 8);
  }, [whiskies, query]);

  const selected = whiskies.find((w) => w.id === whiskyId);

  return (
    <form action={formAction} className="space-y-5">
      {editing && <input type="hidden" name="id" value={post?.id} />}
      <input type="hidden" name="whiskyId" value={whiskyId} />
      <input type="hidden" name="rating" value={rating || ""} />

      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          name="title"
          defaultValue={post?.title}
          required
          minLength={2}
          maxLength={POST_TITLE_MAX}
          placeholder="예: 첫 셰리 위스키로 글렌드로낙 12년을 마셔봤어요"
        />
      </div>

      <div className="space-y-2">
        <Label>어떤 병에 대한 글인가요?</Label>
        <p className="text-xs text-muted-foreground">
          안 골라도 돼요. 고르면 그 병 화면에서도 이 글이 보여요.
        </p>
        {selected ? (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{selected.label}</span>
            <button
              type="button"
              onClick={() => {
                setWhiskyId("");
                setQuery("");
              }}
              className="shrink-0 text-xs text-muted-foreground hover:text-amber-300"
            >
              바꾸기
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름으로 검색 (예: 글렌피딕, Macallan)"
            />
            {matches.length > 0 && (
              <ul className="divide-y rounded-md border">
                {matches.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setWhiskyId(w.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-amber-500/10"
                    >
                      {w.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>별점</Label>
        <p className="text-xs text-muted-foreground">
          안 줘도 돼요. 후기가 아니라 이야기 글일 수도 있으니까요.
        </p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              // 같은 별을 다시 누르면 별점을 지워요
              onClick={() => setRating(rating === n ? 0 : n)}
              aria-label={`${n}점`}
              aria-pressed={rating >= n}
              className={cn(
                "size-9 rounded-md border text-lg transition",
                rating >= n ? "border-amber-400/60 text-amber-300" : "text-muted-foreground",
              )}
            >
              ★
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-muted-foreground">{rating}점</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">내용</Label>
        <textarea
          id="body"
          name="body"
          defaultValue={post?.body}
          required
          minLength={10}
          maxLength={POST_BODY_MAX}
          rows={14}
          className={FIELD_CLASS}
          placeholder={
            "어떤 자리에서 마셨는지, 어떤 향과 맛이 났는지, 다시 살 건지 편하게 적어주세요.\n\n어려운 용어는 안 써도 괜찮아요. '나무 냄새가 났다', '생각보다 안 달았다' 같은 말이 오히려 도움이 돼요."
          }
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "올리는 중…" : editing ? "수정하기" : "글 올리기"}
      </Button>
    </form>
  );
}
