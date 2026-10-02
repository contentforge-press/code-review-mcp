# Code Review MCP Server

AI-powered code review MCP server for automated pull request analysis.

## Features

- **Code Review**: Automated PR review with actionable feedback
- **Security Analysis**: Identify security vulnerabilities in code
- **Improvement Suggestions**: Get code quality improvement recommendations
- **MCP Compatible**: Works with any MCP client (Claude, Cursor, etc.)

## Installation

```bash
npm install -g code-review-mcp
```

## Setup

1. Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

2. Configure in your MCP client:

### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "code-review": {
      "command": "node",
      "args": ["/path/to/code-review-mcp/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "code-review": {
      "command": "node",
      "args": ["/path/to/code-review-mcp/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### 1. review_code
Review code changes and provide feedback.

**Parameters:**
- `diff` (required): The code diff to review
- `context` (optional): Additional context about the changes

**Example:**
```json
{
  "diff": "--- a/file.js\n+++ b/file.js\n@@ -1,3 +1,5 @@\n+// New function\n+function add(a, b) {\n+  return a + b;\n+}",
  "context": "Added new utility function for arithmetic operations"
}
```

### 2. analyze_security
Analyze code for security vulnerabilities.

**Parameters:**
- `code` (required): The code to analyze
- `language` (optional): Programming language

**Example:**
```json
{
  "code": "const query = `SELECT * FROM users WHERE id = ${userId}`;",
  "language": "javascript"
}
```

### 3. suggest_improvements
Suggest code quality improvements.

**Parameters:**
- `code` (required): The code to analyze
- `focus` (optional): Focus area (performance, readability, best_practices, all)

**Example:**
```json
{
  "code": "function processData(data) { return data.filter(x => x).map(x => x * 2); }",
  "focus": "performance"
}
```

## Usage with AI Agents

This MCP server can be used by AI agents to automatically review code:

```javascript
// Example: AI agent using the MCP server
const review = await mcpClient.callTool({
  name: "review_code",
  arguments: {
    diff: prDiff,
    context: "Feature: user authentication"
  }
});

console.log(review.content[0].text);
```

## Enterprise Features

For enterprise use cases, contact us for:
- Custom review rules and guidelines
- Integration with CI/CD pipelines
- Team-specific coding standards
- Priority support
- On-premise deployment

## License

MIT

## Author

ContentForge Press

## Support

- GitHub Issues: https://github.com/contentforge-press/code-review-mcp/issues
- Email: support@contentforge.press
