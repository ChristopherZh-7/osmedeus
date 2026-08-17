import type { TechCategory } from "@/lib/types/asset";

// Technology to category mapping
export const TECH_CATEGORY_MAP: Record<string, TechCategory> = {
  // Web servers (blue/info)
  nginx: "webServer",
  apache: "webServer",
  iis: "webServer",
  caddy: "webServer",
  lighttpd: "webServer",
  tomcat: "webServer",
  jetty: "webServer",
  openresty: "webServer",
  litespeed: "webServer",

  // Frontend frameworks (green/success)
  react: "frontend",
  vue: "frontend",
  "vue.js": "frontend",
  angular: "frontend",
  svelte: "frontend",
  "next.js": "frontend",
  nuxt: "frontend",
  "nuxt.js": "frontend",
  gatsby: "frontend",
  jquery: "frontend",
  bootstrap: "frontend",
  tailwind: "frontend",
  "tailwindcss": "frontend",
  ember: "frontend",
  backbone: "frontend",

  // Backend runtimes/frameworks (yellow/warning)
  "node.js": "backend",
  nodejs: "backend",
  php: "backend",
  express: "backend",
  "express.js": "backend",
  django: "backend",
  flask: "backend",
  rails: "backend",
  "ruby on rails": "backend",
  spring: "backend",
  "spring boot": "backend",
  laravel: "backend",
  symfony: "backend",
  fastapi: "backend",
  koa: "backend",
  nestjs: "backend",
  "asp.net": "backend",
  ".net": "backend",

  // Databases (purple)
  mysql: "database",
  postgresql: "database",
  postgres: "database",
  mongodb: "database",
  redis: "database",
  elasticsearch: "database",
  mariadb: "database",
  oracle: "database",
  sqlite: "database",
  cassandra: "database",
  couchdb: "database",
  dynamodb: "database",
  firestore: "database",
  neo4j: "database",
  influxdb: "database",

  // CMS (pink)
  wordpress: "cms",
  drupal: "cms",
  joomla: "cms",
  magento: "cms",
  shopify: "cms",
  woocommerce: "cms",
  contentful: "cms",
  strapi: "cms",
  ghost: "cms",
  typo3: "cms",
  prestashop: "cms",
  opencart: "cms",
  squarespace: "cms",
  wix: "cms",
  webflow: "cms",

  // CDN (cyan)
  cloudflare: "cdn",
  akamai: "cdn",
  fastly: "cdn",
  "aws cloudfront": "cdn",
  cloudfront: "cdn",
  "azure cdn": "cdn",
  "bunny.net": "cdn",
  bunnycdn: "cdn",
  keycdn: "cdn",
  stackpath: "cdn",
  jsdelivr: "cdn",
  unpkg: "cdn",

  // Security tools (red/destructive)
  waf: "security",
  "cloudflare waf": "security",
  modsecurity: "security",
  fail2ban: "security",
  sucuri: "security",
  imperva: "security",
  "aws waf": "security",
  fortiweb: "security",
  f5: "security",

  // Programming languages (orange)
  javascript: "language",
  typescript: "language",
  python: "language",
  ruby: "language",
  go: "language",
  golang: "language",
  rust: "language",
  "c#": "language",
  java: "language",
  kotlin: "language",
  scala: "language",
  perl: "language",
  lua: "language",
};

// Category to badge variant mapping
export const CATEGORY_BADGE_VARIANT: Record<TechCategory, string> = {
  webServer: "info",
  frontend: "success",
  backend: "warning",
  database: "purple",
  cms: "pink",
  cdn: "cyan",
  security: "destructive",
  language: "orange",
  other: "outline",
};

// Category to dot color mapping (solid colors, readable on dark surfaces)
export const CATEGORY_DOT_COLOR: Record<TechCategory, string> = {
  webServer: "bg-info",
  frontend: "bg-success",
  backend: "bg-warning",
  database: "bg-purple",
  cms: "bg-pink",
  cdn: "bg-cyan",
  security: "bg-destructive",
  language: "bg-orange",
  other: "bg-faint",
};

// Category display labels
export const CATEGORY_LABELS: Record<TechCategory, string> = {
  webServer: "Web 服务器",
  frontend: "前端",
  backend: "后端",
  database: "数据库",
  cms: "CMS",
  cdn: "CDN",
  security: "安全",
  language: "开发语言",
  other: "其他",
};

// Content type options for filtering
export const CONTENT_TYPE_OPTIONS = [
  { value: "text/html", label: "HTML" },
  { value: "application/json", label: "JSON" },
  { value: "application/xml", label: "XML" },
  { value: "text/xml", label: "XML（文本）" },
  { value: "text/css", label: "CSS" },
  { value: "application/javascript", label: "JavaScript" },
  { value: "text/javascript", label: "JavaScript（文本）" },
  { value: "image/", label: "图片" },
  { value: "text/plain", label: "纯文本" },
  { value: "application/pdf", label: "PDF" },
];

// TLS version options
export const TLS_VERSION_OPTIONS = [
  { value: "TLS 1.3", label: "TLS 1.3" },
  { value: "TLS 1.2", label: "TLS 1.2" },
  { value: "TLS 1.1", label: "TLS 1.1（已弃用）" },
  { value: "TLS 1.0", label: "TLS 1.0（已弃用）" },
];

// All unique technologies for filter dropdown (sorted alphabetically)
export const ALL_TECHNOLOGIES = Object.keys(TECH_CATEGORY_MAP).sort();
