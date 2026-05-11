/**
 * 阿里云 Fun-ASR 实时语音识别
 * WebSocket 方式，支持浏览器直接调用
 */

// 阿里云百炼 API Key
const ALI_API_KEY = 'sk-13e63726c1774d4897ed1c09a08e7041'

// WebSocket 地址
const WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/'

// 生成随机任务 ID
function generateTaskId(): string {
  return Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

export interface XfVoiceCallback {
  onStart?: () => void
  onResult?: (text: string) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

export class XfVoice {
  private ws: WebSocket | null = null
  private callback: XfVoiceCallback
  private taskId: string = ''
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isRecording: boolean = false
  private recognitionText: string = ''

  constructor(callback: XfVoiceCallback) {
    this.callback = callback
  }

  async start(): Promise<void> {
    if (this.isRecording) return
    
    this.recognitionText = ''
    
    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      this.audioChunks = []
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.onstop = async () => {
        await this.sendAudioToAli()
        // 停止所有轨道
        stream.getTracks().forEach(track => track.stop())
      }
      
      // 开始录制
      this.mediaRecorder.start()
      this.isRecording = true
      
      // 连接到阿里云
      await this.connectWebSocket()
      
      this.callback.onStart?.()
      
    } catch (error: any) {
      this.callback.onError?.(`无法访问麦克风: ${error.message}`)
    }
  }

  async stop(): Promise<void> {
    if (!this.isRecording || !this.mediaRecorder) return
    
    this.isRecording = false
    
    this.mediaRecorder.stop()
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.taskId = generateTaskId()
      
      this.ws = new WebSocket(WS_URL, {
        headers: {
          Authorization: `bearer ${ALI_API_KEY}`
        }
      })
      
      this.ws.onopen = () => {
        console.log('阿里云 WebSocket 已连接')
        this.sendRunTask()
        resolve()
      }
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      
      this.ws.onerror = (error) => {
        console.error('阿里云 WebSocket 错误:', error)
        this.callback.onError?.('WebSocket 连接错误')
        reject(error)
      }
      
      this.ws.onclose = (event) => {
        console.log('阿里云 WebSocket 已关闭:', event.code, event.reason)
      }
    })
  }

  private sendRunTask(): void {
    const message = {
      header: {
        action: 'run-task',
        task_id: this.taskId,
        streaming: 'duplex'
      },
      payload: {
        task_group: 'audio',
        task: 'asr',
        function: 'recognition',
        model: 'fun-asr-realtime',
        parameters: {
          sample_rate: 16000,
          format: 'wav'
        },
        input: {}
      }
    }
    
    this.ws?.send(JSON.stringify(message))
  }

  private async sendAudioToAli(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket 未连接，跳过发送')
      return
    }
    
    try {
      // 将 webm 转换为 wav
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
      const arrayBuffer = await audioBlob.arrayBuffer()
      
      // 创建 AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 })
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // 转换为 WAV 格式
      const wavBuffer = this.audioBufferToWav(audioBuffer)
      
      // 发送音频数据
      // 分块发送，每块 1024 字节
      const chunkSize = 1024
      const delay = (chunkSize / (16000 * 2)) * 1000 // 根据采样率和字节数计算延迟
      
      let offset = 0
      while (offset < wavBuffer.byteLength) {
        const chunk = wavBuffer.slice(offset, offset + chunkSize)
        this.ws.send(chunk)
        offset += chunkSize
        
        if (offset < wavBuffer.byteLength) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      // 发送结束指令
      this.sendFinishTask()
      
      // 延迟关闭 WebSocket，等待结果返回
      setTimeout(() => {
        this.ws?.close()
      }, 1000)
      
    } catch (error: any) {
      console.error('发送音频失败:', error)
      this.callback.onError?.(`发送音频失败: ${error.message}`)
    }
  }

  private sendFinishTask(): void {
    const message = {
      header: {
        action: 'finish-task',
        task_id: this.taskId,
        streaming: 'duplex'
      },
      payload: {
        input: {}
      }
    }
    
    this.ws?.send(JSON.stringify(message))
  }

  private handleMessage(data: any): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data
      
      console.log('阿里云消息:', message)
      
      if (message.header) {
        switch (message.header.event) {
          case 'task-started':
            console.log('任务开始')
            break
            
          case 'result-generated':
            if (message.payload?.output?.sentence?.text) {
              const text = message.payload.output.sentence.text
              console.log('识别结果:', text)
              this.recognitionText += text
              this.callback.onResult?.(this.recognitionText)
            }
            break
            
          case 'task-finished':
            console.log('任务完成')
            this.callback.onEnd?.()
            break
            
          case 'task-failed':
            console.error('任务失败:', message.header.error_message)
            this.callback.onError?.(`识别失败: ${message.header.error_message}`)
            break
            
          case 'error':
            console.error('错误:', message.payload?.message)
            this.callback.onError?.(`错误: ${message.payload?.message}`)
            break
        }
      }
    } catch (error) {
      // 二进制消息，直接忽略
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = 1 // 单声道
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16
    
    const bytesPerSample = bitDepth / 8
    const blockAlign = numChannels * bytesPerSample
    
    const dataLength = buffer.length * blockAlign
    const bufferLength = 44 + dataLength
    
    const arrayBuffer = new ArrayBuffer(bufferLength)
    const view = new DataView(arrayBuffer)
    
    // RIFF 头
    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    this.writeString(view, 8, 'WAVE')
    
    // fmt 子 chunk
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, format, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)
    
    // data 子 chunk
    this.writeString(view, 36, 'data')
    view.setUint32(40, dataLength, true)
    
    // 写入音频数据
    const channelData = buffer.getChannelData(0)
    let offset = 44
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
    
    return arrayBuffer
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  isActive(): boolean {
    return this.isRecording
  }

  destroy(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    this.isRecording = false
  }
}
