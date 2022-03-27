export interface MixerOptions {
    width: number
    height: number
}

export interface AttachStreamOptions {
    x: number
    y: number
    z: number
    width: number
    height: number
    muted: boolean
}
export interface StreamItem extends AttachStreamOptions {
    element: HTMLVideoElement
    hasVideo: boolean
    hasAudio: boolean
}
export class Mixer {
    public width = 720

    public height = 405

    private streams: StreamItem[] = []

    public supported: boolean | null = null

    private canvas: HTMLCanvasElement | null = null

    private ctx: CanvasRenderingContext2D | null = null

    constructor(options?: MixerOptions | undefined) {
        const audioSupport = !!(window.AudioContext && (new AudioContext()).createMediaStreamDestination)
        const canvasSupport = !!document.createElement('canvas').captureStream
        const supported = audioSupport && canvasSupport
        this.supported = supported
        if (!supported) {
            return
        }

        this.setOptions(options)
    }

    setOptions(options: MixerOptions | undefined) {
        this.width = options?.width || this.width
        this.height = options?.height || this.height
    }

    attachStream(stream: MediaStream, options: AttachStreamOptions | undefined) {
        const worker = {
            x: options?.x || 0,
            y: options?.y || 0,
            z: options?.z || 0,
            width: options?.width || this.width,
            height: options?.height || this.height,
            muted: options?.muted || false,
            hasVideo: !!stream.getVideoTracks().length,
            hasAudio: !!stream.getAudioTracks().length,
            element: document.createElement('video')
        }
        worker.element.autoplay = true
        worker.element.muted = true
        worker.element.playsInline = true
        worker.element.srcObject = stream
        worker.element.play().catch(null)
        this.streams.push(worker)
        this.sort()
    }

    detachStream() { }

    private sort() {
        this.streams.sort((a, b) => a.z - b.z)
    }

    private draw() { }

    start() {
        this.canvas = document.createElement('canvas')
        this.canvas.width = this.width
        this.canvas.height = this.height
        this.canvas.style.width = `${this.width}px`
        this.canvas.style.height = `${this.height}px`
    }

    stop() { }
}
