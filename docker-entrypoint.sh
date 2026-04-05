#!/bin/sh
set -e

# This entrypoint compounds the main command. If pm2 is available, it uses it to run the application.
# If doppler is available, it wraps the command (either pm2 or plain node) with doppler to manage secrets.

# pm2
if command -v pm2-runtime > /dev/null 2>&1; then
    cmd="pm2-runtime index.js -i max"
else
    cmd="node index.js"
fi

# doppler
if command -v doppler > /dev/null 2>&1; then
    cmd="doppler run -- $cmd"
fi

exec $cmd
