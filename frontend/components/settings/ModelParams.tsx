/**
 * ModelParams.tsx — Sliders for LLM generation parameters.
 */

"use client";

interface Props {
  temperature: number;
  topP: number;
  maxTokens: number;
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm text-neutral-700">
        <span>{label}</span>
        <span className="font-mono text-xs text-neutral-500">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function ModelParams({
  temperature,
  topP,
  maxTokens,
  onChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <Slider
        label="Temperature"
        value={temperature}
        min={0}
        max={2}
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
