export interface RecorderOptions extends MediaRecorderOptions {
    timeslice?: number
}

export class Recorder {
    private mediaSource: MediaSource | null = null

    private mediaRecorder: MediaRecorder | null = null

    private timeslice: number | null = null

    private sourceBuffer: SourceBuffer | null = null

    private stream: MediaStream | null = null

    private _blobs: Blob[] = []

    private mimeType: string | null = 'video/webm;codecs=opus,vp8'

    private recorderOptions: RecorderOptions | null = null

    private queue: ArrayBuffer[] = []

    media: HTMLMediaElement | null = null

    constructor(stream: MediaStream, options?: RecorderOptions) {
        this.setOptions(stream, options)
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
        this.media = media
        if (this.mediaSource) {
            this.media.src = URL.createObjectURL(this.mediaSource)
            this.media.addEventListener('progress', () => {
                if (this.media?.readyState === 2) {
                    this.media.currentTime += 0.1
                }
            })
        }
    }

    start(timeslice?: RecorderOptions['timeslice']) {
        this.timeslice = timeslice ?? 10
        this.mediaRecorder?.start(this.timeslice)
    }

    pause() {
        this.mediaRecorder?.pause()
    }

    resume() {
        this.mediaRecorder?.resume()
    }

    destroy() {
        this.sourceBuffer?.abort()
        this.mediaRecorder?.pause()
        this.mediaSource?.endOfStream()
        this.sourceBuffer = null
        this.mediaSource = null
        this.mediaRecorder = null
        this.queue = []
        if (this.media) {
            URL.revokeObjectURL(this.media.src)
            this.media = null
        }
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
        this.sourceBuffer.addEventListener('updatestart', this.onSBUpdateStart.bind(this))
        this.sourceBuffer.addEventListener('updateend', this.onSBUpdateEnd.bind(this))
        this.sourceBuffer.addEventListener('error', this.onSBUpdateError.bind(this))
    }

    private onSBUpdateStart() { }

    private onSBUpdateEnd() {
        const buffer = this.queue.shift()
        if (buffer && !this.sourceBuffer?.updating) {
            this.sourceBuffer?.appendBuffer(buffer)
        }
    }

    private onSBUpdateError() { }

    private createMediaSource() {
        this.mediaSource = new MediaSource()
        this.mediaSource.addEventListener('sourceopen', this.onMediaSourceOpen.bind(this))
        this.mediaSource.addEventListener('sourceended', this.onMediaSourceEnded.bind(this))
        this.mediaSource.addEventListener('sourceclose', this.onMediaSourceClose.bind(this))
    }

    private onMediaSourceOpen() {
        if (!this.mediaSource || !this.mimeType) return
        this.createSourceBuffer()
    }

    private onMediaSourceEnded() { }

    private onMediaSourceClose() { }
}
