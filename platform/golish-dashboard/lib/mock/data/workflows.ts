import type { Workflow } from "@/lib/types/workflow";

export const mockWorkflows: Workflow[] = [
  {
    name: "subdomain-enum",
    kind: "module",
    description: "使用多种工具枚举子域名并解析存活主机",
    tags: ["recon", "subdomain"],
    file_path: "/workflows/subdomain-enum.yaml",
    params: [
      { name: "target", required: true, default: "", generator: "" },
      { name: "output", required: false, default: "/tmp/subdomains", generator: "" },
      { name: "threads", required: false, default: "10", generator: "" },
    ],
    required_params: ["target"],
    step_count: 9,
    module_count: 0,
    checksum: "abc123",
    indexed_at: new Date("2024-06-15").toISOString(),
  },
  {
    name: "vulnerability-scan",
    kind: "module",
    description: "使用 nuclei 模板扫描目标中的常见漏洞",
    tags: ["vuln", "security"],
    file_path: "/workflows/vulnerability-scan.yaml",
    params: [
      { name: "target", required: true, default: "", generator: "" },
      { name: "severity", required: false, default: "critical,high", generator: "" },
    ],
    required_params: ["target"],
    step_count: 6,
    module_count: 0,
    checksum: "def456",
    indexed_at: new Date("2024-06-20").toISOString(),
  },
  {
    name: "http-probe",
    kind: "module",
    description: "探测 HTTP/HTTPS 端点并收集响应数据",
    tags: ["http", "probe"],
    file_path: "/workflows/http-probe.yaml",
    params: [
      { name: "input", required: true, default: "", generator: "" },
    ],
    required_params: ["input"],
    step_count: 4,
    module_count: 0,
    checksum: "ghi789",
    indexed_at: new Date("2024-05-10").toISOString(),
  },
  {
    name: "full-recon",
    kind: "flow",
    description: "整合子域名枚举、HTTP 探测和漏洞扫描的完整侦察工作流",
    tags: ["recon", "full", "flow"],
    file_path: "/workflows/full-recon.yaml",
    params: [
      { name: "target", required: true, default: "", generator: "" },
    ],
    required_params: ["target"],
    step_count: 15,
    module_count: 3,
    checksum: "jkl012",
    indexed_at: new Date("2024-07-01").toISOString(),
  },
  {
    name: "screenshot-capture",
    kind: "module",
    description: "截取可访问网页的屏幕截图",
    tags: ["screenshot", "visual"],
    file_path: "/workflows/screenshot-capture.yaml",
    params: [
      { name: "input", required: true, default: "", generator: "" },
    ],
    required_params: ["input"],
    step_count: 3,
    module_count: 0,
    checksum: "mno345",
    indexed_at: new Date("2024-04-15").toISOString(),
  },
  {
    name: "tech-detection",
    kind: "module",
    description: "识别目标应用使用的技术与框架",
    tags: ["tech", "fingerprint"],
    file_path: "/workflows/tech-detection.yaml",
    params: [
      { name: "input", required: true, default: "", generator: "" },
    ],
    required_params: ["input"],
    step_count: 5,
    module_count: 0,
    checksum: "pqr678",
    indexed_at: new Date("2024-06-01").toISOString(),
  },
  {
    name: "mock-workflow",
    kind: "module",
    description: "用于预览可视化工作流编辑器的演示工作流",
    tags: ["demo", "test"],
    file_path: "/workflows/mock-workflow.yaml",
    params: [],
    required_params: [],
    step_count: 5,
    module_count: 0,
    checksum: "stu901",
    indexed_at: new Date("2024-07-01").toISOString(),
  },
];

// Sample YAML content for the workflow editor
export const sampleWorkflowYaml = `name: subdomain-enum
kind: module
description: "使用多种工具枚举子域名并解析存活主机"

params:
  - name: target
    required: true
  - name: output
    default: "/tmp/subdomains"
  - name: threads
    default: "10"

dependencies:
  commands:
    - subfinder
    - amass
    - httpx

steps:
  - name: setup
    type: bash
    command: mkdir -p {{Output}}

  - name: enumerate
    type: parallel
    parallel_steps:
      - name: subfinder
        type: bash
        command: subfinder -d {{Target}} -o {{Output}}/subfinder.txt

      - name: amass
        type: bash
        command: amass enum -passive -d {{Target}} -o {{Output}}/amass.txt

  - name: merge-results
    type: bash
    commands:
      - cat {{Output}}/*.txt | sort -u > {{Output}}/all-subdomains.txt

  - name: http-probe
    type: bash
    command: cat {{Output}}/all-subdomains.txt | httpx -o {{Output}}/alive.txt
`;
