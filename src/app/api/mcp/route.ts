/**
 * MCP remote server endpoint (Streamable HTTP, stateless).
 *
 * Implements the Model Context Protocol over JSON-RPC 2.0 so Claude Desktop
 * / Claude Code / claude.ai custom connectors can use the editor's AI tools:
 *   POST /api/mcp?key=<MCP_TOKEN>   (or Authorization: Bearer <MCP_TOKEN>)
 *
 * Supported methods: initialize, notifications/*, ping, tools/list, tools/call.
 * Stateless: no session id is issued; GET/DELETE respond 405 (no SSE stream).
 * Responses are plain application/json — allowed by the Streamable HTTP spec.
 */

import { NextRequest, NextResponse } from "next/server";
import { MCP_TOOLS, callMcpTool, type McpToolResult } from "@/lib/mcp";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const SUPPORTED_VERSIONS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);
const LATEST_VERSION = "2025-06-18";
const SERVER_INFO = { name: "visioncut-ai", version: "1.0.0" };
const SERVER_INSTRUCTIONS =
  "VisionCut AI editor tools: check visioncut_status first. Generation: storyboards from scripts, images, voiceovers (Arabic supported), text-to-video (start + poll pattern). Persistence: visioncut_create_project makes a project, visioncut_import_media downloads a URL (e.g. the MP4 from visioncut_check_video) into the user's cloud library, visioncut_add_to_project places it on the timeline — after that the clip is visible in the user's editor dashboard.";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function checkAuth(req: NextRequest): boolean {
  const token = process.env.MCP_TOKEN?.trim();
  if (!token) return false; // not configured -> server disabled
  const header = req.headers.get("authorization");
  if (header && header.replace(/^Bearer\s+/i, "").trim() === token) return true;
  const url = new URL(req.url);
  return url.searchParams.get("key") === token;
}

/** Non-tool methods (tools/call is handled in POST with the tool layer). */
function handleRpcMessage(msg: JsonRpcRequest): { status: number; body?: unknown } {
  const method = msg.method || "";

  switch (method) {
    case "initialize": {
      const requested = String((msg.params as { protocolVersion?: string } | undefined)?.protocolVersion || "");
      const version = SUPPORTED_VERSIONS.has(requested) ? requested : LATEST_VERSION;
      return {
        status: 200,
        body: rpcResult(msg.id, {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: SERVER_INSTRUCTIONS,
        }),
      };
    }
    case "ping":
      return { status: 200, body: rpcResult(msg.id, {}) };
    case "tools/list":
      return { status: 200, body: rpcResult(msg.id, { tools: MCP_TOOLS }) };
    default:
      if (method.startsWith("notifications/")) return { status: 202 }; // accepted, no body
      return { status: 200, body: rpcError(msg.id, -32601, `Method not found: ${method}`) };
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    const configured = !!process.env.MCP_TOKEN?.trim();
    return NextResponse.json(
      {
        error: configured
          ? "Unauthorized. Pass the MCP token as ?key=<MCP_TOKEN> or Authorization: Bearer <MCP_TOKEN>."
          : "MCP is not configured on this server. Set the MCP_TOKEN environment variable.",
      },
      { status: configured ? 401 : 503 },
    );
  }

  let payload: JsonRpcRequest | JsonRpcRequest[] | null = null;
  try {
    payload = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error: body is not valid JSON"), { status: 400 });
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const responses: unknown[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || !msg.method) {
      responses.push(rpcError(msg?.id ?? null, -32600, "Invalid Request"));
      continue;
    }
    if (msg.method === "tools/call") {
      const params = (msg.params || {}) as { name?: string; arguments?: unknown };
      const name = String(params.name || "");
      if (!name) {
        responses.push(rpcError(msg.id, -32602, "tools/call requires a tool name"));
        continue;
      }
      // Tool execution errors are RESULTS with isError:true (MCP convention),
      // not JSON-RPC errors — Claude shows them as tool failures.
      const result: McpToolResult = await callMcpTool(name, params.arguments ?? {});
      responses.push(rpcResult(msg.id, result));
      continue;
    }
    const out = handleRpcMessage(msg);
    if (out.body !== undefined) responses.push(out.body);
    // status 202 (notification) contributes no response
  }

  if (!responses.length) {
    return new NextResponse(null, { status: 202 });
  }
  return NextResponse.json(Array.isArray(payload) ? responses : responses[0]);
}

export async function GET() {
  return NextResponse.json(
    { error: "This MCP server does not offer an SSE stream (stateless). Use POST for JSON-RPC." },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json({ error: "Stateless server: no session to terminate." }, { status: 405 });
}
