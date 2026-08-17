import { http } from "./http";
import { API_PREFIX } from "@/lib/api/prefix";
import { isDemoMode } from "./demo-mode";
import type {
  UtilityFunction,
  UtilityFunctionsResponse,
  EvalFunctionRequest,
  EvalFunctionResponse,
} from "@/lib/types/functions";

// Mock data for demo mode
const mockFunctions: UtilityFunction[] = [
  { name: "trim", description: "移除首尾空白字符", return_type: "string", parameters: "(str)", example: 'trim("  hello  ")', tags: ["string"] },
  { name: "lower", description: "将字符串转换为小写", return_type: "string", parameters: "(str)", example: 'lower("HELLO")', tags: ["string"] },
  { name: "upper", description: "将字符串转换为大写", return_type: "string", parameters: "(str)", example: 'upper("hello")', tags: ["string"] },
  { name: "replace", description: "替换字符串中的子串", return_type: "string", parameters: "(str, old, new)", example: 'replace("hello", "l", "x")', tags: ["string"] },
  { name: "split", description: "按分隔符拆分字符串", return_type: "[]string", parameters: "(str, delimiter)", example: 'split("a,b,c", ",")', tags: ["string"] },
  { name: "join", description: "使用分隔符连接数组元素", return_type: "string", parameters: "(arr, delimiter)", example: 'join(["a","b"], ",")', tags: ["string"] },
  { name: "contains", description: "检查字符串是否包含子串", return_type: "bool", parameters: "(str, substr)", example: 'contains("hello", "ll")', tags: ["string"] },
  { name: "startsWith", description: "检查字符串是否以指定前缀开头", return_type: "bool", parameters: "(str, prefix)", example: 'startsWith("hello", "he")', tags: ["string"] },
  { name: "endsWith", description: "检查字符串是否以指定后缀结尾", return_type: "bool", parameters: "(str, suffix)", example: 'endsWith("hello", "lo")', tags: ["string"] },
  { name: "readFile", description: "读取文件内容", return_type: "string", parameters: "(path)", example: 'readFile("/tmp/test.txt")', tags: ["file"] },
  { name: "writeFile", description: "写入文件内容", return_type: "bool", parameters: "(path, content)", example: 'writeFile("/tmp/out.txt", "data")', tags: ["file"] },
  { name: "appendFile", description: "向文件追加内容", return_type: "bool", parameters: "(path, content)", example: 'appendFile("/tmp/log.txt", "line")', tags: ["file"] },
  { name: "fileExists", description: "检查文件是否存在", return_type: "bool", parameters: "(path)", example: 'fileExists("/tmp/test.txt")', tags: ["file"] },
  { name: "deleteFile", description: "删除文件", return_type: "bool", parameters: "(path)", example: 'deleteFile("/tmp/test.txt")', tags: ["file"] },
  { name: "listDir", description: "列出目录内容", return_type: "[]string", parameters: "(path)", example: 'listDir("/tmp")', tags: ["file"] },
  { name: "httpGet", description: "发送 HTTP GET 请求", return_type: "string", parameters: "(url)", example: 'httpGet("https://example.com")', tags: ["http"] },
  { name: "httpPost", description: "发送 HTTP POST 请求", return_type: "string", parameters: "(url, body)", example: 'httpPost("https://api.example.com", "{}")', tags: ["http"] },
  { name: "resolveIP", description: "将主机名解析为 IP", return_type: "string", parameters: "(hostname)", example: 'resolveIP("example.com")', tags: ["network"] },
  { name: "checkPort", description: "检查端口是否开放", return_type: "bool", parameters: "(host, port)", example: 'checkPort("localhost", 80)', tags: ["network"] },
  { name: "base64Encode", description: "将字符串编码为 Base64", return_type: "string", parameters: "(str)", example: 'base64Encode("hello")', tags: ["encoding"] },
  { name: "base64Decode", description: "解码 Base64 字符串", return_type: "string", parameters: "(str)", example: 'base64Decode("aGVsbG8=")', tags: ["encoding"] },
  { name: "urlEncode", description: "对字符串进行 URL 编码", return_type: "string", parameters: "(str)", example: 'urlEncode("hello world")', tags: ["encoding"] },
  { name: "urlDecode", description: "解码 URL 字符串", return_type: "string", parameters: "(str)", example: 'urlDecode("hello%20world")', tags: ["encoding"] },
  { name: "md5", description: "计算 MD5 哈希", return_type: "string", parameters: "(str)", example: 'md5("hello")', tags: ["encoding"] },
  { name: "sha256", description: "计算 SHA256 哈希", return_type: "string", parameters: "(str)", example: 'sha256("hello")', tags: ["encoding"] },
  { name: "jsonParse", description: "将 JSON 字符串解析为对象", return_type: "object", parameters: "(str)", example: 'jsonParse(\'{"key":"value"}\')', tags: ["data_query"] },
  { name: "jsonStringify", description: "将对象转换为 JSON 字符串", return_type: "string", parameters: "(obj)", example: 'jsonStringify({"key":"value"})', tags: ["data_query"] },
  { name: "jsonGet", description: "按路径读取 JSON 值", return_type: "any", parameters: "(obj, path)", example: 'jsonGet(obj, "data.items[0]")', tags: ["data_query"] },
];

function normalizeTag(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function listUtilityFunctions(): Promise<UtilityFunctionsResponse> {
  if (isDemoMode()) {
    return { functions: mockFunctions, total: mockFunctions.length };
  }
  const res = await http.get(`${API_PREFIX}/functions/list`);
  const data = res.data as unknown;
  const functionsNode = (data as any)?.functions as unknown;
  if (Array.isArray(functionsNode)) {
    const funcs = functionsNode as UtilityFunction[];
    const total = Number.isFinite((data as any)?.total) ? Number((data as any)?.total) : funcs.length;
    return { functions: funcs, total };
  }
  if (functionsNode && typeof functionsNode === "object") {
    const byCategory = functionsNode as Record<string, UtilityFunction[]>;
    const funcs = Object.entries(byCategory).flatMap(([category, fns]) =>
      (fns ?? []).map((fn) => {
        const existingTags = Array.isArray((fn as any)?.tags) ? ((fn as any).tags as string[]) : undefined;
        const tags = existingTags && existingTags.length > 0 ? existingTags : [normalizeTag(category)];
        return { ...fn, tags };
      })
    );
    return { functions: funcs, total: funcs.length };
  }
  return { functions: [], total: 0 };
}

export async function evalUtilityFunction(
  input: EvalFunctionRequest
): Promise<EvalFunctionResponse> {
  const res = await http.post(`${API_PREFIX}/functions/eval`, input);
  const data = res.data as EvalFunctionResponse;
  return {
    result: (data as any)?.result,
    rendered_script: (data as any)?.rendered_script || input.script,
  };
}
