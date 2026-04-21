/**
 * StatsPanel.tsx — Session statistics shown at the bottom of the sidebar.
 */

"use client";

interface Props {
  totalTokens: number;
  messageCount: number;
  likeCount: number;
  dislikeCount: number;
}

export default function StatsPanel({
  totalTokens,
  messageCount,
  likeCount,
  dislikeCount,
}: Props) {
  const Item = ({ label, value }: { label: string; value: number }) => (
    <div className="flex flex-col rounded bg-neutral-100 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-1">
      <Item label="Messages" value={messageCount} />
      <Item label="Tokens" value={totalTokens} />
      <Item label="Liked" value={likeCount} />
      <Item label="Disliked" value={dislikeCount} />
    </div>
  );
}
