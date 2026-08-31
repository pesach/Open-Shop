#!/usr/bin/env node
/**
 * Open-Shop MCP Server CLI Executable (bin/openshop-mcp.mjs)
 * Usage:
 *   node bin/openshop-mcp.mjs
 */
import { createMCPServer } from '../mcp/openshop-mcp-server.mjs';

createMCPServer();
