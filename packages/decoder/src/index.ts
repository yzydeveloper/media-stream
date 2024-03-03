import { type MP4Info } from 'mp4box'
import { Demuxer, type SampleStreamChunk } from './demuxer'

export * from './player'
export interface DecoderOptions {
    onVideoOutput: VideoFrameOutputCallback
    onAudioOutput: AudioDataOutputCallback
}

export class Decoder {
    private demuxer!: Demuxer

    private mp4Info: MP4Info | null = null

    private videoDecoder: VideoDecoder | null = null

    private audioDecoder: AudioDecoder | null = null

    private onVideoOutput: DecoderOptions['onVideoOutput'] = () => {}

    private onAudioOutput: DecoderOptions['onAudioOutput'] = () => {}

    get videoTracks() {
        return this.mp4Info?.videoTracks
    }

    get audioTracks() {
        return this.mp4Info?.audioTracks
    }

    constructor(options: DecoderOptions) {
        this.setOptions(options)
    }

    private setOptions(options: DecoderOptions) {
        this.onVideoOutput = options.onVideoOutput
        this.onAudioOutput = options.onAudioOutput
        this.demuxer = new Demuxer({
            onChunk: this.onChunk.bind(this)
        })
    }

    async load(url: string) {
        await this.demuxer.load(url)
    }

    private async onChunk(chunk: SampleStreamChunk) {
        const { type, data } = chunk

        if(type === 'ready') {
            this.mp4Info = data.info
            this.createVideoDecoder()
            this.createAudioDecoder()
        }

        if(type === 'samples') {
            // eslint-disable-next-line no-await-in-loop
            await Promise.all([
                this.videoDecoder?.flush(),
                this.audioDecoder?.flush()
            ])

            const { type: sampleType, samples } = data
            for (let i = 0; i < samples.length; i += 1) {
                const s = samples[i]
                if(sampleType === 'video' && this.videoDecoder?.state === 'configured') {
                    // 兼容某些视频首帧 有偏移
                    if(s.is_sync && s.cts !== 0) {
                        s.cts = 0
                    }
                    this.videoDecoder?.decode(new EncodedVideoChunk({
                        type: s.is_sync ? 'key' : 'delta',
                        timestamp: (s.cts * 1000000) / s.timescale,
                        duration: (s.duration * 1000000) / s.timescale,
                        data: s.data,
                    }))
                }
                if(sampleType === 'audio' && this.audioDecoder?.state === 'configured') {
                    this.audioDecoder?.decode(new EncodedAudioChunk({
                        type: s.is_sync ? 'key' : 'delta',
                        timestamp: (s.cts * 1000000) / s.timescale,
                        duration: (s.duration * 1000000) / s.timescale,
                        data: s.data,
                    }))
                }
            }
        }
    }

    private createVideoDecoder() {
        const track = this.videoTracks?.[0]
        if(!track) return

        const config: VideoDecoderConfig = {
            codec: track.codec,
            codedHeight: track.video.height,
            codedWidth: track.video.width,
            description: this.demuxer.descriptions?.find(item => item.trackId === track.id)?.description,
            hardwareAcceleration: 'prefer-hardware',
        }

        const decoder = new VideoDecoder({
            output: this.onVideoOutput,
            error: (e) => console.error(e),
        })

        decoder.configure(config)
        this.videoDecoder = decoder
    }

    private createAudioDecoder() {
        const track = this.audioTracks?.[0]
        if(!track) return

        const config: AudioDecoderConfig = {
            codec: track.codec.startsWith('mp4a') ? 'mp4a.40.2' : track.codec,
            sampleRate: track.audio.sample_rate,
            numberOfChannels: track.audio.channel_count
        }

        const decoder = new AudioDecoder({
            output: this.onAudioOutput,
            error: (e) => console.error(e),
        })

        decoder.configure(config)
        this.audioDecoder = decoder
    }
}
