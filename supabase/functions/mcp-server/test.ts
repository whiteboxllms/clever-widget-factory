#!/usr/bin/env deno run --allow-net --allow-env

/**
 * MCP Server Test Script
 * 
 * This script tests the MCP server locally by sending MCP protocol messages
 * and validating responses.
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const MCP_SERVER_URL = "http://localhost:54321/functions/v1/mcp-server";

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

async function sendMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  const response = await fetch(MCP_SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

async function testInitialize() {
  console.log("🧪 Testing MCP Server Initialize...");
  
  const request: MCPRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };

  try {
    const response = await sendMCPRequest(request);
    console.log("✅ Initialize response:", JSON.stringify(response, null, 2));
    
    if (response.result?.serverInfo?.name === "clever-widget-factory-mcp") {
      console.log("✅ Server name matches expected value");
    } else {
      console.log("❌ Server name mismatch");
    }
  } catch (error) {
    console.log("❌ Initialize failed:", error);
  }
}

async function testListTools() {
  console.log("\n🧪 Testing List Tools...");
  
  const request: MCPRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };

  try {
    const response = await sendMCPRequest(request);
    console.log("✅ List tools response:", JSON.stringify(response, null, 2));
    
    if (response.result?.tools && Array.isArray(response.result.tools)) {
      console.log(`✅ Found ${response.result.tools.length} tools`);
      
      // Check for expected tools
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      const expectedTools = [
        "list_issues", "create_issue", "get_issue_details",
        "list_actions", "create_action", "get_action_details",
        "query_parts_inventory", "get_part_details", "check_parts_availability",
        "query_tools_assets", "get_sop_for_asset",
        "list_organization_members", "get_member_attributes",
        "get_related_issues", "suggest_responsible_party"
      ];
      
      const missingTools = expectedTools.filter(name => !toolNames.includes(name));
      if (missingTools.length === 0) {
        console.log("✅ All expected tools are present");
      } else {
        console.log("❌ Missing tools:", missingTools);
      }
    } else {
      console.log("❌ Invalid tools response format");
    }
  } catch (error) {
    console.log("❌ List tools failed:", error);
  }
}

async function testToolCall() {
  console.log("\n🧪 Testing Tool Call (list_issues)...");
  
  const request: MCPRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "list_issues",
      arguments: {
        organization_id: "00000000-0000-0000-0000-000000000000", // Test UUID
        limit: 5
      }
    }
  };

  try {
    const response = await sendMCPRequest(request);
    console.log("✅ Tool call response:", JSON.stringify(response, null, 2));
    
    if (response.error) {
      console.log("⚠️ Tool call returned error (expected for test UUID):", response.error.message);
    } else if (response.result?.content?.[0]?.text) {
      const result = JSON.parse(response.result.content[0].text);
      if (result.success === false && result.error?.includes("Organization not found")) {
        console.log("✅ Expected error for invalid organization ID");
      } else {
        console.log("✅ Tool call successful");
      }
    }
  } catch (error) {
    console.log("❌ Tool call failed:", error);
  }
}

async function testInvalidTool() {
  console.log("\n🧪 Testing Invalid Tool Call...");
  
  const request: MCPRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "invalid_tool",
      arguments: {}
    }
  };

  try {
    const response = await sendMCPRequest(request);
    console.log("✅ Invalid tool response:", JSON.stringify(response, null, 2));
    
    if (response.error && response.error.message.includes("Unknown tool")) {
      console.log("✅ Correctly rejected invalid tool");
    } else {
      console.log("❌ Should have rejected invalid tool");
    }
  } catch (error) {
    console.log("❌ Invalid tool test failed:", error);
  }
}

async function testInvalidRequest() {
  console.log("\n🧪 Testing Invalid Request Format...");
  
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invalid: "request"
      }),
    });

    const result = await response.json();
    console.log("✅ Invalid request response:", JSON.stringify(result, null, 2));
    
    if (!response.ok || result.error) {
      console.log("✅ Correctly rejected invalid request");
    } else {
      console.log("❌ Should have rejected invalid request");
    }
  } catch (error) {
    console.log("❌ Invalid request test failed:", error);
  }
}

async function main() {
  console.log("🚀 Starting MCP Server Tests");
  console.log(`📍 Server URL: ${MCP_SERVER_URL}`);
  
  // Check if server is running
  try {
    const healthCheck = await fetch(MCP_SERVER_URL, { method: "GET" });
    console.log(`🔍 Server health check: ${healthCheck.status}`);
  } catch (error) {
    console.log("❌ Server not accessible. Make sure to run:");
    console.log("   supabase start");
    console.log("   supabase functions serve mcp-server");
    Deno.exit(1);
  }

  await testInitialize();
  await testListTools();
  await testToolCall();
  await testInvalidTool();
  await testInvalidRequest();
  
  console.log("\n🎉 MCP Server tests completed!");
  console.log("\nNext steps:");
  console.log("1. Fix any failing tests");
  console.log("2. Test with real organization data");
  console.log("3. Deploy to production: supabase functions deploy mcp-server");
}

if (import.meta.main) {
  main().catch(console.error);
}
