#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";

// Initialize LLM client. Supports OpenAI and any OpenAI-compatible endpoint
// (e.g. local servers, gateways). Configure via environment:
//   OPENAI_API_KEY   - API key (required)
//   OPENAI_BASE_URL  - override base URL (optional, default OpenAI)
//   REVIEW_MODEL     - model name (optional, default gpt-4o-mini for lower cost)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy",
  ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
});
const REVIEW_MODEL = process.env.REVIEW_MODEL || "gpt-4o-mini";

// Code review prompt template
const REVIEW_PROMPT = `You are an expert code reviewer. Analyze the following code changes and provide:

1. **Summary**: Brief overview of what the changes do
2. **Issues**: Any bugs, security vulnerabilities, or performance problems
3. **Suggestions**: Improvements for code quality, readability, or best practices
4. **Approval**: Recommend "approve", "request_changes", or "comment"

Be concise but thorough. Focus on actionable feedback.

Code diff:
%s`;

class CodeReviewServer {
  constructor() {
    this.server = new Server(
      {
        name: "reviewpilot-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "review_code",
            description: "Review code changes and provide feedback",
            inputSchema: {
              type: "object",
              properties: {
                diff: {
                  type: "string",
                  description: "The code diff to review",
                },
                context: {
                  type: "string",
                  description: "Optional context about the changes",
                },
              },
              required: ["diff"],
            },
          },
          {
            name: "analyze_security",
            description: "Analyze code for security vulnerabilities",
            inputSchema: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "The code to analyze",
                },
                language: {
                  type: "string",
                  description: "Programming language",
                },
              },
              required: ["code"],
            },
          },
          {
            name: "suggest_improvements",
            description: "Suggest code quality improvements",
            inputSchema: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "The code to analyze",
                },
                focus: {
                  type: "string",
                  description: "Focus area (performance, readability, best_practices)",
                  enum: ["performance", "readability", "best_practices", "all"],
                },
              },
              required: ["code"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "review_code":
            return await this.reviewCode(args.diff, args.context);
          case "analyze_security":
            return await this.analyzeSecurity(args.code, args.language);
          case "suggest_improvements":
            return await this.suggestImprovements(args.code, args.focus);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async reviewCode(diff, context = "") {
    const prompt = REVIEW_PROMPT.replace("%s", diff);
    const fullPrompt = context 
      ? `${prompt}\n\nAdditional context: ${context}`
      : prompt;

    const response = await openai.chat.completions.create({
      model: REVIEW_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert code reviewer. Provide concise, actionable feedback.",
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const review = response.choices[0].message.content;

    return {
      content: [
        {
          type: "text",
          text: review,
        },
      ],
    };
  }

  async analyzeSecurity(code, language = "unknown") {
    const prompt = `Analyze the following ${language} code for security vulnerabilities.
Focus on:
- SQL injection
- XSS vulnerabilities
- Authentication/authorization issues
- Sensitive data exposure
- Input validation issues
- Dependency vulnerabilities

Code:
${code}`;

    const response = await openai.chat.completions.create({
      model: REVIEW_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a security expert. Identify potential security vulnerabilities.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const analysis = response.choices[0].message.content;

    return {
      content: [
        {
          type: "text",
          text: analysis,
        },
      ],
    };
  }

  async suggestImprovements(code, focus = "all") {
    const focusAreas = {
      performance: "performance optimization and efficiency",
      readability: "code readability and maintainability",
      best_practices: "industry best practices and patterns",
      all: "all aspects of code quality",
    };

    const prompt = `Suggest improvements for the following code, focusing on ${focusAreas[focus]}.

Provide:
1. Specific issues found
2. Suggested changes with code examples
3. Explanation of why the change improves the code

Code:
${code}`;

    const response = await openai.chat.completions.create({
      model: REVIEW_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a senior developer. Provide actionable code improvement suggestions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const suggestions = response.choices[0].message.content;

    return {
      content: [
        {
          type: "text",
          text: suggestions,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Code Review MCP Server running on stdio");
  }
}

// ---------------------------------------------------------------------------
// CLI mode: run a one-shot review outside of MCP.
//   reviewpilot-mcp --review <diffFile> [--context "..."]
//   reviewpilot-mcp --security <codeFile> [--language js]
// Prints plain text to stdout; ideal for CI and pre-commit hooks.
async function runCli(argv){
  const args = argv.slice(2);
  function valueAfter(flag){
    const i = args.indexOf(flag);
    return i >= 0 ? args[i+1] : undefined;
  }
  const fs = await import("node:fs");

  if(args.includes("--review")){
    const file = valueAfter("--review");
    const diff = fs.readFileSync(file, "utf8");
    const context = valueAfter("--context") || "";
    const out = await reviewpilotReview(diff, context);
    process.stdout.write(out + "\n");
  } else if(args.includes("--security")){
    const file = valueAfter("--security");
    const code = fs.readFileSync(file, "utf8");
    const language = valueAfter("--language") || "unknown";
    const out = await reviewpilotSecurity(code, language);
    process.stdout.write(out + "\n");
  } else {
    process.stderr.write("Usage: reviewpilot-mcp --review <diffFile> [--context ...]\n");
    process.exit(2);
  }
}

// Standalone text-returning wrappers (used by both CLI and MCP tools)
async function reviewpilotReview(diff, context){
  const prompt = REVIEW_PROMPT.replace("%s", diff);
  const fullPrompt = context ? prompt + "\n\nAdditional context: " + context : prompt;
  const response = await openai.chat.completions.create({
    model: REVIEW_MODEL,
    messages: [
      { role: "system", content: "You are an expert code reviewer. Provide concise, actionable feedback." },
      { role: "user", content: fullPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1500
  });
  return response.choices[0].message.content;
}

async function reviewpilotSecurity(code, language){
  const prompt = "Analyze the following " + language + " code for security vulnerabilities.\nCode:\n" + code;
  const response = await openai.chat.completions.create({
    model: REVIEW_MODEL,
    messages: [
      { role: "system", content: "You are a security expert. Identify potential security vulnerabilities." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1000
  });
  return response.choices[0].message.content;
}

// Entry: CLI flags win; otherwise start the MCP server.
if(process.argv.slice(2).length > 0){
  runCli(process.argv).catch((e)=>{ process.stderr.write("Error: " + e.message + "\n"); process.exit(1); });
} else {
  const server = new CodeReviewServer();
  server.run().catch(console.error);
}

