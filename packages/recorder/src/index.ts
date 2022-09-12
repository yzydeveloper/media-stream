export interface RecorderOptions extends MediaRecorderOptions {
    timeslice?: number
    isDebug?: boolean
}

export class Recorder {
    private mediaSource: MediaSource | null = null

    private mediaRecorder: MediaRecorder | null = null

    private timeslice: number | null = null

    private sourceBuffer: SourceBuffer | null = null

    private stream: MediaStream | null = null

    private _media: HTMLMediaElement | null = null

    private _blobs: Blob[] = []

    private mimeType: string | null = 'video/webm;codecs=opus,vp8'

    private recorderOptions: RecorderOptions | null = null

    private queue: ArrayBuffer[] = []

    constructor(stream: MediaStream, options?: RecorderOptions) {
        this.setOptions(stream, options)
    }

    private get isDebug() {
        return this.recorderOptions?.isDebug
    }

    get media() {
        return this._media
    }

    get blobs() {
        return this._blobs
    }

    private setOptions(stream: MediaStream, options?: RecorderOptions) {
        this.stream = stream
        this.recorderOptions = options ?? {}
        this.createMediaSource()
        this.createMediaRecorder()
    }

    attachMedia(media: HTMLMediaElement) {
        this._media = media
        if (this.mediaSource) {
            this._media.src = URL.createObjectURL(this.mediaSource)
            this._media.addEventListener('progress', () => {
                if (this._media?.readyState === 2) {
                    this._media.currentTime += 0.1
                }
            })
        }
    }

    start(timeslice?: RecorderOptions['timeslice']) {
        this.timeslice = timeslice ?? 10
        this.mediaRecorder?.start(this.timeslice)
    }

    private createMediaRecorder() {
        if (!this.stream || !this.mimeType) return
        const { mimeType, recorderOptions } = this
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType,
            ...recorderOptions
        })
        this.mediaRecorder.ondataavailable = (e) => {
            const blob = e.data
            if (blob.size > 0) {
                const reader = new FileReader()
                this._blobs.push(blob)
                reader.readAsArrayBuffer(blob)
                reader.onloadend = () => {
                    reader.onloadend = null
                    if (reader.result && reader.result instanceof ArrayBuffer) {
                        if (this.sourceBuffer?.updating || this.queue.length) {
                            this.queue.push(reader.result)
                        } else {
                            this.sourceBuffer?.appendBuffer(reader.result)
                        }
                    }
                }
            }
        }
    }

    private createSourceBuffer() {
        if (!this.mediaSource || !this.mimeType) return
        this.sourceBuffer = this.mediaSource?.addSourceBuffer(this.mimeType)
        this.sourceBuffer.addEventListener('updatestart', this.sbUpdateStart.bind(this))
        this.sourceBuffer.addEventListener('updateend', this.sbUpdateEnd.bind(this))
        this.sourceBuffer.addEventListener('error', this.sbUpdateError.bind(this))
    }

    private sbUpdateStart() {
        this.isDebug && console.log('[recorder]: source buffer updatestart')
    }

    private sbUpdateEnd() {
        this.isDebug && console.log('[recorder]: source buffer updateend')
        const buffer = this.queue.shift()
        if (buffer && !this.sourceBuffer?.updating) {
            this.sourceBuffer?.appendBuffer(buffer)
        }
    }

    private sbUpdateError() {
        this.isDebug && console.log('[recorder]: source buffer error')
    }

    private createMediaSource() {
        this.mediaSource = new MediaSource()
        this.mediaSource.addEventListener('sourceopen', this.mediaSourceOpen.bind(this))
        this.mediaSource.addEventListener('sourceended', this.mediaSourceEnded.bind(this))
        this.mediaSource.addEventListener('sourceclose', this.mediaSourceClose.bind(this))
    }

    private mediaSourceOpen() {
        if (!this.mediaSource || !this.mimeType) return
        this.isDebug && console.log('[recorder]: Media source opened')
        this.createSourceBuffer()
    }

    private mediaSourceEnded() {
        this.isDebug && console.log('[recorder]: Media source ended')
    }

    private mediaSourceClose() {
        this.isDebug && console.log('[recorder]: Media source close')
    }
}
