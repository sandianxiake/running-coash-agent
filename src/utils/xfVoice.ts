/**
 * 讯飞语音识别（短语音识别 HTTP 接口）
 * 录音 → 停止 → 发送 → 返回结果
 */

import CryptoJS from 'crypto-js'

// 讯飞配置
const XF_APPID = 'c2fb7a0e'
const XF_API_SECRET = 'OWZhYTBlMmFhOGRlNGU5NDkyMmQ1ODg4'
const XF_API_KEY = '9c7b4703bab81c43e356b890bb60f555'
const XF_URL = 'https://iat-api.xfyun.cn/v2/ite'

export class XFVoiceRecognition {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null
  private onResult: ((text: string) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private onStatusChange: ((status: string) => void) | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private animationId: number | null = null
  private isRecording = false
  
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
   * 生成讯飞签名
   */
  private generateAuthorization(): { authorization: string; date: string } {
    const date = this.formatRFC1123Date()
    
    const signatureOrigin = `host: iat-api.xfyun.cn\ndate: ${date}\nGET /v2/ite HTTP/1.1`
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, XF_API_SECRET)
    const signatureBase64 = signatureSha.toString(CryptoJS.enc.Base64)
    
    const authorizationOrigin = `api_key="${XF_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`
    const authorization = btoa(authorizationOrigin)
    
    return { authorization, date }
  }
  
  /**
   * 开始录音
   */
  async start(): Promise<void> {
    try {
      this.audioChunks = []
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
      
      // 创建音频上下文用于音量显示
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.source.connect(this.analyser)
      
      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.start(100)
      this.isRecording = true
      this.onStatusChange?.('recording')
      
    } catch (error: any) {
      console.error('启动录音失败:', error)
      this.onError?.(`无法访问麦克风: ${error.message}`)
    }
  }
  
  /**
   * 停止录音并识别
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve()
        return
      }
      
      this.isRecording = false
      
      this.mediaRecorder.onstop = async () => {
        // 停止所有轨道
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
        
        this.onStatusChange?.('processing')
        
        // 合并音频
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        
        try {
          // 转换为 Base64
          const base64 = await this.blobToBase64(audioBlob)
          
          // 发送到讯飞
          const result = await this.sendToXunfei(base64)
          this.onResult?.(result)
          this.onStatusChange?.('completed')
          resolve()
        } catch (error: any) {
          console.error('识别失败:', error)
          this.onError?.(`识别失败: ${error.message || error}`)
          this.onStatusChange?.('error')
          reject(error)
        }
      }
      
      this.mediaRecorder.stop()
    })
  }
  
  /**
   * Blob 转 Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  
  /**
   * 发送到讯飞语音听写
   */
  private async sendToXunfei(audioBase64: string): Promise<string> {
    const { authorization, date } = this.generateAuthorization()
    
    const response = await fetch(XF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'X-CurTime': date,
        'X-Param': btoa(JSON.stringify({
          'engine_type': 'sms16k',
          'aue': 'raw'
        }))
      },
      body: JSON.stringify({
        common: {
          app_id: XF_APPID
        },
        business: {
          domain: 'iat',
          language: 'zh_cn',
          accent: 'mandarin',
          vinfo: 1,
          vad_eos: 10000
        },
        data: {
          status: 2,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: audioBase64
        }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    const result = await response.json()
    console.log('讯飞响应:', result)
    
    if (result.code !== '0') {
      throw new Error(`讯飞错误 ${result.code}: ${result.message}`)
    }
    
    // 解析识别结果
    const words = result.data.result.ws || []
    let text = ''
    for (const word of words) {
      for (const w of word.cw) {
        text += w.w
      }
    }
    
    if (!text) {
      throw new Error('未识别到语音内容')
    }
    
    return text
  }
  
  /**
   * 获取音频分析数据
   */
  getAudioLevel(): number {
    if (!this.analyser) return 0
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)
    
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const average = sum / dataArray.length
    return Math.min(1, average / 128)
  }
}
