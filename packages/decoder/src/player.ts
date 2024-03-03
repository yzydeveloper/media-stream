import { Decoder } from '.'

/**
 * 从 AudioData 中提取 PCM 数据
 */
function extractPCM4AudioData (ad: AudioData): Float32Array[] {
    return Array(ad.numberOfChannels)
        .fill(0)
        .map((_, idx) => {
            const chanBufSize = ad.allocationSize({ planeIndex: idx })
            const chanBuf = new ArrayBuffer(chanBufSize)
            ad.copyTo(chanBuf, { planeIndex: idx })
            return new Float32Array(chanBuf)
        })
}

/**
 * 合并（串联）多个 Float32Array，通常用于合并 PCM 数据
 */
function concatFloat32Array (bufs: Float32Array[]): Float32Array {
    const rs = new Float32Array(
        bufs.map(buf => buf.length).reduce((a, b) => a + b)
    )

    let offset = 0
    for (const buf of bufs) {
        rs.set(buf, offset)
        offset += buf.length
    }

    return rs
}

// 并行执行任务，但按顺序emit结果
function createPromiseQueue<T>(onResult: (data: T) => void) {
    const rsCache: T[] = []
    let waitingIdx = 0

    function updateRs(rs: T, emitIdx: number) {
        rsCache[emitIdx] = rs
        emitRs()
    }

    function emitRs() {
        const rs = rsCache[waitingIdx]
        if (rs == null) return
        onResult(rs)

        waitingIdx += 1
        emitRs()
    }

    let addIdx = 0
    return (task: () => Promise<T>) => {
        const emitIdx = addIdx
        addIdx += 1
        task()
            .then((rs) => updateRs(rs, emitIdx))
            .catch((err) => updateRs(err, emitIdx))
    }
}

/**
 * 从 AudioBuffer 中提取 PCM
 */
export function extractPCM4AudioBuffer(ab: AudioBuffer): Float32Array[] {
    return Array(ab.numberOfChannels)
        .fill(0)
        .map((_, idx) => ab.getChannelData(idx))
}

/**
 * 音频 PCM 重采样
 * @param pcmData PCM
 * @param curRate 当前采样率
 * @param target { rate: 目标采样率, chanCount: 目标声道数 }
 * @returns PCM
 */
export async function audioResample(
    pcmData: Float32Array[],
    curRate: number,
    target: {
      rate: number;
      chanCount: number;
    },
): Promise<Float32Array[]> {
    const chanCnt = pcmData.length
    const emptyPCM = Array(target.chanCount)
        .fill(0)
        .map(() => new Float32Array(0))
    if (chanCnt === 0) return emptyPCM

    const len = Math.max(...pcmData.map((c) => c.length))
    if (len === 0) return emptyPCM

    // The Worker scope does not have access to OfflineAudioContext
    if (globalThis.OfflineAudioContext == null) {
        return pcmData.map(
            (p) =>
                new Float32Array(
                    resample(p, curRate, target.rate, { method: 'sinc', LPF: false }),
                ),
        )
    }

    const ctx = new globalThis.OfflineAudioContext(
        target.chanCount,
        (len * target.rate) / curRate,
        target.rate,
    )
    const abSource = ctx.createBufferSource()
    const ab = ctx.createBuffer(chanCnt, len, curRate)
    pcmData.forEach((d, idx) => ab.copyToChannel(d, idx))

    abSource.buffer = ab
    abSource.connect(ctx.destination)
    abSource.start()

    return extractPCM4AudioBuffer(await ctx.startRendering())
}

interface PlayerOptions {
    url: string
}

export class Player {
    options: PlayerOptions

    private decoder!: Decoder

    private videoFrames: VideoFrame[] = []

    private audioChan0 = new Float32Array(0)

    private audioChan1 = new Float32Array(0)

    constructor(options: PlayerOptions) {
        this.options = options
        this.decoder = new Decoder({
            onVideoOutput: (data) => {
                // 需要等上一个frame close之后才可以执行回调
                this.videoFrames.push(data)
            },
            onAudioOutput: (data) => {
                const audioTrack = this.decoder.audioTracks?.[0]
                if(!audioTrack) return

                const resampleQ = createPromiseQueue<Float32Array[]>((resampedPCM) => {
                    if (resampedPCM instanceof Error) throw resampedPCM

                    this.audioChan0 = concatFloat32Array([this.audioChan0, resampedPCM[0]])
                    this.audioChan1 = concatFloat32Array([
                        this.audioChan1,
                        resampedPCM[1] ?? resampedPCM[0],
                    ])
                })

                const pcmArr = extractPCM4AudioData(data)

                if (data.sampleRate !== audioTrack.audio.sample_rate) {
                    resampleQ(() =>
                        audioResample(pcmArr, data.sampleRate, {
                            rate: audioTrack.audio.sample_rate,
                            chanCount: audioTrack.audio.channel_count,
                        }))
                } else {
                    this.audioChan0 = concatFloat32Array([this.audioChan0, pcmArr[0]])
                    this.audioChan1 = concatFloat32Array([
                        this.audioChan1,
                        pcmArr[1] ?? pcmArr[0],
                    ])
                }

                data.close()
            }
        })
        this.decoder.load(this.options.url)
    }

    render() { }
}
