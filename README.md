# Grok API 兼容服务器

这是一个使用Deno构建的服务器，它提供了一个与OpenAI API格式兼容的接口，但实际调用的是Grok大语言模型。

## 功能特点

- 完全兼容OpenAI API格式的请求
- 支持流式输出（streaming）
- 支持CORS，可以从前端直接调用
- 支持`/v1/chat/completions`和`/v1/models`端点
- 从请求的Authorization头获取API密钥（无需环境变量）
- 自动处理API请求超时（默认120秒）
- 完全保留原始请求参数，不会自动添加默认值

## 使用前提

1. 您需要安装Deno运行时环境
2. 您需要拥有Grok API密钥

## 运行方式

1. 启动服务器：

```bash
deno run --allow-net worker-grok.js
```

2. 使用您的API密钥发送请求（在Authorization头中）

## API使用示例

### 发送聊天请求

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GROK_API_KEY" \
  -d '{
    "model": "mixtral-8x7b-32768",
    "messages": [
      {"role": "system", "content": "你是一个有用的AI助手。"},
      {"role": "user", "content": "请介绍一下你自己。"}
    ],
    "temperature": 0.7
  }'
```

### 查询可用模型

```bash
curl http://localhost:8000/v1/models \
  -H "Authorization: Bearer YOUR_GROK_API_KEY"
```

## 配置选项

您可以在脚本中修改以下配置：

- `GROK_API_BASE_URL`: Grok API的基础URL（默认为 https://api.x.ai/v1）
- `API_TIMEOUT_MS`: API请求超时时间（默认为120000毫秒/120秒）

## 注意事项

- API密钥通过请求的Authorization头传递，格式为`Bearer YOUR_API_KEY`
- 如果API请求超过设定的超时时间，将返回超时错误
- 参数如`max_tokens`等只有在请求中明确提供时才会被传递给Grok API
- 如果您需要在生产环境中使用，建议添加更多的安全措施
- 默认监听端口为8000，您可以在代码中修改 