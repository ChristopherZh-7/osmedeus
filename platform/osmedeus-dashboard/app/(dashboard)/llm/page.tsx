"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { chatCompletion, generateEmbeddings } from "@/lib/api/llm";
import type { LLMMessage, LLMTool, ChatCompletionResponse, EmbeddingsResponse } from "@/lib/types/llm";
import { toast } from "sonner";
import {
  MessageCircleIcon,
  CirclePileIcon,
  LoaderIcon,
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  SendIcon,
  SparklesIcon,
  AlignJustifyIcon,
  InfoIcon,
  ClipboardIcon,
} from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import github from "react-syntax-highlighter/dist/esm/styles/hljs/github";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import { useTheme } from "next-themes";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import yaml from "react-syntax-highlighter/dist/esm/languages/hljs/yaml";
import markdown from "react-syntax-highlighter/dist/esm/languages/hljs/markdown";

SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("markdown", markdown);

const CodeHighlighter = SyntaxHighlighter as unknown as React.ComponentType<any>;

const MESSAGE_ROLES: Array<LLMMessage["role"]> = ["system", "user", "assistant", "tool"];
const TOOL_CHOICES = ["auto", "none", "required"] as const;

function parseOptionalInt(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function parseOptionalFloat(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function useParsedTools(toolsJson: string): { tools: LLMTool[] | undefined; valid: boolean } {
  return React.useMemo(() => {
    const trimmed = toolsJson.trim();
    if (!trimmed) return { tools: undefined, valid: true };

    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return { tools: arr as LLMTool[], valid: true };
    } catch {
      return { tools: undefined, valid: false };
    }
  }, [toolsJson]);
}

function ChatMessageRow({
  message,
  index,
  canRemove,
  onRoleChange,
  onContentChange,
  onRemove,
}: {
  message: LLMMessage;
  index: number;
  canRemove: boolean;
  onRoleChange: (index: number, role: LLMMessage["role"]) => void;
  onContentChange: (index: number, content: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <Select value={message.role} onValueChange={(val) => onRoleChange(index, val as LLMMessage["role"]) }>
        <SelectTrigger className="h-8 w-24 shrink-0 self-center px-2 py-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESSAGE_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <textarea
        className="flex-1 min-h-14 rounded-md border bg-background p-1.5 text-xs leading-snug resize-y"
        placeholder={message.role === "system" ? "系统提示词……" : "消息内容……"}
        value={message.content}
        onChange={(e) => onContentChange(index, e.target.value)}
      />
      <Button
        variant="destructive"
        size="icon-xs"
        className="shrink-0 self-center"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
      >
        <TrashIcon className="size-3.5" />
      </Button>
    </div>
  );
}

function ChatResponsePanel({
  response,
  syntaxStyle,
  compactMode,
}: {
  response: ChatCompletionResponse;
  syntaxStyle: any;
  compactMode: boolean;
}) {
  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex items-center gap-2">
        <InfoIcon className="size-4 text-muted-foreground" />
        <Label>响应</Label>
      </div>

      {compactMode ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm overflow-x-auto whitespace-nowrap">
          <span className="text-muted-foreground">ID:</span> {response.id}
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">模型：</span> {response.model}
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">结束原因：</span> {response.finish_reason}
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">提示词 Token：</span> {response.usage.prompt_tokens}
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">生成 Token：</span> {response.usage.completion_tokens}
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">Token 总数：</span> {response.usage.total_tokens}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">ID:</span> {response.id}
            </div>
            <div>
              <span className="text-muted-foreground">模型：</span> {response.model}
            </div>
            <div>
              <span className="text-muted-foreground">结束原因：</span> {response.finish_reason}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">提示词 Token：</span> {response.usage.prompt_tokens}
            </div>
            <div>
              <span className="text-muted-foreground">生成 Token：</span> {response.usage.completion_tokens}
            </div>
            <div>
              <span className="text-muted-foreground">Token 总数：</span> {response.usage.total_tokens}
            </div>
          </div>
        </>
      )}
      {response.content && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlignJustifyIcon className="size-4 text-muted-foreground" />
            <Label>内容</Label>
          </div>
          <div className="max-h-96 overflow-y-auto overflow-x-hidden rounded-md border bg-muted/30 p-3 text-sm">
            <div className="sticky top-0 z-10 flex justify-end">
              <Button
                className="rounded-md bg-background/80 backdrop-blur-sm"
                variant="outline"
                size="icon"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(response.content ?? "");
                    toast.success("已复制到剪贴板");
                  } catch {
                    toast.error("复制失败");
                  }
                }}
              >
                <ClipboardIcon className="size-4" />
                <span className="sr-only">复制响应内容</span>
              </Button>
            </div>
            <CodeHighlighter
              language="markdown"
              style={syntaxStyle}
              wrapLongLines
              customStyle={{
                margin: 0,
                padding: 0,
                background: "transparent",
                fontSize: "0.85rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
              codeTagProps={{
                style: {
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                },
              }}
            >
              {response.content}
            </CodeHighlighter>
          </div>
        </div>
      )}
      {response.tool_calls && response.tool_calls.length > 0 && (
        <div className="space-y-2">
          <Label>工具调用</Label>
          <pre className="rounded-md border bg-muted p-3 text-sm overflow-auto font-mono max-h-96">
            {JSON.stringify(response.tool_calls, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ChatCompletionCard() {
  const { resolvedTheme } = useTheme();
  const syntaxStyle = resolvedTheme === "dark" ? atomOneDark : github;

  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const [messages, setMessages] = React.useState<LLMMessage[]>([
    { role: "system", content: "你是一名专业且乐于协助的安全分析助手。" },
    { role: "user", content: "" },
  ]);
  const [model, setModel] = React.useState<string>("gpt-oss:120b-cloud");
  const [maxTokens, setMaxTokens] = React.useState<string>("1000");
  const [temperature, setTemperature] = React.useState<string>("0.7");
  const [responseFormat, setResponseFormat] = React.useState<"text" | "json_object">("text");
  const [sendingChat, setSendingChat] = React.useState(false);
  const [chatResponse, setChatResponse] = React.useState<ChatCompletionResponse | null>(null);
  const [compactMode, setCompactMode] = React.useState(false);

  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [toolsJson, setToolsJson] = React.useState<string>("");
  const [toolChoice, setToolChoice] = React.useState<(typeof TOOL_CHOICES)[number]>("auto");

  const parsedTools = useParsedTools(toolsJson);

  React.useEffect(() => {
    if (!advancedOpen) setToolsOpen(false);
  }, [advancedOpen]);

  const updateMessage = React.useCallback((index: number, content: string) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, content } : m)));
  }, []);

  const updateMessageRole = React.useCallback((index: number, role: LLMMessage["role"]) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, role } : m)));
  }, []);

  const addMessage = React.useCallback(() => {
    setMessages((prev) => [...prev, { role: "user", content: "" }]);
  }, []);

  const removeMessage = React.useCallback((index: number) => {
    setMessages((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const doSendChat = React.useCallback(async () => {
    const filteredMessages = messages.filter((m) => m.content.trim() !== "");
    if (filteredMessages.length === 0) {
      toast.error("请至少添加一条有内容的消息");
      return;
    }

    if (advancedOpen && !parsedTools.valid) {
      toast.error("工具 JSON 格式无效");
      return;
    }

    const parsedMaxTokens = advancedOpen ? parseOptionalInt(maxTokens) : undefined;
    if (advancedOpen && maxTokens.trim() && parsedMaxTokens === undefined) {
      toast.error("最大 Token 数必须是有效数字");
      return;
    }

    const parsedTemperature = advancedOpen ? parseOptionalFloat(temperature) : undefined;
    if (advancedOpen && temperature.trim() && parsedTemperature === undefined) {
      toast.error("温度参数必须是有效数字");
      return;
    }

    setSendingChat(true);
    setChatResponse(null);

    const toastId = toast.loading("Sending...");

    try {
      const resp = await chatCompletion({
        messages: filteredMessages,
        model: model.trim() || undefined,
        max_tokens: parsedMaxTokens,
        temperature: parsedTemperature,
        tools: advancedOpen ? parsedTools.tools : undefined,
        tool_choice:
          advancedOpen && parsedTools.tools && parsedTools.tools.length > 0 ? toolChoice : undefined,
        response_format:
          advancedOpen && responseFormat === "json_object" ? { type: "json_object" } : undefined,
      });
      setChatResponse(resp);
      toast.success("对话补全成功", { id: toastId });
    } catch (e) {
      toast.error("对话补全失败", { id: toastId, description: e instanceof Error ? e.message : "" });
    } finally {
      setSendingChat(false);
    }
  }, [messages, advancedOpen, parsedTools, maxTokens, temperature, model, toolChoice, responseFormat]);

  return (
    <Card>
      <CardHeader>
        <div className="space-y-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircleIcon className="size-5 text-muted-foreground" />
              <span>对话补全</span>
            </CardTitle>
            <CardDescription>向已配置的大模型服务发送对话补全请求。</CardDescription>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
              <Label htmlFor="model" className="text-xs text-muted-foreground whitespace-nowrap">
                模型 ID
              </Label>
              <Input
                id="model"
                className="h-8 min-w-0 flex-1 bg-transparent"
                placeholder="gpt-oss:120b-cloud"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
              <div>
                <Label htmlFor="chat-advanced" className="text-xs text-muted-foreground">
                  高级
                </Label>
                <div className="text-[11px] text-muted-foreground">启用采样、工具调用和 JSON 响应</div>
              </div>
              <Switch id="chat-advanced" checked={advancedOpen} onCheckedChange={(v) => setAdvancedOpen(Boolean(v))} />
            </div>

            <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
              <div>
                <Label htmlFor="chat-compact" className="text-xs text-muted-foreground">
                  精简
                </Label>
                <div className="text-[11px] text-muted-foreground">单行显示响应元数据</div>
              </div>
              <Switch id="chat-compact" checked={compactMode} onCheckedChange={(v) => setCompactMode(Boolean(v))} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircleIcon className="size-4 text-muted-foreground" />
            <Label>消息</Label>
          </div>
          {messages.map((msg, idx) => (
            <ChatMessageRow
              key={idx}
              message={msg}
              index={idx}
              canRemove={messages.length > 1}
              onRoleChange={updateMessageRole}
              onContentChange={updateMessage}
              onRemove={removeMessage}
            />
          ))}
        </div>

        {advancedOpen && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-tokens">最大 Token 数</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  placeholder="1000"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature">温度（0-2）</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  placeholder="0.7"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="response-format">响应格式</Label>
                <Select
                  value={responseFormat}
                  onValueChange={(val) => setResponseFormat(val as "text" | "json_object")}
                >
                  <SelectTrigger id="response-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">文本</SelectItem>
                    <SelectItem value="json_object">JSON 对象</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ChevronDownIcon className={`size-4 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
                  工具调用
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tools-json">工具（JSON 数组）</Label>
                  <textarea
                    id="tools-json"
                    className="w-full min-h-32 rounded-md border bg-background p-2 text-sm font-mono resize-y"
                    placeholder={`[
  {
    "type": "function",
    "function": {
      "name": "dns_lookup",
      "description": "查询 DNS 记录",
      "parameters": {
        "type": "object",
        "properties": {
          "domain": { "type": "string" }
        },
        "required": ["domain"]
      }
    }
  }
]`}
                    value={toolsJson}
                    onChange={(e) => setToolsJson(e.target.value)}
                  />
                  {!parsedTools.valid && <p className="text-xs text-destructive">JSON 格式无效</p>}
                </div>
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="tool-choice">工具选择</Label>
                  <Select
                    value={toolChoice}
                    onValueChange={(val) => setToolChoice(val as (typeof TOOL_CHOICES)[number])}
                  >
                    <SelectTrigger id="tool-choice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOL_CHOICES.map((choice) => (
                        <SelectItem key={choice} value={choice}>
                          {choice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={doSendChat} disabled={sendingChat}>
            {sendingChat ? <LoaderIcon className="mr-2 size-4 animate-spin" /> : <SendIcon className="mr-2 size-4" />}
            发送消息
          </Button>
          <Button variant="outline" size="sm" onClick={addMessage}>
            <PlusIcon className="mr-2 size-4" />
            添加消息
          </Button>
        </div>

        {chatResponse && (
          <ChatResponsePanel
            response={chatResponse}
            syntaxStyle={syntaxStyle}
            compactMode={compactMode}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function LLMPlaygroundPage() {
  
  const [embeddingsInput, setEmbeddingsInput] = React.useState<string>("");
  const [embeddingsModel, setEmbeddingsModel] = React.useState<string>("");
  const [sendingEmbeddings, setSendingEmbeddings] = React.useState(false);
  const [embeddingsResponse, setEmbeddingsResponse] = React.useState<EmbeddingsResponse | null>(null);

  const doGenerateEmbeddings = async () => {
    const lines = embeddingsInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    if (lines.length === 0) {
      toast.error("请至少输入一行文本");
      return;
    }

    setSendingEmbeddings(true);
    setEmbeddingsResponse(null);

    try {
      const resp = await generateEmbeddings({
        input: lines,
        model: embeddingsModel.trim() || undefined,
      });
      setEmbeddingsResponse(resp);
      toast.success("嵌入向量已生成");
    } catch (e) {
      toast.error("生成嵌入向量失败", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSendingEmbeddings(false);
    }
  };

  return (
    <div className="space-y-4">
      <ChatCompletionCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CirclePileIcon className="size-5 text-muted-foreground" />
            <span>生成嵌入向量</span>
          </CardTitle>
          <CardDescription>为输入文本生成向量嵌入。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embeddings-input">输入（每行一段文本）</Label>
            <textarea
              id="embeddings-input"
              className="w-full min-h-24 rounded-md border bg-background p-2 text-sm resize-y"
              placeholder="安全分析&#10;漏洞评估&#10;渗透测试"
              value={embeddingsInput}
              onChange={(e) => setEmbeddingsInput(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-start">
            <div className="flex flex-wrap items-center gap-2 md:w-auto">
              <Label htmlFor="embeddings-model" className="whitespace-nowrap">
                模型（可选）
              </Label>
              <Input
                id="embeddings-model"
                placeholder="例如 text-embedding-3-small"
                value={embeddingsModel}
                onChange={(e) => setEmbeddingsModel(e.target.value)}
                className="h-9 w-full md:w-80"
              />
            </div>
            <Button
              size="sm"
              onClick={doGenerateEmbeddings}
              disabled={sendingEmbeddings}
              className="md:shrink-0"
            >
              {sendingEmbeddings ? (
                <LoaderIcon className="mr-2 size-4 animate-spin" />
              ) : (
                <SparklesIcon className="mr-2 size-4" />
              )}
              生成嵌入向量
            </Button>
          </div>

          {embeddingsResponse && (
            <div className="space-y-3 pt-4 border-t">
              <Label>响应</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">模型：</span> {embeddingsResponse.model}
                </div>
                <div>
                  <span className="text-muted-foreground">向量：</span> {embeddingsResponse.embeddings.length}
                </div>
                <div>
                  <span className="text-muted-foreground">Token 总数：</span> {embeddingsResponse.usage.total_tokens}
                </div>
              </div>
              <div className="space-y-2">
                <Label>嵌入向量（已截断）</Label>
                <pre className="rounded-md border bg-muted p-3 text-sm overflow-auto font-mono max-h-64">
                  {embeddingsResponse.embeddings.map((emb, idx) => (
                    `[${idx}]: [${emb.slice(0, 5).map(n => n.toFixed(4)).join(", ")}${emb.length > 5 ? `，……（${emb.length} 维）` : ""}]\n`
                  )).join("")}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
