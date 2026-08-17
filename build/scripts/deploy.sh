#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "${script_dir}/../.." && pwd)"
compose_file="${repo_dir}/build/docker/docker-compose.production.yaml"
settings_template="${repo_dir}/build/docker/osm-settings.production.yaml"
state_dir="${OSM_DEPLOY_STATE_DIR:-${repo_dir}/.osmedeus-deploy}"
env_file="${state_dir}/.env"
config_dir="${state_dir}/config"
settings_file="${config_dir}/osm-settings.yaml"
legacy_settings_file="${state_dir}/osm-settings.yaml"
action="${1:-up}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

random_hex() {
  openssl rand -hex "$1"
}

env_value() {
  local key="$1" line
  line="$(grep -E "^${key}=" "${env_file}" | tail -n 1)" || return 1
  printf '%s' "${line#*=}"
}

load_state_values() {
  POSTGRES_PASSWORD="$(env_value POSTGRES_PASSWORD)" || die "POSTGRES_PASSWORD is missing from ${env_file}"
  OSM_ADMIN_PASSWORD="$(env_value OSM_ADMIN_PASSWORD)" || die "OSM_ADMIN_PASSWORD is missing from ${env_file}"
  OSM_JWT_SECRET="$(env_value OSM_JWT_SECRET)" || die "OSM_JWT_SECRET is missing from ${env_file}"
  OSM_API_KEY="$(env_value OSM_API_KEY)" || die "OSM_API_KEY is missing from ${env_file}"
  WORKSPACE_PREFIX_KEY="$(env_value WORKSPACE_PREFIX_KEY)" || die "WORKSPACE_PREFIX_KEY is missing from ${env_file}"
  export POSTGRES_PASSWORD
}

require_tools() {
  command -v docker >/dev/null 2>&1 || die "Docker is required"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
  command -v openssl >/dev/null 2>&1 || die "openssl is required to generate deployment credentials"
}

ensure_docker_daemon() {
  if docker info >/dev/null 2>&1; then
    return
  fi
  if command -v colima >/dev/null 2>&1; then
    printf 'Docker daemon is unavailable; starting Colima...\n'
    colima start
    docker info >/dev/null 2>&1 || die "Colima started but Docker is still unavailable"
    return
  fi
  die "Docker daemon is not running"
}

configure_build_proxy() {
  [[ -n "${DSH_PROXY:-}" ]] || return

  local proxy="${DSH_PROXY}" context
  context="$(docker context show 2>/dev/null || true)"
  if [[ "${context}" == "colima" ]]; then
    proxy="${proxy/127.0.0.1/host.lima.internal}"
    proxy="${proxy/localhost/host.lima.internal}"
  elif [[ "${context}" == "desktop-linux" ]]; then
    proxy="${proxy/127.0.0.1/host.docker.internal}"
    proxy="${proxy/localhost/host.docker.internal}"
  fi
  export HTTP_PROXY="${proxy}" HTTPS_PROXY="${proxy}"
}

initialize_state() {
  mkdir -p "${state_dir}"
  chmod 700 "${state_dir}"

  mkdir -p "${config_dir}"
  chmod 700 "${config_dir}"

  # Preserve settings created by deployments before the writable-directory
  # mount was introduced.
  if [[ ! -f "${settings_file}" && -f "${legacy_settings_file}" ]]; then
    mv "${legacy_settings_file}" "${settings_file}"
  fi

  if [[ ! -f "${env_file}" ]]; then
    local postgres_password admin_password jwt_secret api_key workspace_prefix
    postgres_password="$(random_hex 24)"
    admin_password="$(random_hex 12)"
    jwt_secret="$(random_hex 32)"
    api_key="$(random_hex 24)"
    workspace_prefix="$(random_hex 8)"

    printf '%s\n' \
      'POSTGRES_USER=osmedeus' \
      "POSTGRES_PASSWORD=${postgres_password}" \
      'POSTGRES_DB=osmedeus' \
      'OSM_SERVER_PORT=8002' \
      'TZ=Asia/Shanghai' \
      'WORKER_REPLICAS=2' \
      'DSH_PERMISSION_MODE=workspace-write' \
      'DEEPSEEK_API_KEY=' \
      "OSM_ADMIN_PASSWORD=${admin_password}" \
      "OSM_JWT_SECRET=${jwt_secret}" \
      "OSM_API_KEY=${api_key}" \
      "WORKSPACE_PREFIX_KEY=${workspace_prefix}" >"${env_file}"
    chmod 600 "${env_file}"
  fi

  load_state_values

  if [[ ! -f "${settings_file}" ]]; then
    local tmp_settings
    tmp_settings="$(mktemp "${state_dir}/osm-settings.XXXXXX")"
    sed \
      -e "s|__POSTGRES_PASSWORD__|${POSTGRES_PASSWORD}|g" \
      -e "s|__OSM_ADMIN_PASSWORD__|${OSM_ADMIN_PASSWORD}|g" \
      -e "s|__OSM_JWT_SECRET__|${OSM_JWT_SECRET}|g" \
      -e "s|__OSM_API_KEY__|${OSM_API_KEY}|g" \
      -e "s|__WORKSPACE_PREFIX_KEY__|${WORKSPACE_PREFIX_KEY}|g" \
      "${settings_template}" >"${tmp_settings}"
    mv "${tmp_settings}" "${settings_file}"
    chmod 600 "${settings_file}"
  fi
}

compose() {
  OSM_SETTINGS_DIR="${config_dir}" docker compose \
    --env-file "${env_file}" \
    -f "${compose_file}" \
    "$@"
}

print_credentials() {
  local server_port deepseek_key
  load_state_values
  server_port="$(env_value OSM_SERVER_PORT)" || server_port=8002
  deepseek_key="$(env_value DEEPSEEK_API_KEY)" || deepseek_key=""
  printf 'Osmedeus URL: http://127.0.0.1:%s\n' "${server_port}"
  printf 'Username: admin\n'
  printf 'Password: %s\n' "${OSM_ADMIN_PASSWORD}"
  if [[ -z "${deepseek_key}" && -z "${DEEPSEEK_API_KEY:-}" ]]; then
    printf 'DeepSeek API key: not configured (edit %s)\n' "${env_file}"
  else
    printf 'DeepSeek API key: configured\n'
  fi
  printf 'DSH host port: not published (private Docker network only)\n'
}

require_tools

case "${action}" in
  up)
    initialize_state
    ensure_docker_daemon
    configure_build_proxy
    compose up -d --build --wait
    printf '\nDeployment is ready.\n'
    print_credentials
    ;;
  status)
    [[ -f "${env_file}" && -f "${settings_file}" ]] || die "deployment is not initialized; run make deploy"
    compose ps
    ;;
  logs)
    [[ -f "${env_file}" && -f "${settings_file}" ]] || die "deployment is not initialized; run make deploy"
    compose logs -f --tail=200
    ;;
  down)
    [[ -f "${env_file}" && -f "${settings_file}" ]] || die "deployment is not initialized; run make deploy"
    compose down
    ;;
  credentials)
    [[ -f "${env_file}" ]] || die "deployment is not initialized; run make deploy"
    print_credentials
    ;;
  check)
    initialize_state
    compose config -q
    printf 'Deployment configuration is valid.\n'
    ;;
  *)
    die "unknown action '${action}' (expected: up, status, logs, down, credentials, check)"
    ;;
esac
