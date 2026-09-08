#!/bin/sh
set -e

# Default to port 80 if PORT is not set by Render / hosting environment
PORT="${PORT:-80}"

# Configure Apache to listen on the dynamic port assigned by Render
sed -i "s/Listen [0-9]*/Listen ${PORT}/g" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:[0-9]*>/<VirtualHost \*:${PORT}>/g" /etc/apache2/sites-available/*.conf

exec apache2-foreground
