# Media-Stream
Contains some interesting things about video streams, video files and Media API, Canvas

## Creator

TODO

## Mixer
> Synthesize and crop video streams, which is somewhat similar to the core function of cloud director

### Install

```bash
npm i -D @media-stream/mixer
```
### Usage

For details, see Playground

[Local Mixer Playground](./packages/playground/src/app/mixer/index.html)

[Online Mixer Playground](https://media-stream.vercel.app/mixer)

```typescript
import { Mixer } from '@media-stream/mixer'

const mixer = new Mixer()

mixer.attachStream(stream)
mixer.detachStream(stream)
mixer.start()
mixer.destroy()
```

## Recorder

> Record fragmentation with MediaRecorder and attach to MediaSource

### Install

```bash
npm i -D @media-stream/recorder
```

### Usage

[Local Recorder Playground](./packages/playground/src/app/mixer/index.html)

[Online Recorder Playground](https://media-stream.vercel.app/recorder)

```typescript
import { Recorder } from '@media-stream/recorder'

const recorder = new Recorder()

recorder.attachMedia(recordVideo)
recorder.start()
recorder.pause()
recorder.resume()
recorder.destroy()
```
