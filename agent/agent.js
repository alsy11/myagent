#!/usr/bin/env node


'use strict';
const fs    = require('fs');
const path  = require('path');
const https = require('https');

// 配置：模型、密钥、输入输出目录
// 模型deepseek-chat（默认）/ deepseek-reasoner
const MODEL      = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_KEY    = process.env.DEEPSEEK_API_KEY;
const OUTPUT_DIR = path.join(__dirname, 'generated');
const DOCS_DIR   = path.join(__dirname, 'docs');

if (!API_KEY) {
  console.error('[\u9519\u8bef] DEEPSEEK_API_KEY is not set.\n');
  console.error('Set it with one of:');
  console.error('  export DEEPSEEK_API_KEY=sk-...');
  console.error('  or add it to a .env file and run: node -r dotenv/config agent.js');
  process.exit(1);
}

// 工具定义
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file in the generated project directory.',
      parameters: {
        type: 'object',
        properties: {
          filepath: {
            type: 'string',
            description: 'Relative path from project root, e.g. src/game/gameService.js'
          },
          content: {
            type: 'string',
            description: 'Complete file content to write. Must never be truncated.'
          }
        },
        required: ['filepath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from the architecture docs folder.',
      parameters: {
        type: 'object',
        properties: {
          filepath: {
            type: 'string',
            description: 'Filename inside docs/, e.g. architecture.json'
          }
        },
        required: ['filepath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all files generated so far.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'task_complete',
      description: 'Signal that all project files have been generated. Call this last.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Brief summary of all generated files and how to run the project.'
          }
        },
        required: ['summary']
      }
    }
  }
];

// 工具执行器
const generatedFiles = [];

function executeTool(name, rawInput) {
  let input;
  try {
    input = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
  } catch {
    return `Error: could not parse tool arguments for "${name}": ${rawInput}`;
  }

  switch (name) {
    case 'write_file': {
      const fullPath = path.join(OUTPUT_DIR, input.filepath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, input.content, 'utf8');
      generatedFiles.push(input.filepath);
      console.log(`  [\u6b63\u786e] ${input.filepath}`);
      return `File written successfully: ${input.filepath}`;
    }

    case 'read_file': {
      const p = path.join(DOCS_DIR, path.basename(input.filepath));
      try {
        return fs.readFileSync(p, 'utf8');
      } catch {
        return `File not found: ${input.filepath}`;
      }
    }

    case 'list_files':
      return generatedFiles.length > 0
        ? `Generated files so far:\n${generatedFiles.map(f => '  ' + f).join('\n')}`
        : 'No files generated yet.';

    case 'task_complete':
      console.log('\n[\u5b8c\u6210] Agent signalled task_complete.');
      console.log('Summary:', input.summary);
      return 'acknowledged';

    default:
      return `Unknown tool: "${name}"`;
  }
}

// 调用 DeepSeek API
/**
 * 向 https://api.deepseek.com/v1/chat/completions 发送 POST 请求。
 * 
 *
 * @param {Array} messages 
 * @param {string} system 系统提示词（作为首条 system 消息发送）
 * @returns {Promise<object>} 接口返回的原始 JSON
 */
