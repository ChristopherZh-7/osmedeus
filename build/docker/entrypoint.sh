#!/bin/sh

set -eu

mounted_settings=/root/golish-settings/golish-settings.yaml
active_settings=/root/golish-base/golish-settings.yaml

if [ -f "${mounted_settings}" ]; then
  rm -f "${active_settings}"
  ln -s "${mounted_settings}" "${active_settings}"
fi

exec golish "$@"
