"use client";

import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  triggerClassName = "",
  contentClassName = "",
}: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm
                   bg-white/10 text-white ring-1 ring-white/20 shadow-inner shadow-white/[0.03]
                   hover:bg-white/15 hover:ring-cyan-300/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/60
                   data-[placeholder]:text-white/45 backdrop-blur-xl transition ${triggerClassName}`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown size={16} className="shrink-0 opacity-70" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          className={`z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl
                     border border-cyan-300/20 bg-slate-950/95 p-1.5 text-white shadow-2xl shadow-black/40
                     backdrop-blur-xl ${contentClassName}`}
        >
          <Select.Viewport className="max-h-64 overflow-y-auto pr-1">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="relative flex cursor-pointer select-none items-center rounded-xl px-3 py-2.5 pr-8
                           text-sm leading-5 text-white/85 outline-none transition
                           data-[highlighted]:bg-cyan-300/15 data-[highlighted]:text-white
                           data-[state=checked]:bg-white/10 data-[state=checked]:text-cyan-100"
              >
                <Select.ItemText>
                  <span className="block whitespace-normal break-words">
                    {opt.label}
                  </span>
                </Select.ItemText>
                <Select.ItemIndicator className="absolute right-3 inline-flex items-center text-cyan-200">
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
