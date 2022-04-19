export interface RecorderOptions extends MediaRecorderOptions {
    timeslice?: number
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

    get media() {
        return this._media
    }

    get blobs() {
        return this._blobs
    }

    constructor(stream: MediaStream, options: RecorderOptions) {
        this.setOptions(stream, options)
    }

    private setOptions(stream: MediaStream, options: RecorderOptions) {
        this.stream = stream
        this.recorderOptions = options
        this.mediaSource = new MediaSource()
        this.createMediaRecorder()
    }

    attachMedia(media: HTMLMediaElement) {
        this._media = media
        this.mediaSource?.addEventListener('sourceopen', this.mediaSourceOpen)
        this.mediaSource?.addEventListener('sourceended', this.mediaSourceEnded)
        this.mediaSource?.addEventListener('sourceclose', this.mediaSourceClose)
    }

    start(timeslice: RecorderOptions['timeslice']) {
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
    }

    private createSourceBuffer() {
        if (!this.mediaSource || !this.mimeType) return
        this.sourceBuffer = this.mediaSource?.addSourceBuffer(this.mimeType)
        this.sourceBuffer.addEventListener('updatestart', this.sbUpdateStart)
        this.sourceBuffer.addEventListener('updateend', this.sbUpdateEnd)
        this.sourceBuffer.addEventListener('error', this.sbUpdateError)
    }

    private sbUpdateStart() {
        console.log('[recorder]: source buffer updatestart')
    }

    private sbUpdateEnd() {
        console.log('[recorder]: source buffer updateend')
    }

    private sbUpdateError() {
        console.log('[recorder]: source buffer error')
    }

    private mediaSourceOpen() {
        if (!this.mediaSource || !this.mimeType) return
        console.log('[recorder]: Media source opened')
        this.createSourceBuffer()
        if (this.media) {
            this.media.src = URL.createObjectURL(this.mediaSource)
        }
    }

    private mediaSourceEnded() {
        console.log('[recorder]: Media source ended')
    }

    private mediaSourceClose() {
        console.log('[recorder]: Media source close')
    }
}
