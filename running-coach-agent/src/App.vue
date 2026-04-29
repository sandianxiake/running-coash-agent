<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAgent, type Message } from './agent'

const messages = ref<Message[]>([])
const inputText = ref('')
const isLoading = ref(false)
const agent = getAgent()

// 初始化
onMounted(() => {
  // 添加欢迎消息
  messages.value.push({
    id: 'welcome',
    role: 'assistant',
    content: '你好！我是你的 AI 跑步教练。有什么关于跑步的问题，随时问我！\n\n我可以帮你：\n• 制定训练计划\n• 分析跑步数据\n• 解答跑步知识\n• 设定跑步目标',
    timestamp: Date.now()
  })
})

// 发送消息
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  inputText.value = ''
  isLoading.value = true

  try {
    const response = await agent.process(text)
    messages.value.push(response.message)
  } catch (error: any) {
    messages.value.push({
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: `出错了：${error.message}`,
      timestamp: Date.now()
    })
  } finally {
    isLoading.value = false
  }
}

// 清空对话
function clearChat() {
  messages.value = messages.value.filter(m => m.role === 'assistant')
  agent.clearHistory()
  messages.value.unshift({
    id: 'welcome',
    role: 'assistant',
    content: '对话已清空。我们重新开始吧！有什么想问的？',
    timestamp: Date.now()
  })
}
</script>

<template>
  <div class="chat-container">
    <!-- 头部 -->
    <header class="header">
      <h1>跑步教练 Agent</h1>
      <button class="clear-btn" @click="clearChat">清空对话</button>
    </header>

    <!-- 消息列表 -->
    <div class="messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['message', msg.role]"
      >
        <div class="avatar">
          {{ msg.role === 'user' ? '我' : 'AI' }}
        </div>
        <div class="content">
          <pre>{{ msg.content }}</pre>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="message assistant loading">
        <div class="avatar">AI</div>
        <div class="content">
          <div class="typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <textarea
        v-model="inputText"
        placeholder="输入你的问题..."
        @keydown.enter.exact.prevent="sendMessage"
        :disabled="isLoading"
      ></textarea>
      <button @click="sendMessage" :disabled="isLoading || !inputText.trim()">
        发送
      </button>
    </div>
  </div>
</template>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

.chat-container {
  max-width: 600px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.header {
  padding: 16px 20px;
  background: #4CAF50;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h1 {
    font-size: 18px;
    font-weight: 600;
  }
  
  .clear-btn {
    padding: 6px 12px;
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    
    &:hover {
      background: rgba(255,255,255,0.3);
    }
  }
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message {
  display: flex;
  margin-bottom: 16px;
  
  &.user {
    flex-direction: row-reverse;
    
    .content pre {
      background: #4CAF50;
      color: white;
    }
  }
  
  &.assistant {
    .content pre {
      background: #f0f0f0;
      color: #333;
    }
  }
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  
  .user & {
    background: #4CAF50;
    color: white;
    margin-left: 10px;
  }
  
  .assistant & {
    background: #2196F3;
    color: white;
    margin-right: 10px;
  }
}

.content {
  max-width: 75%;
  
  pre {
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.loading .content pre {
  display: flex;
  align-items: center;
}

.typing {
  display: flex;
  gap: 4px;
  
  span {
    width: 8px;
    height: 8px;
    background: #999;
    border-radius: 50%;
    animation: typing 1.4s infinite;
    
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

.input-area {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 12px;
  
  textarea {
    flex: 1;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    resize: none;
    height: 44px;
    outline: none;
    
    &:focus {
      border-color: #4CAF50;
    }
    
    &:disabled {
      background: #f5f5f5;
    }
  }
  
  button {
    padding: 0 24px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    
    &:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    &:not(:disabled):hover {
      background: #45a049;
    }
  }
}
</style>
