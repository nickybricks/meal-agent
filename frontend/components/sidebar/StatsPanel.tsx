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
    <div className="flex flex-col rounded-card bg-surface-container px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <span className="text-sm font-medium text-on-surface">{value}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      <Item label="Messages" value={messageCount} />
      <Item label="Tokens" value={totalTokens} />
      <Item label="Liked" value={likeCount} />
      <Item label="Disliked" value={dislikeCount} />
    </div>
  );
}
