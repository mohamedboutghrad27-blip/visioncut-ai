> ## Documentation Index
> Fetch the complete documentation index at: https://docs.higgsfield.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Submit a generation request and retrieve its result.

This guide uses the REST API so you can see the complete request lifecycle. It takes about five minutes.

## Prerequisites

* A [Higgsfield Console](https://console.higgsfield.ai) account
* An API key ID and secret
* `curl` and `jq`

<Warning>
  API credentials grant access to your account and credits. Use them only in server-side code and never commit them to source control.
</Warning>

## 1. Configure credentials

```bash theme={"theme":{"light":"github-light","dark":"github-dark"}}
export HF_API_KEY_ID="your-api-key-id"
export HF_API_KEY_SECRET="your-api-key-secret"
export IDEMPOTENCY_KEY=$(uuidgen | tr '[:upper:]' '[:lower:]')
```

## 2. Submit a generation

```bash theme={"theme":{"light":"github-light","dark":"github-dark"}}
RESPONSE=$(curl --silent --show-error --fail-with-body \
  --request POST \
  --url https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard \
  --header "Authorization: Key ${HF_API_KEY_ID}:${HF_API_KEY_SECRET}" \
  --header "Content-Type: application/json" \
  --header "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  --data '{
    "prompt": "A quiet alpine lake at sunrise, editorial photography"
  }')

echo "$RESPONSE" | jq
export REQUEST_ID=$(echo "$RESPONSE" | jq --raw-output '.request_id')
```

The initial response has the `queued` status:

```json theme={"theme":{"light":"github-light","dark":"github-dark"}}
{
  "status": "queued",
  "request_id": "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff",
  "status_url": "https://api.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/status",
  "cancel_url": "https://api.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/cancel"
}
```

If submission times out before you receive this response, repeat it with the same `IDEMPOTENCY_KEY`. See [Idempotent requests](/docs/concepts/idempotency).

## 3. Check the result

```bash theme={"theme":{"light":"github-light","dark":"github-dark"}}
curl --silent --show-error --fail-with-body \
  --url "https://api.higgsfield.ai/requests/${REQUEST_ID}/status" \
  --header "Authorization: Key ${HF_API_KEY_ID}:${HF_API_KEY_SECRET}" | jq
```

Repeat the status request until it reaches a terminal state. A completed image request returns:

```json theme={"theme":{"light":"github-light","dark":"github-dark"}}
{
  "status": "completed",
  "request_id": "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff",
  "status_url": "https://api.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/status",
  "cancel_url": "https://api.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/cancel",
  "images": [
    {
      "url": "https://cdn.example.com/generated-image.jpg"
    }
  ]
}
```

The other terminal statuses are `failed`, `nsfw`, and `canceled`.

## Next steps

<CardGroup cols={2}>
  <Card title="Use an SDK" icon="code" href="/docs/how-to/sdk">
    Submit and wait for results with Python or TypeScript.
  </Card>

  <Card title="Prepare for production" icon="server" href="/docs/concepts/polling">
    Add backoff, timeouts, terminal-state handling, and webhooks.
  </Card>
</CardGroup>


## Related topics

- [Image Generation API](/docs/models/image-generation.md)
- [Video Generation API](/docs/models/video-generation.md)
- [Genjutsu — Motion transfer API](/docs/models/genjutsu/motion-transfer.md)
- [Genjutsu — Object swap API](/docs/models/genjutsu/object-swap.md)
- [Kling 3.0 — Turbo · Image to video API](/docs/models/kling-3/turbo-image-to-video.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.