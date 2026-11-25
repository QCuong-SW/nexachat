'use client';

import {
  AlertCircle,
  CheckCircle2,
  FileJson2,
  Loader2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import {
  llmLabsApi,
  type RunToolsApiResponse,
  type SummarizeApiResponse,
} from '../api/labs-api';

const TOOL_SAMPLE_PROMPTS = [
  'Bây giờ là mấy giờ ở múi giờ Asia/Ho_Chi_Minh?',
  'Hãy đếm số từ trong đoạn văn sau: "Nexa Chat giúp học LLM Engineering thực hành một cách bài bản."',
];

export function LlmLabsPanel() {
  // Structured Output state
  const [summaryInput, setSummaryInput] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<SummarizeApiResponse | null>(
    null,
  );

  // Function Calling state
  const [toolPrompt, setToolPrompt] = useState('');
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);
  const [toolData, setToolData] = useState<RunToolsApiResponse | null>(null);

  const handleSummarize = async () => {
    const text = summaryInput.trim();
    if (text.length < 10) {
      setSummaryError('Vui lòng nhập ít nhất 10 ký tự để tóm tắt.');
      return;
    }
    setSummaryError(null);
    setSummaryLoading(true);
    try {
      const res = await llmLabsApi.summarize(text);
      setSummaryData(res);
    } catch (err) {
      setSummaryError(
        err instanceof ApiError
          ? err.message
          : 'Không thể tóm tắt văn bản lúc này.',
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleRunTools = async (overridePrompt?: string) => {
    const prompt = (overridePrompt ?? toolPrompt).trim();
    if (!prompt) return;
    if (overridePrompt) setToolPrompt(overridePrompt);
    setToolError(null);
    setToolLoading(true);
    try {
      const res = await llmLabsApi.runTools(prompt);
      setToolData(res);
    } catch (err) {
      setToolError(
        err instanceof ApiError
          ? err.message
          : 'Không thể thực thi yêu cầu Function Calling lúc này.',
      );
    } finally {
      setToolLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">
            LLM Engineering Labs
          </h1>
          <Badge>Stage 6 Extensions</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Hai thí nghiệm tách biệt khỏi luồng chat chính: Structured Output có
          validate schema và Function Calling chỉ chạy hàm trong allowlist.
        </p>
      </div>

      {/* 6A: Structured Output */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson2 className="h-4 w-4 text-indigo-600" />
            1. Structured Output — Tóm tắt văn bản
          </CardTitle>
          <CardDescription>
            Ép Gemini trả về JSON theo schema <code>title</code>,{' '}
            <code>summary</code>, <code>keyPoints[]</code> và kiểm tra lại ở
            backend trước khi hiển thị.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={summaryInput}
            onChange={(e) => setSummaryInput(e.target.value)}
            rows={4}
            placeholder="Dán đoạn văn bản cần tóm tắt (ít nhất 10 ký tự)..."
            aria-label="Văn bản cần tóm tắt"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleSummarize()}
              disabled={summaryLoading}
            >
              {summaryLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tóm tắt...
                </>
              ) : (
                'Tạo tóm tắt có cấu trúc'
              )}
            </Button>
          </div>

          {summaryError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{summaryError}</span>
            </div>
          )}

          {summaryData && (
            <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {summaryData.result.title}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {summaryData.durationMs} ms · Tokens:{' '}
                  {summaryData.usage.inputTokens ?? '—'} in /{' '}
                  {summaryData.usage.outputTokens ?? '—'} out
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                {summaryData.result.summary}
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Điểm chính
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {summaryData.result.keyPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6B: Function Calling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-indigo-600" />
            2. Function Calling an toàn (Allowlist)
          </CardTitle>
          <CardDescription>
            Backend chỉ cho phép gọi 2 hàm an toàn:{' '}
            <code>get_current_time</code> và <code>count_words</code>. Mọi tên
            hàm ngoài allowlist đều bị từ chối.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TOOL_SAMPLE_PROMPTS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => void handleRunTools(sample)}
                disabled={toolLoading}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {sample}
              </button>
            ))}
          </div>

          <Textarea
            value={toolPrompt}
            onChange={(e) => setToolPrompt(e.target.value)}
            rows={2}
            placeholder="Ví dụ: Bây giờ là mấy giờ ở Asia/Ho_Chi_Minh?"
            aria-label="Prompt thử nghiệm Function Calling"
          />

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleRunTools()}
              disabled={toolLoading || !toolPrompt.trim()}
            >
              {toolLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang thực thi tool & sinh câu trả lời...
                </>
              ) : (
                'Chạy Function Calling'
              )}
            </Button>
          </div>

          {toolError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{toolError}</span>
            </div>
          )}

          {toolData && (
            <div className="space-y-3">
              {/* Tool execution status trace */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Trạng thái thực thi Tool ({toolData.toolExecutions.length})
                </p>
                {toolData.toolExecutions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Mô hình trả lời trực tiếp mà không cần gọi tool.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {toolData.toolExecutions.map((exec, idx) => (
                      <div
                        key={`${exec.toolName}-${idx}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-medium text-slate-900">
                            {exec.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-mono">{exec.toolName}</span>
                            <Badge
                              variant={
                                exec.status === 'completed'
                                  ? 'default'
                                  : 'warning'
                              }
                            >
                              {exec.status === 'completed'
                                ? 'Đã thực thi'
                                : 'Bị từ chối'}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {exec.durationMs} ms
                          </span>
                        </div>
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 font-mono text-[11px] text-slate-700">
                          {JSON.stringify(
                            {
                              args: exec.args,
                              ...(exec.result ? { result: exec.result } : {}),
                              ...(exec.error ? { error: exec.error } : {}),
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Final AI answer */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-700">
                    Câu trả lời cuối cùng
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {toolData.iterations} vòng · {toolData.durationMs} ms
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {toolData.answer}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
