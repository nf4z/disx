#!/bin/sh
set -e
cd /app

RESTART_DELAY="${DISX_RESTART_DELAY:-5}"

case "${1:-server}" in
client)
    mkdir -p /data/client/cache /data/client/cache_compressed
    if [ -f assets/cache/index.html ] && [ "$2" != "--force" ]; then
        echo "[client] using the cached client, run the client service with --force to fetch the current one"
        exec node scripts/compress-client.js
    fi
    node scripts/client.js
    node scripts/e2ee-anchors.js || echo "[client] warning: e2ee anchors are missing from this client build, encrypted DMs stay unavailable until client/e2ee is updated"
    node scripts/clan-badges.js || echo "[client] warning: could not extract server tag badges from this client build"
    node scripts/experiments.js || echo "[client] warning: could not list the experiments in this client build"
    node scripts/compress-client.js
    ;;
server)
    if [ ! -f assets/cache/index.html ]; then
        echo "[server] the client cache is missing from the image; refusing to start" >&2
        exit 1
    fi

    while :; do
        echo "[server] starting Disx..."
        if node scripts/docker-configure.js; then
            cd /data/state
            if node --enable-source-maps /app/dist/bundle/start.js; then
                status=0
            else
                status=$?
            fi
            cd /app
        else
            status=$?
        fi

        if [ "$status" -eq 0 ]; then
            echo "[server] Disx exited normally"
            exit 0
        fi

        echo "[server] Disx exited with code $status; restarting in ${RESTART_DELAY}s..." >&2
        sleep "${RESTART_DELAY}"
    done
    ;;
*)
    exec "$@"
    ;;
esac
