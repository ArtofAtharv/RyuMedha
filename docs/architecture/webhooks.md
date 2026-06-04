# Webhooks

The primary webhook is configured on the Meta Developer Portal and points to the `bot` application running locally or remotely (e.g. EC2/Cloudflare tunnel).
The `bot` handles webhook verification (GET) and processes messages (POST).
