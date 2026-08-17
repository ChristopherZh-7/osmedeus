# Golish Production Dockerfile
# Multi-stage build: compile from source, then create minimal runtime image

# ── Stage 1: build from source ──────────────────────────────────────────────
# Pin the builder to the native build platform so the Go compiler runs without
# emulation, then cross-compile to the requested target arch (amd64/arm64).
FROM --platform=$BUILDPLATFORM golang:1.26-bookworm AS builder

ARG BUILD_TIME
ARG COMMIT_HASH
# Provided automatically by buildx for multi-platform builds.
ARG TARGETOS
ARG TARGETARCH

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -ldflags "-X main.BuildTime=${BUILD_TIME} -X main.CommitHash=${COMMIT_HASH}" \
    -o /golish ./cmd/golish

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM debian:bookworm-slim

# Install essential tools (retry on transient network failures for large packages like chromium)
RUN apt-get update && \
    for i in 1 2 3; do \
        apt-get install -y --no-install-recommends \
            build-essential \
            git \
            curl \
            wget \
            jq \
            ca-certificates \
            python3 \
            python3-pip \
            chromium \
        && break || { echo "Attempt $i failed, retrying..."; apt-get update; }; \
    done && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3 /usr/bin/python

# Create base directories
RUN mkdir -p /root/golish-base /root/workspaces-golish

WORKDIR /root

# Copy binary from builder
COPY --from=builder /golish /usr/local/bin/golish

# Initialize golish base folder with preset workflows
RUN golish install base --preset

# Overlay the version-controlled workflow collection from this repository. The
# remote preset supplies the rest of the base layout, while this guarantees that
# a checkout's code, API and workflows are deployed as one tested version.
COPY platform/golish-workflow /opt/golish-workflow
RUN cp -R /opt/golish-workflow/. /root/golish-base/workflows/ && \
    rm -rf /opt/golish-workflow

# Production mounts settings as a directory so atomic temp-file+rename updates
# work. The entrypoint refreshes the symlink even when an older named volume
# already contains a regular golish-settings.yaml.
COPY build/docker/entrypoint.sh /usr/local/bin/golish-entrypoint
RUN chmod 0755 /usr/local/bin/golish-entrypoint

# Install SAST tools (used for testing). Retry on transient download/hash
# failures — large wheel/binary downloads are prone to truncation when this
# stage runs under QEMU emulation during multi-arch builds (a corrupted wheel
# trips pip's hash verification).
RUN for i in 1 2 3; do \
        golish install binary --name trivy --name semgrep --name kingfisher --name bearer && break; \
        echo "Attempt $i failed, clearing pip cache and retrying..."; \
        pip cache purge 2>/dev/null || true; \
        sleep 5; \
        [ "$i" = "3" ] && exit 1; \
    done

# Set up PATH for external binaries
ENV PATH="/root/golish-base/external-binaries:${PATH}"

# Expose default server port
EXPOSE 8002

# Default entrypoint - exposes golish CLI only
ENTRYPOINT ["golish-entrypoint"]

# Default command shows help (user can override with run/server/etc.)
CMD ["--help"]
