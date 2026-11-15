"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Check,
  CircleCheck,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { AiProvider } from "@/types/domain";

const STORAGE_KEY = "jd_resume_artifact_api_keys";
const PROVIDER_STORAGE_KEY = "jd_resume_artifact_provider";

const CARD =
  "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]";
const EYEBROW =
  "text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600";
const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100";
const BADGE =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";

interface ProviderOption {
  id: AiProvider;
  name: string;
  model: string;
  icon: LucideIcon;
  placeholder: string;
}

const PROVIDER_OPTIONS: readonly ProviderOption[] = [
  {
    id: "openai",
    name: "OpenAI",
    model: "gpt-6-luna",
    icon: Sparkles,
    placeholder: "貼上 OpenAI API Key",
  },
  {
    id: "gemini",
    name: "Gemini",
    model: "gemini-3.8-flash",
    icon: Bot,
    placeholder: "貼上 Gemini API Key",
  },
  {
    id: "ollama",
    name: "Ollama Cloud",
    model: "deepseek-v4.1-flash:1017",
    icon: Cpu,
    placeholder: "貼上 Ollama Cloud API Key",
  },
];

type StoredKeys = Record<AiProvider, string>;

const EMPTY_KEYS: StoredKeys = { openai: "", gemini: "", ollama: "" };

function isAiProvider(value: unknown): value is AiProvider {
  return value === "openai" || value === "gemini" || value === "ollama";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseStoredKeys(raw: string | null): StoredKeys {
  if (raw === null) {
    return { ...EMPTY_KEYS };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...EMPTY_KEYS };
    }

    const data = parsed as Record<string, unknown>;

    return {
      openai: readString(data.openai),
      gemini: readString(data.gemini),
      ollama: readString(data.ollama),
    };
  } catch {
    return { ...EMPTY_KEYS };
  }
}

