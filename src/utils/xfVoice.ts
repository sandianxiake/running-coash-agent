/**
 * 讯飞语音识别 WebAPI
 * 使用 WebSocket 实时语音转写
 */

import CryptoJS from 'crypto-js'

// 讯飞配置
const XF_APPID = 'c2fb7a0e'
const XF_API_SECRET = 'OWZhYTBlMmFhOGRlNGU5NDkyMmQ1ODg4'
const XF_URL = 'wss://rtasr.xfyun.cn/v1/ws'

export class XFVoiceRecognition {
  private ws: WebSocket | null = null
  private mediaRecorder: MediaRecorder | null = null
  private onResult: ((text: string) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private onStatusChange: ((status: string) => void) | null = null
  private isConnected = false
  private isRecording = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private stream: MediaStream | null = null
  private audioChunks: Blob[] = []
  
  constructor(options: {
    onResult?: (text: string) => void
    onError?: (error: string) => void
    onStatusChange?: (status: string) => void
  }) {
    this.onResult = options.onResult || null
    this.onError = options.onError || null
    this.onStatusChange = options.onStatusChange || null
  }
  
  /**
   * 生成讯飞签名
   * 公式: Base64(HMAC-SHA1(MD5(APPID + curTime), APISecret))
   */
  private generateSignature(ts: number): string {
    const strToHash = XF_APPID + ts
    const md5Result = CryptoJS.MD5(strToHash).toString()
    const hmacResult = CryptoJS.HmacSHA1(md5Result, XF_API_SECRET)
    return hmacResult.toString(CryptoJS.enc.Base64)
  }
  
  /**
   * 生成 WebSocket URL
   */
  private generateUrl(): string {
    const ts = Math.floor(Date.now() / 1000)
    const signa = this.generateSignature(ts)
    
    return `${XF_URL}?appid=${XF_APPID}&ts=${ts}&signa=${signa}&engine_type=sms16k&lang=zh-CN`
  }
  
  /**
   * 开始录音
   */
  async start(): Promise<void> {
    try {
      this.onStatusChange?.('requesting')
      
      // 获取麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      })
      
      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      this.audioChunks = []
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.onstop = () => {
        this.sendAudio()
      }
      
      // 开始录音
      this.mediaRecorder.start(100)
      this.isRecording = true
      this.onStatusChange?.('recording')
      
      // 连接讯飞 WebSocket
      this.connect()
      
    } catch (error: any) {
      console.error('启动录音失败:', error)
      this.onError?.(`无法访问麦克风: ${error.message}`)
    }
  }
  
  /**
   * 连接讯飞 WebSocket
   */
  private connect(): void {
    try {
      const url = this.generateUrl()
      console.log('讯飞 WebSocket URL:', url)
      
      this.ws = new WebSocket(url)
      
      this.ws.onopen = () => {
        console.log('讯飞 WebSocket 已连接')
        this.isConnected = true
        this.onStatusChange?.('connected')
        this.reconnectAttempts = 0
      }
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      
      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error)
        this.onError?.('WebSocket 连接错误')
      }
      
      this.ws.onclose = (event) => {
        console.log('WebSocket 已关闭:', event.code, event.reason)
        this.isConnected = false
        this.onStatusChange?.('disconnected')
        
        // 如果是异常断开，尝试重连
        if (event.code !== 1000 && this.isRecording && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`尝试重连... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
          this.onStatusChange?.('reconnecting')
          setTimeout(() => this.connect(), 1000)
        }
      }
      
    } catch (error: any) {
      console.error('连接失败:', error)
      this.onError?.(`连接失败: ${error.message}`)
    }
  }
  
  /**
   * 处理消息
   */
  private handleMessage(data: string): void {
    try {
      const json = JSON.parse(data)
      
      console.log('讯飞消息:', json)
      
      if (json.code !== '0') {
        console.error('讯飞错误:', json.code, json.message)
        this.onError?.(`识别错误: ${json.code}`)
        return
      }
      
      // 处理识别结果
      if (json.data && json.data.result) {
        const words = json.data.result.ws || []
        let text = ''
        for (const word of words) {
          text += word.cw[0].w
        }
        
        if (text) {
          this.onResult?.(text)
        }
      }
      
    } catch (error) {
      // 不是 JSON，可能是二进制音频数据
    }
  }
  
  /**
   * 发送音频数据
   */
  private async sendAudio(): Promise<void> {
    if (this.audioChunks.length === 0) return
    
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
    const arrayBuffer = await audioBlob.arrayBuffer()
    
    // 转换为 Base64
    const base64 = this.arrayBufferToBase64(arrayBuffer)
    
    if (this.ws && this.isConnected) {
      // 发送结束指令
      const endCommand = {
        data: {
          status: 2,
          data: base64
        }
      }
      
      this.ws.send(JSON.stringify(endCommand))
    }
  }
  
  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
  
  /**
   * 停止录音
   */
  stop(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false
      this.mediaRecorder.stop()
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
        this.stream = null
      }
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.onStatusChange?.('completed')
  }
  
  /**
   * 获取音频分析数据
   */
  getAudioLevel(): number {
    return 0
  }
}
