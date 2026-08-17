export type RouteMeta = { title: string; description?: string };

export function getRouteMeta(pathname: string): RouteMeta {
  const path = pathname || "/";
  if (path === "/") {
    return {
      title: "统计概览",
      description: "安全侦察任务概览",
    };
  }
  if (path.startsWith("/assets/workspaces/")) {
    return {
      title: "工作区",
      description: "浏览和管理所选工作区中的资产",
    };
  }
  if (path.startsWith("/workflows/")) {
    return {
      title: "可视化并管理工作流",
    };
  }
  const map: Record<string, RouteMeta> = {
    "/workflows-editor": {
      title: "工作流编辑器",
      description: "选择并编辑工作流",
    },
    "/registry": {
      title: "二进制工具仓库",
      description: "查看并安装工具仓库中的工具",
    },
    "/assets": {
      title: "资产",
      description: "按工作区浏览和管理已发现资产",
    },
    "/inventory": {
      title: "资产中心",
      description: "浏览工作区与资产",
    },
    "/inventory/orgs": {
      title: "组织",
      description: "将工作区归入组织并进行跨工作区查询",
    },
    "/inventory/workspaces": {
      title: "工作区清单",
      description: "浏览和管理工作区",
    },
    "/inventory/assets": {
      title: "资产清单",
      description: "跨工作区资产",
    },
    "/inventory/artifacts": {
      title: "产物清单",
      description: "跨工作区产物",
    },
    "/schedules": {
      title: "计划任务",
      description: "管理工作流计划任务",
    },
    "/events": {
      title: "事件日志",
      description: "查看运行中及已完成任务的事件",
    },
    "/utilities": {
      title: "实用函数",
      description: "浏览并执行实用函数",
    },
    "/llm": {
      title: "大模型调试台",
      description: "大模型对话补全、嵌入向量与工具调用",
    },
    "/agent-pentest": {
      title: "智能渗透",
      description: "基于工作区与授权资产的智能体会话",
    },
    "/workflows": {
      title: "工作流",
      description: "浏览并编辑工作流",
    },
    "/scans": {
      title: "扫描任务",
      description: "查看和管理扫描任务",
    },
    "/scans/new": {
      title: "新建扫描",
      description: "配置并启动新的扫描任务",
    },
    "/settings": {
      title: "设置",
      description: "管理 AI、Skills、系统连接与高级配置",
    },
    "/vulnerabilities": {
      title: "漏洞",
      description: "查看和管理已发现漏洞",
    },
  };
  if (path.startsWith("/inventory/workspaces/")) {
    return {
      title: "工作区",
      description: "浏览和管理所选工作区中的资产",
    };
  }
  return map[path] ?? { title: "安全测试平台" };
}
