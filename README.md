# Media-Stream
Contains some interesting things about video streams, video files and Media API, Canvas

## Mixer
> Synthesize and crop video streams, which is somewhat similar to the core function of cloud director

### Install

```bash
npm i -D @media-stream/mixer
```
### Usage

[Mixer Playground](./packages/playground/src/app/mixer/index.html)

```typescript
import { Mixer } from '@media-stream/mixer'

const mixer = new Mixer()

mixer.attachStream(stream)
mixer.detachStream(stream)
mixer.start()
mixer.stop()
```





## Recorder
