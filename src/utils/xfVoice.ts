/**
 * 科大讯飞语音识别 WebAPI
 * 参考文档：https://www.xfyun.cn/doc/tts/online_tts/API.html
 */

const XF_APPID = 'c2fb7a0e'
const XF_API_KEY = '9c7b4703bab81c43e356b890bb60f555'
const XF_API_SECRET = 'OWZhYTBlMmFhOGRlNGU5NDkyMmQ1ODg4'

// 讯飞语音识别 WebAPI 地址
const XF_URL = 'wss://rtasr.xfyun.cn/v1/ws'

/**
 * 简单的 MD5 实现
 */
function md5(string: string): string {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift))
  }
  
  function addUnsigned(x: number, y: number): number {
    const x4 = x & 0x80000000
    const y4 = y & 0x80000000
    const x8 = x & 0x40000000
    const y8 = y & 0x40000000
    const result = (x & 0x3FFFFFFF) + (y & 0x3FFFFFFF)
    if (x8 & y8) return result ^ 0x80000000 ^ x4 ^ y4
    if (x8 | y8) {
      if (result & 0x40000000) return result ^ 0xC0000000 ^ x4 ^ y4
      return result ^ 0x40000000 ^ x4 ^ y4
    }
    return result ^ x4 ^ y4
  }
  
  function F(x: number, y: number, z: number): number { return (x & y) | (~x & z) }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & ~z) }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z }
  function I(x: number, y: number, z: number): number { return y ^ (x | ~z) }
  
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  
  function convertToWordArray(str: string): number[] {
    let lWordCount = 0
    const lMessageLength = str.length
    const lNumberOfWords1 = ((lMessageLength + 8) >>> 6) + 1
    const lNumberOfWords2 = lNumberOfWords1 * 16
    const lWordArray = new Array(lNumberOfWords2).fill(0)
    
    for (let i = 0; i < lMessageLength; i++) {
      const lBytePosition = (i % 4) * 8
      lWordArray[lWordCount >>> 2] |= str.charCodeAt(i) << lBytePosition
      lWordCount++
    }
    
    lWordArray[lWordCount >>> 2] |= 0x80 << (lWordCount % 4 * 8)
    lWordArray[lNumberOfWords2 - 2] = lMessageLength << 3
    lWordArray[lNumberOfWords2 - 1] = lMessageLength >>> 29
    return lWordArray
  }
  
  function wordToHex(value: number): string {
    let wordToHexValue = ''
    for (let j = 0; j <= 3; j++) {
      const wordToHexValue2 = (value >>> (j * 8)) & 255
      const mostSignificant = wordToHexValue2.toString(16)
      wordToHexValue += (mostSignificant.length === 2 ? mostSignificant : '0' + mostSignificant)
    }
    return wordToHexValue
  }
  
  let a = 0x67452301
  let b = 0xEFCDAB89
  let c = 0x98BADCFE
  let d = 0x10325476
  
  const wordArray = convertToWordArray(string)
  const lMessageLength = wordArray.length
  
  for (let k = 0; k < lMessageLength; k += 16) {
    const AA = a, BB = b, CC = c, DD = d
    
    a = FF(a, b, c, d, wordArray[k + 0], 7, 0xD76AA478)
    d = FF(d, a, b, c, wordArray[k + 1], 12, 0xE8C7B756)
    c = FF(c, d, a, b, wordArray[k + 2], 17, 0x242070DB)
    b = FF(b, c, d, a, wordArray[k + 3], 22, 0xC1BDCEEE)
    a = FF(a, b, c, d, wordArray[k + 4], 7, 0xF57C0FAF)
    d = FF(d, a, b, c, wordArray[k + 5], 12, 0x4787C62A)
    c = FF(c, d, a, b, wordArray[k + 6], 17, 0xA8304613)
    b = FF(b, c, d, a, wordArray[k + 7], 22, 0xFD469501)
    a = FF(a, b, c, d, wordArray[k + 8], 7, 0x698098D8)
    d = FF(d, a, b, c, wordArray[k + 9], 12, 0x8B44F7AF)
    c = FF(c, d, a, b, wordArray[k + 10], 17, 0xFFFF5BB1)
    b = FF(b, c, d, a, wordArray[k + 11], 22, 0x895CD7BE)
    a = FF(a, b, c, d, wordArray[k + 12], 7, 0x6B901122)
    d = FF(d, a, b, c, wordArray[k + 13], 12, 0xFD987193)
    c = FF(c, d, a, b, wordArray[k + 14], 17, 0xA679438E)
    b = FF(b, c, d, a, wordArray[k + 15], 22, 0x49B40821)
    
    a = GG(a, b, c, d, wordArray[k + 1], 5, 0xF61E2562)
    d = GG(d, a, b, c, wordArray[k + 6], 9, 0xC040B340)
    c = GG(c, d, a, b, wordArray[k + 11], 14, 0x265E5A51)
    b = GG(b, c, d, a, wordArray[k + 0], 20, 0xE9B6C7AA)
    a = GG(a, b, c, d, wordArray[k + 5], 5, 0xD62F105D)
    d = GG(d, a, b, c, wordArray[k + 10], 9, 0x2441453)
    c = GG(c, d, a, b, wordArray[k + 15], 14, 0xD8A1E681)
    b = GG(b, c, d, a, wordArray[k + 4], 20, 0xE7D3FBC8)
    a = GG(a, b, c, d, wordArray[k + 9], 5, 0x21E1CDE6)
    d = GG(d, a, b, c, wordArray[k + 14], 9, 0xC33707D6)
    c = GG(c, d, a, b, wordArray[k + 3], 14, 0xF4D50D87)
    b = GG(b, c, d, a, wordArray[k + 8], 20, 0x455A14ED)
    a = GG(a, b, c, d, wordArray[k + 13], 5, 0xA9E3E905)
    d = GG(d, a, b, c, wordArray[k + 2], 9, 0xFCEFA3F8)
    c = GG(c, d, a, b, wordArray[k + 7], 14, 0x676F02D9)
    b = GG(b, c, d, a, wordArray[k + 12], 20, 0x8D2A4C8A)
    
    a = HH(a, b, c, d, wordArray[k + 5], 4, 0xFFFA3942)
    d = HH(d, a, b, c, wordArray[k + 8], 11, 0x8771F681)
    c = HH(c, d, a, b, wordArray[k + 11], 16, 0x6D9D6122)
    b = HH(b, c, d, a, wordArray[k + 14], 23, 0xFDE5380C)
    a = HH(a, b, c, d, wordArray[k + 1], 4, 0xA4BEEA44)
    d = HH(d, a, b, c, wordArray[k + 4], 11, 0x4BDECFA9)
    c = HH(c, d, a, b, wordArray[k + 7], 16, 0xF6BB4B60)
    b = HH(b, c, d, a, wordArray[k + 10], 23, 0xBEBFBC70)
    a = HH(a, b, c, d, wordArray[k + 13], 4, 0x289B7EC6)
    d = HH(d, a, b, c, wordArray[k + 0], 11, 0xEAA127FA)
    c = HH(c, d, a, b, wordArray[k + 3], 16, 0xD4EF3085)
    b = HH(b, c, d, a, wordArray[k + 6], 23, 0x4881D05)
    a = HH(a, b, c, d, wordArray[k + 9], 4, 0xD9D4D039)
    d = HH(d, a, b, c, wordArray[k + 12], 11, 0xE6DB99E5)
    c = HH(c, d, a, b, wordArray[k + 15], 16, 0x1FA27CF8)
    b = HH(b, c, d, a, wordArray[k + 2], 23, 0xC4AC5665)
    
    a = II(a, b, c, d, wordArray[k + 0], 6, 0xF4292244)
    d = II(d, a, b, c, wordArray[k + 7], 10, 0x432AFF97)
    c = II(c, d, a, b, wordArray[k + 14], 15, 0xAB9423A7)
    b = II(b, c, d, a, wordArray[k + 5], 21, 0xFC93A039)
    a = II(a, b, c, d, wordArray[k + 12], 6, 0x655B59C3)
    d = II(d, a, b, c, wordArray[k + 3], 10, 0x8F0CCC92)
    c = II(c, d, a, b, wordArray[k + 10], 15, 0xFFEFF47D)
    b = II(b, c, d, a, wordArray[k + 1], 21, 0x85845DD1)
    a = II(a, b, c, d, wordArray[k + 8], 6, 0x6FA87E4F)
    d = II(d, a, b, c, wordArray[k + 15], 10, 0xFE2CE6E0)
    c = II(c, d, a, b, wordArray[k + 6], 15, 0xA3014314)
    b = II(b, c, d, a, wordArray[k + 13], 21, 0x4E0811A1)
    a = II(a, b, c, d, wordArray[k + 4], 6, 0xF7537E82)
    d = II(d, a, b, c, wordArray[k + 11], 10, 0xBD3AF235)
    c = II(c, d, a, b, wordArray[k + 2], 15, 0x2AD7D2BB)
    b = II(b, c, d, a, wordArray[k + 9], 21, 0xEB86D391)
    
    a = addUnsigned(a, AA)
    b = addUnsigned(b, BB)
    c = addUnsigned(c, CC)
    d = addUnsigned(d, DD)
  }
  
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase()
}

