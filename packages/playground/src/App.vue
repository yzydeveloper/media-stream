<template>
    <video
        muted
        controls
        autoplay
        playsinline></video>
</template>
<script lang="ts" setup>
import { Mixer } from '@media-stream/mixer'

const mixer = new Mixer()

navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
}).then((mediaStream => {
    mixer.attachStream(mediaStream, undefined)
    mixer.start()
    const [video] = document.getElementsByTagName('video')
    video.srcObject = mixer.media
}))
</script>
