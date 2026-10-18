> ## Documentation Index
> Fetch the complete documentation index at: https://docs.higgsfield.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Get request status

> Retrieve the current state and output of a generation request.



## OpenAPI

````yaml /openapi.json get /requests/{request_id}/status
openapi: 3.1.0
info:
  title: Higgsfield API
  version: 2.0.0
  description: Submit generation requests and retrieve their status and outputs.
servers:
  - url: https://api.higgsfield.ai
security:
  - authKey: []
paths:
  /requests/{request_id}/status:
    get:
      tags:
        - Requests
      summary: Get request status
      description: Retrieve the current state and output of a generation request.
      operationId: get_request_status
      parameters:
        - name: request_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
            title: Request Id
      responses:
        '200':
          description: Current request state and output, when available.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RequestStatus'
        '401':
          description: Missing or invalid API credentials.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: The request does not exist or belongs to another account.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    RequestStatus:
      title: Request
      type: object
      properties:
        status:
          enum:
            - queued
            - in_progress
            - nsfw
            - failed
            - completed
            - canceled
          title: Status
          type: string
        request_id:
          type: string
          format: uuid
        status_url:
          type: string
          format: uri
        cancel_url:
          type: string
          format: uri
        error:
          type:
            - string
            - 'null'
        images:
          type: array
          items:
            $ref: '#/components/schemas/MediaOutput'
        video:
          $ref: '#/components/schemas/MediaOutput'
        audio:
          $ref: '#/components/schemas/MediaOutput'
        audios:
          type: array
          items:
            $ref: '#/components/schemas/MediaOutput'
      required:
        - status
        - request_id
    ErrorResponse:
      title: Error response
      type: object
      properties:
        detail:
          type: string
      required:
        - detail
    MediaOutput:
      title: Media output
      type: object
      additionalProperties: false
      properties:
        url:
          type: string
          format: uri
      required:
        - url
  securitySchemes:
    authKey:
      type: apiKey
      in: header
      name: Authorization
      description: Use `Key {api_key_id}:{api_key_secret}`.

````

## Related topics

- [API reference](/docs/api-reference/overview.md)
- [Genjutsu — Restyle API](/docs/models/genjutsu/restyle.md)
- [Quickstart](/docs/quickstart.md)
- [How the API works](/docs/how-to/introduction.md)
- [Errors and retries](/docs/concepts/errors.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.