export class XFVoiceRecognition {
  private ws: WebSocket | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private onResult: ((text: string) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private onStatusChange: ((status: string) => void) | null = null
  private isConnected = false
  private isRecording = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  
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
   * 生成 WebSocket URL（带签名）
   */
  private generateUrl(): string {
    const curTime = Math.floor(Date.now() / 1000).toString()
    const param = btoa(JSON.stringify({
      engine_type: 'sms16k',
      aue: 'raw',
    }))
    
    const checkSum = md5(XF_API_KEY + curTime + param)
    
    return `${XF_URL}?appid=${XF_APPID}&engine_type=sms16k&aue=raw&lang=zh-CN&curtime=${curTime}&signa=${checkSum}&signparam=${param}`
  }
  
  /**
   * 开始录音
   */
  async start(): Promise<void> {
    try {
      this.onStatusChange?.('requesting')
      
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      })
      
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
      
      this.mediaRecorder.onstop = () => {
        this.sendAudio()
      }
      
      // 开始录音
      this.mediaRecorder.start(100) // 每100ms发送一次
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
   * 停止录音
   */
  stop(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
  
  /**
   * 连接 WebSocket
   */
  private connect(): void {
    const url = this.generateUrl()
    console.log('连接讯飞 WebSocket...')
    console.log('URL:', url)
    
    try {
      this.ws = new WebSocket(url)
      
      this.ws.onopen = () => {
        console.log('讯飞 WebSocket 已连接')
        this.isConnected = true
        this.reconnectAttempts = 0
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
        
        // 如果还在录音，尝试重连
        if (this.isRecording && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`尝试重连... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
          setTimeout(() => this.connect(), 1000)
        }
      }
      
    } catch (error: any) {
      console.error('创建 WebSocket 失败:', error)
      this.onError?.(`连接失败: ${error.message}`)
    }
  }
  
  /**
   * 处理消息
   */
  private handleMessage(data: string): void {
    try {
      const response = JSON.parse(data)
      
      if (response.code !== 0) {
        console.error('讯飞错误:', response)
        this.onError?.(`识别错误: ${response.message || response.code}`)
        return
      }
      
      // 识别结果
      if (response.data) {
        const text = response.data
        console.log('识别结果:', text)
        this.onResult?.(text)
      }
      
      // 是否结束
      if (response.status === 2) {
        console.log('识别完成')
        this.onStatusChange?.('completed')
      }
      
    } catch (error) {
      console.error('解析消息失败:', error)
    }
  }
  
  /**
   * 发送音频数据
   */
  private async sendAudio(): Promise<void> {
    if (this.audioChunks.length === 0) {
      console.log('没有音频数据')
      return
    }
    
    // 合并音频块
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
    const arrayBuffer = await audioBlob.arrayBuffer()
    
    if (this.ws && this.isConnected) {
      // 讯飞需要 base64 编码的音频
      const base64 = this.arrayBufferToBase64(arrayBuffer)
      this.ws.send(base64)
      console.log('已发送音频数据，长度:', base64.length)
      
      // 发送结束标记
      setTimeout(() => {
        if (this.ws && this.isConnected) {
          this.ws.send('{"end": true}')
          console.log('已发送结束标记')
        }
      }, 500)
    }
  }
  
  /**
   * ArrayBuffer 转 Base64（浏览器兼容）
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}

export default XFVoiceRecognition
