"use client";

interface Props {
  temperature: number;
  topP: number;
  maxTokens: number;
  disableTopP?: boolean;
  disableTopPReason?: string;
  onChange: (params: { temperature: number; topP: number; maxTokens: number }) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled,
  disabledHint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-40" : ""}`}>
      <div className="flex justify-between text-sm text-on-surface">
        <span>{label}</span>
        <span className="font-mono text-xs text-on-surface-variant">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${disabled ? "cursor-not-allowed" : ""}`}
      />
      {disabled && disabledHint ? (
        <span className="text-xs text-on-surface-variant">{disabledHint}</span>
      ) : null}
    </div>
  );
}

export default function ModelParams({
  temperature,
  topP,
  maxTokens,
  disableTopP,
  disableTopPReason,
  onChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Slider
        label="Temperature"
        value={temperature}
        min={0}
        max={1}
        step={0.1}
        onChange={(v) => onChange({ temperature: v, topP, maxTokens })}
        format={(v) => v.toFixed(1)}
      />
      <Slider
        label="Top-p"
        value={topP}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => onChange({ temperature, topP: v, maxTokens })}
        format={(v) => v.toFixed(2)}
        disabled={disableTopP}
        disabledHint={disableTopPReason}
      />
      <Slider
        label="Max tokens"
        value={maxTokens}
        min={256}
        max={4096}
        step={64}
        onChange={(v) => onChange({ temperature, topP, maxTokens: v })}
      />
    </div>
  );
}
