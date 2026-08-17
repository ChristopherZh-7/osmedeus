#!/bin/sh

set -eu

mounted_settings=/root/osmedeus-settings/osm-settings.yaml
active_settings=/root/osmedeus-base/osm-settings.yaml

if [ -f "${mounted_settings}" ]; then
  rm -f "${active_settings}"
  ln -s "${mounted_settings}" "${active_settings}"
fi

exec osmedeus "$@"