function callDeepSeek(messages, system) {
  return new Promise((resolve, reject) => {
    const allMessages = [
      { role: 'system', content: system },
      ...messages
    ];

    const body = JSON.stringify({
      model:       MODEL,
      messages:    allMessages,
      tools:       TOOLS,
      tool_choice: 'auto',   // 由模型决定是否调用工具
      max_tokens:  8192,
      temperature: 0         // 固定输出，提升代码生成稳定性
    });

    const options = {
      hostname: 'api.deepseek.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            reject(new Error(`DeepSeek API error: ${JSON.stringify(parsed.error)}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Failed to parse DeepSeek response:\n' + raw.slice(0, 400)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 代理循环：用户消息 -> 模型 tool_calls -> 执行工具 -> 回填结果 -> 继续
async function runAgent() {
  console.log('====================================================');
  console.log('Space Fractions Code Agent [\u8bbe\u7f6e]');
  console.log(`Model: ${MODEL}`);
  console.log('====================================================\n');

  // 读取 docs 下的架构输入
  const archJson = fs.readFileSync(path.join(DOCS_DIR, 'architecture.json'), 'utf8');
  let archView = '';
  try {
    archView = fs.readFileSync(path.join(DOCS_DIR, 'architecture_view.md'), 'utf8');
  } catch { /* optional */ }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const SYSTEM = `You are a senior software engineer and autonomous code generation agent.

Your mission: generate a COMPLETE, runnable Node.js project for "Space Fractions" - a web fraction-learning game for sixth-grade students - based on the architecture below.

## Files to generate (call write_file for EVERY one, in order):
 1. package.json
 2. .env.example
 3. src/db.js                          (pg Pool)
 4. src/game/gameService.js            (startGame, submitAnswer, getScore, pause, resume)
 5. src/game/gameRoutes.js             (Express router)
 6. src/question/questionService.js    (CRUD + seed validation)
 7. src/question/questionRoutes.js
 8. src/user/userService.js            (register, login, JWT)
 9. src/user/authMiddleware.js         (requireAuth, requireAdmin)
10. src/user/userRoutes.js
11. src/app.js                         (Express app, all middleware, all routes)
12. src/server.js                      (listen + graceful shutdown)
13. public/index.html                  -> FULL single-file game UI (HTML + CSS + JS embedded).
14. sql/init.sql                       (CREATE TABLE + 10 fraction question seeds)
15. openapi.yaml
16. Dockerfile
17. docker-compose.yml                 (app + postgres + redis services)
18. k8s/deployment.yaml
19. tests/game.test.js                 (Jest + supertest unit tests)
20. tests/question.test.js
21. README.md                          (setup, run, test instructions)

## Strict rules:
- Use write_file once per file. Content must be COMPLETE; never use "...".
- Node files use CommonJS (require / module.exports).
- After writing all 21 files, call task_complete with a summary.

## Architecture JSON:
${archJson}

## UML Component / Sequence / State summary:
${archView.slice(0, 2500)}
`;

  const messages = [
    {
      role: 'user',
      content: 'Generate the complete Space Fractions project. Write all 21 files with write_file, then call task_complete.'
    }
  ];

  const MAX_ITERATIONS = 50;
  let done = false;

  for (let iter = 1; iter <= MAX_ITERATIONS && !done; iter++) {
    console.log(`\n[\u8fdb\u5ea6] Iteration ${iter} calling DeepSeek...`);

    let response;
    try {
      response = await callDeepSeek(messages, SYSTEM);
    } catch (err) {
      console.error('[\u9519\u8bef] API call failed:', err.message);
      break;
    }

    const choice     = response.choices?.[0];
    const message    = choice?.message;
    const stopReason = choice?.finish_reason;

    if (!message) {
      console.error('[\u9519\u8bef] Unexpected response:', JSON.stringify(response).slice(0, 300));
      break;
    }

    messages.push(message);

    if (message.content) {
      const preview = message.content.slice(0, 160);
      console.log('  [\u6d88\u606f] ' + preview + (message.content.length > 160 ? '...' : ''));
    }

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      console.log(`  [\u4fe1\u606f] finish_reason=${stopReason}; no more tool calls, stopping.`);
      done = true;
      break;
    }

    const toolResults = [];

    for (const tc of toolCalls) {
      const fnName = tc.function?.name;
      const fnArgs = tc.function?.arguments;
      console.log(`  [\u5de5\u5177] ${fnName}`);

      const result = executeTool(fnName, fnArgs);

      toolResults.push({
        role:         'tool',
        tool_call_id: tc.id,
        name:         fnName,
        content:      result
      });

      if (fnName === 'task_complete') done = true;
    }

    messages.push(...toolResults);
  }

  console.log('\n' + '='.repeat(52));
  console.log(`[\u6587\u4ef6\u5939] Output directory : ${OUTPUT_DIR}`);
  console.log(`[\u6b63\u786e] Files generated  : ${generatedFiles.length} / 21`);
  generatedFiles.forEach(f => console.log(`    ${f}`));
  console.log('='.repeat(52));
  console.log('\nNext steps:');
  console.log('  cd generated && npm install');
  console.log('  cp .env.example .env   # fill in your DB creds');
  console.log('  psql $DATABASE_URL -f sql/init.sql');
  console.log('  npm start              # http://localhost:3000');
}

runAgent().catch(err => {
  console.error('\n[\u9519\u8bef] Fatal:', err.message);
  process.exit(1);
});