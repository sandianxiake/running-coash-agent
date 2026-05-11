/**
 * 讯飞语音识别 WebAPI（语音听写流式版）
 * 使用 WebSocket 实时语音转写
 */

import CryptoJS from 'crypto-js'

// 讯飞配置
const XF_APPID = 'c2fb7a0e'
const XF_API_SECRET = 'OWZhYTBlMmFhOGRlNGU5NDkyMmQ1ODg4'
const XF_API_KEY = '9c7b4703bab81c43e356b890bb60f555'
const XF_URL = 'wss://ws-api.xfyun.cn/v2/iat'

export class XFVoiceRecognition {
  private ws: WebSocket | null = null
  private mediaRecorder: MediaRecorder | null = null
  private onResult: ((text: string) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private onStatusChange: ((status: string) => void) | null = null
  private isConnected = false
  private isRecording = false
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private animationId: number | null = null
  
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
   * 生成 RFC1123 格式的时间戳
   */
  private formatRFC1123Date(): string {
    const now = new Date()
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const day = days[now.getUTCDay()]
    const date = String(now.getUTCDate()).padStart(2, '0')
    const month = months[now.getUTCMonth()]
    const year = now.getUTCFullYear()
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    
    return `${day}, ${date} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`
  }
  
  /**
   * 生成讯飞签名（语音听写专用）
   * 使用 HMAC-SHA256
   */
  private generateAuthorization(): { authorization: string; date: string } {
    const date = this.formatRFC1123Date()
    
    // 签名内容
    const signatureOrigin = `host: ws-api.xfyun.cn\ndate: ${date}\nGET /v2/iat HTTP/1.1`
    
    // HMAC-SHA256 加密
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, XF_API_SECRET)
    const signatureBase64 = signatureSha.toString(CryptoJS.enc.Base64)
    
    // Authorization header
    const authorizationOrigin = `api_key="${XF_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`
    const authorization = btoa(authorizationOrigin)
    
    return { authorization, date }
  }
  
  /**
   * 生成 WebSocket URL
   */
  private generateUrl(): string {
    const { authorization, date } = this.generateAuthorization()
    
    const params = new URLSearchParams({
      authorization,
      date,
      host: 'ws-api.xfyun.cn'
    })
    
    return `${XF_URL}?${params.toString()}`
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
      
      // 创建音频分析器用于音量显示
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      source.connect(this.analyser)
      
      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      this.mediaRecorder.ondataavailable = (event) => {
        // 音频数据处理
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
          for (const w of word.cw) {
            text += w.w
          }
        }
        
        if (text) {
          this.onResult?.(text)
        }
      }
      
      // 检查是否是最后一帧
      if (json.data && json.data.status === 2) {
        console.log('识别完成')
        this.onStatusChange?.('completed')
      }
      
    } catch (error) {
      // 不是 JSON
    }
  }
  
  /**
   * 发送音频数据
   */
  private sendAudioData(data: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    
    // 转换为 Base64
    const base64 = this.arrayBufferToBase64(data)
    
    const frameData = {
      data: {
        status: 1, // 中间帧
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: base64
      }
    }
    
    this.ws.send(JSON.stringify(frameData))
  }
  
  /**
   * 发送结束帧
   */
  private sendEndFrame(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    
    const endData = {
      common: { app_id: XF_APPID },
      business: {
        domain: 'iat',
        language: 'zh_cn',
        accent: 'mandarin',
        vinfo: 1,
        vad_eos: 10000
      },
      data: {
        status: 2, // 最后一帧
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: ''
      }
    }
    
    this.ws.send(JSON.stringify(endData))
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
      
      if (this.audioContext) {
        this.audioContext.close()
        this.audioContext = null
      }
      
      if (this.animationId) {
        cancelAnimationFrame(this.animationId)
        this.animationId = null
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
    if (!this.analyser) return 0
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)
    
    // 计算平均音量
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const average = sum / dataArray.length
    
    // 归一化到 0-1
    return Math.min(1, average / 128)
  }
}
