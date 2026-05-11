# myagent

本项目是一个代码生成 Agent：读取架构输入后，调用 DeepSeek API，自动生成一个完整可运行的软件项目

## 1. 任务目标

### 1.1 Agent 输入要求

必须提供两类输入：

1. `Architecture_Documentation.md`
- 建议先转成结构化 JSON，作为 Agent 的主输入。
- 在本项目中，对应文件：`agent/docs/architecture.json`

2. `Architecture_View.md`
- 提供架构 UML 语法（PlantUML）视图。
- 在本项目中，对应文件：`agent/docs/architecture_view.md`

### 1.2 Agent 输出要求

输出包括但不限于：

- 项目目录结构
- 项目代码仓内容（源码）
- 依赖文件（`package.json` / `requirements.txt`）
- `Dockerfile`（可选，本项目已输出）
- `README`
- 测试用例

在本项目里，Agent 会写入 `agent/generated/`，并生成 21 个核心文件（源码、SQL、OpenAPI、Docker、K8s、测试、README 等）。

## 2. 仓库结构

```text
myagent/
├─ agent/
│  ├─ agent.js                         # Agent 主程序
│  ├─ docs/
│  │  ├─ architecture.json             # 结构化架构输入
│  │  └─ architecture_view.md          # UML 架构视图输入
│  ├─ generated/                       # Agent 生成结果输出目录
│  ├─ package.json
│  └─ README.md
├─ 思路与实现.md
└─ 操作验证.mp4
```

## 3. 从 0 开始：从调用 API 到生成结果


### 步骤 1：准备环境

- Node.js >= 18
- 可用网络（能访问 `https://api.deepseek.com`）
- DeepSeek API Key 
- 我的apikey是sk-82adc1137bc448deb97fdfbd257a4002 供老师调用使用


### 步骤 2：准备输入文件

进入 `agent/docs/`，放入：

- `architecture.json`（由 `Architecture_Documentation.md` 转换而来）
- `architecture_view.md`（UML/PlantUML 语法）

推荐 JSON 结构至少包含：

```json
{
  "system": "your-system-name",
  "description": "system description",
  "architecturalStyle": "monolith|microservices|...",
  "components": [],
  "requirements": {
    "functional": [],
    "nonFunctional": [],
    "architectural": []
  }
}
```

### 步骤 3：配置 API Key

在 `agent/` 下创建 `.env`：

```env
DEEPSEEK_API_KEY=your_api_key_here   #sk-82adc1137bc448deb97fdfbd257a4002
DEEPSEEK_MODEL=deepseek-chat
```

### 步骤 4：安装并运行 Agent（触发 API 调用）

```bash
cd agent
npm install
npm run generate
```

说明：
- `npm run generate` 会执行 `node -r dotenv/config agent.js`
- `agent.js` 会向 `POST /v1/chat/completions` 发送请求
- 通过工具调用（`write_file/read_file/list_files/task_complete`）逐步产出文件



## 4. 运行生成后的项目


```bash
cd agent/generated
docker compose down -v
docker compose up --build -d
```

访问：`http://localhost:3001`







