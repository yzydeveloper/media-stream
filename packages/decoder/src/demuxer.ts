import MP4Box, { type MP4Info, type MP4File, type MP4ArrayBuffer, MP4Sample } from 'mp4box'

// @ref: ttps://github.com/gpac/mp4box.js/issues/243
// @ref: ttps://github.com/gpac/mp4box.js/issues/243#issuecomment-921166223
function createAVCDescription(trackIdx: number, file: MP4File): Uint8Array | undefined {
    let avccBox
    try {
        avccBox = (file as any).moov.traks[trackIdx].mdia.minf.stbl.stsd.entries[0].avcC
    } catch (e) {
        return undefined
    }

    if (!avccBox) {
        return undefined
    }

    let i
    let size = 7
    for (i = 0; i < avccBox.SPS.length; i++) {
        size += 2 + avccBox.SPS[i].length
    }
    for (i = 0; i < avccBox.PPS.length; i++) {
        size += 2 + avccBox.PPS[i].length
    }

    let id = 0
    const data = new Uint8Array(size)

    const writeUint8 = (value: any): any => {
        data.set([value], id)
        // eslint-disable-next-line no-plusplus
        id++
    }
    const writeUint16 = (value: any): any => {
        const arr = new Uint8Array(1)
        arr[0] = value
        const buffer = new Uint8Array(arr.buffer)
        data.set([buffer[1], buffer[0]], id)
        id += 2
    }
    const writeUint8Array = (value: any): any => {
        data.set(value, id)
        id += value.length
    }

    writeUint8(avccBox.configurationVersion)
    writeUint8(avccBox.AVCProfileIndication)
    writeUint8(avccBox.profile_compatibility)
    writeUint8(avccBox.AVCLevelIndication)
    writeUint8(avccBox.lengthSizeMinusOne + (63 << 2))
    writeUint8(avccBox.nb_SPS_nalus + (7 << 5))

    for (i = 0; i < avccBox.SPS.length; i++) {
        writeUint16(avccBox.SPS[i].length)
        writeUint8Array(avccBox.SPS[i].nalu)
    }

    writeUint8(avccBox.nb_PPS_nalus)
    for (i = 0; i < avccBox.PPS.length; i++) {
        writeUint16(avccBox.PPS[i].length)
        writeUint8Array(avccBox.PPS[i].nalu)
    }

    if (id !== size) {
        console.debug('Size mismatched', 'MP4BoxMediaDemuxer')
        return undefined
    }

    return data
}

export type SampleStreamChunk = {
    type: 'ready'
    data: { info: MP4Info; file: MP4File }
} | {
    type: 'samples'
    data: { id: number; type: 'video' | 'audio'; samples: MP4Sample[] }
};

export interface DemuxerOptions {
    onChunk?: (chunk: SampleStreamChunk) => void
    onDone?: () => void
}

/**
 * 将原始字节流转换成 MP4Sample 流
 */
class SampleStream {
    readable: ReadableStream<SampleStreamChunk>

    writable: WritableStream<Uint8Array>

    #inputBufOffset = 0

    constructor() {
        const file = MP4Box.createFile()
        let outCtrlDesiredSize = 0
        let streamCancelled = false
        this.readable = new ReadableStream(
            {
                start: ctrl => {
                    file.onReady = info => {
                        const vTrackId = info.videoTracks[0]?.id
                        if (vTrackId != null) { file.setExtractionOptions(vTrackId, 'video', { nbSamples: 100 }) }

                        const aTrackId = info.audioTracks[0]?.id
                        if (aTrackId != null) { file.setExtractionOptions(aTrackId, 'audio', { nbSamples: 100 }) }

                        ctrl.enqueue({ type: 'ready', data: { info, file } })
                        file.start()
                    }

                    file.onSamples = (id, type, samples) => {
                        ctrl.enqueue({
                            type: 'samples',
                            data: { id, type, samples }
                        })
                        outCtrlDesiredSize = ctrl.desiredSize ?? 0
                    }

                    file.onFlush = () => {
                        ctrl.close()
                    }
                },
                pull: ctrl => {
                    outCtrlDesiredSize = ctrl.desiredSize ?? 0
                },
                cancel: () => {
                    file.stop()
                    streamCancelled = true
                }
            },
            {
                highWaterMark: 50
            }
        )

        this.writable = new WritableStream({
            write: async ui8Arr => {
                if (streamCancelled) {
                    this.writable.abort()
                    return
                }

                const inputBuf = ui8Arr.buffer as MP4ArrayBuffer
                inputBuf.fileStart = this.#inputBufOffset
                this.#inputBufOffset += inputBuf.byteLength
                file.appendBuffer(inputBuf)

                // while (outCtrlDesiredSize < 0) await sleep(50)
            },
            close: () => {
                file.flush()
                file.stop()
                file.onFlush?.()
            }
        })
    }
}

export class Demuxer {
    #options: DemuxerOptions | null = null

    #file!: MP4File

    #info: MP4Info | null = null

    #stream: ReadableStream<SampleStreamChunk> | null | undefined = null

    #reader: ReadableStreamDefaultReader<SampleStreamChunk> | null | undefined = null

    get descriptions() {
        return this.#info?.tracks.map((track, index) => ({
            trackId: track.id,
            description: createAVCDescription(index, this.#file)
        }))
    }

    constructor(options?: DemuxerOptions) {
        this.#options = options ?? null
    }

    async load(url: string) {
        const response = await fetch(url)
        this.#stream = response.body?.pipeThrough(new SampleStream())
        this.#reader = this.#stream?.getReader()

        let stoped = false
        const onFileRead = async () => {
            while(!stoped) {
                // eslint-disable-next-line no-await-in-loop
                const { value, done } = await this.#reader!.read()
                if(done) {
                    this.#options?.onDone?.()
                    stoped = true
                }

                if(value?.type === 'ready') {
                    this.#file = value.data.file
                    this.#info = value.data.info
                }

                if(value && this.#options?.onChunk) {
                    this.#options.onChunk(value)
                }
            }
        }
        onFileRead()
    }
}