function persistStoredKeys(keys: StoredKeys): void {
  try {
    if (keys.openai === "" && keys.gemini === "" && keys.ollama === "") {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage can be blocked; the in-memory keys still work for this visit.
  }
}

function readStoredProvider(): AiProvider | null {
  try {
    const raw = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
    return isAiProvider(raw) ? raw : null;
  } catch {
    return null;
  }
}

function persistProvider(provider: AiProvider): void {
  try {
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Provider selection simply will not survive a reload when storage is blocked.
  }
}

interface ApiKeyPanelProps {
  provider: AiProvider;
  apiKey: string;
  onProviderChange: (provider: AiProvider) => void;
  onApiKeyChange: (key: string) => void;
}

export default function ApiKeyPanel({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
}: ApiKeyPanelProps) {
  const inputId = useId();
  const privacyId = `${inputId}-privacy`;
  const titleId = `${inputId}-title`;

  const [keys, setKeys] = useState<StoredKeys>({ ...EMPTY_KEYS });
  const [hydrated, setHydrated] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;

    let rawKeys: string | null = null;

    try {
      rawKeys = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      rawKeys = null;
    }

    const storedKeys = parseStoredKeys(rawKeys);
    const storedProvider = readStoredProvider();
    const targetProvider = storedProvider ?? provider;

    setKeys(storedKeys);
    setHydrated(true);

    if (storedProvider !== null && storedProvider !== provider) {
      onProviderChange(storedProvider);
    }

    if (apiKey.trim() === "") {
      const storedKey = storedKeys[targetProvider];

      if (storedKey !== "") {
        onApiKeyChange(storedKey);
      }
    }
  }, [apiKey, onApiKeyChange, onProviderChange, provider]);

  const activeOption =
    PROVIDER_OPTIONS.find((option) => option.id === provider) ??
    PROVIDER_OPTIONS[0];
  const hasKey = apiKey.trim() !== "";
  const hasAnyStoredKey = PROVIDER_OPTIONS.some(
    (option) => keys[option.id].trim() !== "",
  );

  function selectProvider(nextProvider: AiProvider): void {
    if (nextProvider === provider) {
      return;
    }

    persistProvider(nextProvider);
    onProviderChange(nextProvider);
    onApiKeyChange(keys[nextProvider]);
    setIsKeyVisible(false);
  }

  function handleKeyChange(value: string): void {
    const nextKeys: StoredKeys = { ...keys, [provider]: value };

    setKeys(nextKeys);
    onApiKeyChange(value);
    persistStoredKeys(nextKeys);
  }

  function clearCurrentKey(): void {
    const nextKeys: StoredKeys = { ...keys, [provider]: "" };

    setKeys(nextKeys);
    onApiKeyChange("");
    persistStoredKeys(nextKeys);
    setIsKeyVisible(false);
  }

  function clearAllKeys(): void {
    const nextKeys: StoredKeys = { ...EMPTY_KEYS };

    setKeys(nextKeys);
    onApiKeyChange("");
    persistStoredKeys(nextKeys);
    setIsKeyVisible(false);
  }

  return (
    <section aria-labelledby={titleId} className={CARD}>
      <p className={EYEBROW}>AI API KEY</p>
      <h2
        id={titleId}
        className="mt-2 text-xl font-semibold tracking-tight text-slate-900 text-balance"
      >
        API Key 設定
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        選擇 AI 供應商並貼上金鑰；分析時才會隨請求送出，不會寫入資料庫。
      </p>

      <div
        role="group"
        aria-label="選擇 AI 供應商"
        className="mt-5 space-y-2"
      >
        {PROVIDER_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = option.id === provider;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectProvider(option.id)}
              disabled={!hydrated}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70 ${
                isSelected
                  ? "border-indigo-300 bg-indigo-50/80 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                  isSelected
                    ? "bg-white text-indigo-600 ring-indigo-200"
                    : "bg-slate-50 text-slate-500 ring-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">
                  {option.name}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
                  {option.model}
                </span>
              </span>
              <span
                className={`${BADGE} shrink-0 ${
                  isSelected
                    ? "border-indigo-200 bg-white text-indigo-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                雲端 API
              </span>
              {isSelected ? (
                <Check
                  className="h-4 w-4 shrink-0 text-indigo-600"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700"
          >
            API Key
          </label>
          <span className="text-[11px] font-medium text-slate-400">
            {activeOption.name}
          </span>
        </div>

        <div className="relative mt-1.5">
          <input
            id={inputId}
            type={isKeyVisible ? "text" : "password"}
            value={apiKey}
            onChange={(event) => handleKeyChange(event.target.value)}
            placeholder={activeOption.placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={privacyId}
            disabled={!hydrated}
            className={`${INPUT} pr-12`}
          />
          <button
            type="button"
            onClick={() => setIsKeyVisible((visible) => !visible)}
            aria-label={isKeyVisible ? "隱藏 API Key" : "顯示 API Key"}
            aria-pressed={isKeyVisible}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            {isKeyVisible ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="mt-2">
          {hasKey ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
              已儲存於此瀏覽器
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
              尚未設定金鑰
            </span>
          )}
        </div>
      </div>

      <div
        id={privacyId}
        className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3.5"
      >
        <div className="flex gap-2.5">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-6 text-indigo-900">
              「我們不會保存您的 API Key —— 金鑰僅儲存於您的瀏覽器本機 localStorage，不會上傳至資料庫。」
            </p>
            <p className="mt-1 text-xs leading-5 text-indigo-700">
              重新整理頁面仍會保留；按下清除或清除瀏覽器網站資料才會移除。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={clearCurrentKey}
          disabled={!hasKey}
          className={SECONDARY_BUTTON}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          清除此金鑰
        </button>
        <button
          type="button"
          onClick={clearAllKeys}
          disabled={!hasAnyStoredKey}
          className={SECONDARY_BUTTON}
        >
          清除全部金鑰
        </button>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-slate-400">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        使用公用電腦時，請記得清除金鑰。
      </p>
    </section>
  );
}
