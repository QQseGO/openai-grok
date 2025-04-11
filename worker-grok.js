// worker-grok.js
// Deno兼容的Grok模型API调用脚本，兼容OpenAI API格式

// 配置
const GROK_API_BASE_URL = "https://api.x.ai/v1";
const API_TIMEOUT_MS = 120000; // 设置API请求超时时间为120秒

// 处理CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 创建Deno服务器
Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 从请求头中获取Authorization
  const authorization = req.headers.get("Authorization");
  
  // 检查是否提供了Authorization头
  if (!authorization) {
    return new Response(JSON.stringify({
      error: {
        message: "需要提供Authorization头",
        type: "authorization_error",
      }
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  const url = new URL(req.url);
  
  // 处理 /v1/chat/completions 端点
  if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
    try {
      const requestData = await req.json();
      
      // 获取请求参数
      let model = requestData.model;
      const messages = requestData.messages || [];
      const temperature = requestData.temperature ?? 0.7;
      const stream = requestData.stream ?? false;
      
      // 处理模型名称中的推理深度后缀
      let reasoning_effort = undefined;
      if (model.endsWith('-high') || model.endsWith('-low')) {
        const suffix = model.endsWith('-high') ? '-high' : '-low';
        reasoning_effort = suffix.substring(1); // 移除连字符，得到 'high' 或 'low'
        model = model.substring(0, model.length - suffix.length); // 移除后缀得到原始模型名
      }
      
      // 构建发送到Grok的请求
      const grokRequestBody = {
        model,
        messages,
        temperature,
        stream
      };
      
      // 添加推理深度参数（如果存在）
      if (reasoning_effort !== undefined) {
        grokRequestBody.reasoning_effort = reasoning_effort;
      }
      
      // 只有当请求中包含max_tokens时才添加到请求体
      if (requestData.max_tokens !== undefined) {
        grokRequestBody.max_tokens = requestData.max_tokens;
      }
      
      // 创建超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      
      try {
        // 调用Grok API，使用从请求中获取的Authorization头
        const response = await fetch(`${GROK_API_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authorization
          },
          body: JSON.stringify(grokRequestBody),
          signal: controller.signal // 添加信号控制器
        });
        
        // 清除超时
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Grok API error (${response.status}): ${errorText}`);
        }
        
        // 处理流式输出
        if (stream) {
          const { readable, writable } = new TransformStream();
          
          (async () => {
            const writer = writable.getWriter();
            const reader = response.body.getReader();
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  await writer.close();
                  break;
                }
                
                const chunk = decoder.decode(value);
                await writer.write(encoder.encode(chunk));
              }
            } catch (error) {
              console.error("Stream processing error:", error);
              writer.abort(error);
            }
          })();
          
          return new Response(readable, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            }
          });
        } else {
          // 非流式输出，直接返回结果
          const data = await response.json();
          return new Response(JSON.stringify(data), {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('请求超时，API未在预期时间内响应');
        }
        throw error;
      }
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response(JSON.stringify({
        error: {
          message: error.message,
          type: "api_error",
        }
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }
  
  // 处理 /v1/models 端点
  else if (url.pathname === "/v1/models" && req.method === "GET") {
    try {
      // 创建超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      
      try {
        const response = await fetch(`${GROK_API_BASE_URL}/models`, {
          headers: {
            "Authorization": authorization
          },
          signal: controller.signal // 添加信号控制器
        });
        
        // 清除超时
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Grok API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('请求超时，API未在预期时间内响应');
        }
        throw error;
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      return new Response(JSON.stringify({
        error: {
          message: error.message,
          type: "api_error",
        }
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }
  
  // 未知端点
  else {
    return new Response(JSON.stringify({
      error: {
        message: "未找到请求的端点",
        type: "not_found",
      }
    }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});

console.log("Grok API兼容服务器已启动，在8000端口监听...");
