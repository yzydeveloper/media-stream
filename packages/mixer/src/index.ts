export interface MixerOptions {
    width: number
    height: number
    fps: number
}
export interface AttachStreamOptions {
    sx: number
    sy: number
    swidth: number
    sheight: number
    x: number
    y: number
    width: number
    height: number
    z: number
    muted: boolean
}
export interface StreamItem extends AttachStreamOptions {
    id: string,
    element: HTMLVideoElement
    audioSource: MediaStreamAudioSourceNode | null
    videoTracks: MediaStreamTrack[]
    audioTracks: MediaStreamTrack[]
}
export class Mixer {
    public width = 720

    public height = 405

    public fps = 25

    private streams: StreamItem[] = []

    public supported: boolean | null = null

    private canvas: HTMLCanvasElement | null = null

    private ctx: CanvasRenderingContext2D | null = null

    private timer: number | null = null

    private audioContext: AudioContext | null = null

    private audioDestinationNode: MediaStreamAudioDestinationNode | null = null

    private gainNode: GainNode | null = null

    public media: MediaStream | null = null

    constructor(options?: MixerOptions) {
        const audioSupport = !!(window.AudioContext && (new AudioContext()).createMediaStreamDestination)
        const canvasSupport = !!document.createElement('canvas').captureStream
        const supported = audioSupport && canvasSupport
        this.supported = supported
        if (!supported) {
            return
        }

        this.media = new MediaStream()
        this.setOptions(options)
        this.createAudioContext()
    }

    setOptions(options: MixerOptions | undefined) {
        this.width = options?.width || this.width
        this.height = options?.height || this.height
        this.fps = options?.fps || this.fps
    }

    createAudioContext() {
        this.audioContext = new AudioContext()
        this.audioDestinationNode = this.audioContext.createMediaStreamDestination()
        this.gainNode = this.audioContext.createGain()
        this.gainNode.connect(this.audioContext.destination)
        this.gainNode.gain.value = 0
    }

    attachStream(stream: MediaStream, options?: Partial<AttachStreamOptions>) {
        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()
        const element = document.createElement('video')
        element.autoplay = true
        element.muted = true
        element.playsInline = true
        element.srcObject = stream
        // this.audioContext?.resume()
        element.play().catch(null)

        const worker: StreamItem = {
            id: stream?.id,
            sx: options?.sx || 0,
            sy: options?.sy || 0,
            swidth: options?.swidth || options?.width || this.width,
            sheight: options?.sheight || options?.height || this.height,
            x: options?.x || 0,
            y: options?.y || 0,
            width: options?.width || options?.swidth || this.width,
            height: options?.height || options?.sheight || this.height,
            z: options?.z || 0,
            muted: options?.muted || false,
            videoTracks,
            audioTracks,
            audioSource: null,
            element
        }

        if (worker.audioTracks.length && this.gainNode && this.audioDestinationNode && !worker.muted) {
            worker.audioSource = this.audioContext?.createMediaStreamSource(stream) || null
            worker.audioSource?.connect(this.gainNode)
            worker.audioSource?.connect(this.audioDestinationNode)
        }

        this.streams.push(worker)
        this.sort()
    }

    detachStream(stream: MediaStream) {
        this.streams = this.streams.filter(s => {
            if (s.id === stream.id) {
                s.element.remove()
                s.audioSource?.disconnect()
            }
            return s.id !== stream.id
        })
    }

    private sort() {
        this.streams.sort((a, b) => a.z - b.z)
    }

    private draw() {
        if (!this.streams.length) {
            this.ctx?.clearRect(0, 0, this.width, this.height)
            this.ctx && (this.ctx.fillStyle = '#000000')
            this.ctx?.fillRect(0, 0, this.width, this.height)
        } else {
            this.streams.forEach(stream => {
                const { element, sx, sy, swidth, sheight, x, y, width, height } = stream
                this.ctx?.drawImage(element, sx, sy, swidth, sheight, x, y, width, height)
            })
        }
        this.timer = window.setTimeout(this.draw.bind(this), this.fps)
    }

    start() {
        this.canvas = document.createElement('canvas')
        this.canvas.width = this.width
        this.canvas.height = this.height
        this.canvas.style.width = `${this.width}px`
        this.canvas.style.height = `${this.height}px`
        this.ctx = this.canvas.getContext('2d')
        if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume()
        }
        this.draw()

        const videoTracks = this.canvas.captureStream().getVideoTracks()
        const audioTracks = this.audioDestinationNode?.stream.getAudioTracks()
        videoTracks.forEach(track => {
            this.media?.addTrack(track)
        })
        if (audioTracks) {
            audioTracks.forEach(track => {
                this.media?.addTrack(track)
            })
        }
    }

    stop() {
        this.canvas = null
        this.ctx = null
        this.supported = null
        this.streams.forEach(s => {
            s.audioSource?.disconnect()
            s.element.remove()
        })
        this.streams = []
        this.audioContext?.close()
        this.audioContext = null
        this.audioDestinationNode?.disconnect()
        this.audioDestinationNode = null
        this.gainNode?.disconnect()
        this.gainNode = null

        const tracks = this.media?.getTracks()
        tracks?.forEach(track => track.stop())

        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }
}
