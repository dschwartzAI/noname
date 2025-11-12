"use client"

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  Settings 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  videoUrl: string
  videoProvider?: 'youtube' | 'vimeo' | 'wistia' | 'cloudflare' | 'custom'
  initialPosition?: number // seconds
  onProgress?: (position: number, percentage: number) => void
  onComplete?: () => void
  className?: string
}

export function VideoPlayer({ 
  videoUrl, 
  videoProvider = 'custom',
  initialPosition = 0,
  onProgress,
  onComplete,
  className 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(initialPosition)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const progressIntervalRef = useRef<NodeJS.Timeout>()

  // For YouTube/Vimeo/Wistia embeds
  if (videoProvider === 'youtube' || videoProvider === 'vimeo' || videoProvider === 'wistia') {
    const getEmbedUrl = () => {
      if (videoProvider === 'youtube') {
        // Extract YouTube video ID from various URL formats
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
        const match = videoUrl.match(youtubeRegex)
        const videoId = match ? match[1] : videoUrl
        return `https://www.youtube.com/embed/${videoId}?start=${initialPosition}&rel=0&modestbranding=1`
      } else if (videoProvider === 'vimeo') {
        // Extract Vimeo video ID
        const vimeoRegex = /(?:vimeo\.com\/)(?:channels\/|groups\/|album\/\d+\/video\/|)(\d+)(?:$|\/|\?)/
        const match = videoUrl.match(vimeoRegex)
        const videoId = match ? match[1] : videoUrl.split('/').pop()?.split('?')[0]
        return `https://player.vimeo.com/video/${videoId}#t=${initialPosition}s`
      } else {
        // Wistia
        const wistiaRegex = /(?:wistia\.com\/medias\/)([a-zA-Z0-9]+)/
        const match = videoUrl.match(wistiaRegex)
        const videoId = match ? match[1] : videoUrl
        return `https://fast.wistia.net/embed/iframe/${videoId}?time=${initialPosition}`
      }
    }

    return (
      <div className={cn("relative aspect-video bg-black rounded-lg overflow-hidden", className)}>
        <iframe
          src={getEmbedUrl()}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          frameBorder="0"
        />
      </div>
    )
  }

  // Custom HTML5 player
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Set initial position
    if (initialPosition > 0) {
      video.currentTime = initialPosition
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      if (onComplete) {
        onComplete()
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [videoUrl, initialPosition, onComplete])

  // Progress tracking
  useEffect(() => {
    if (isPlaying && onProgress) {
      progressIntervalRef.current = setInterval(() => {
        if (videoRef.current) {
          const position = videoRef.current.currentTime
          const percentage = (position / duration) * 100
          onProgress(position, percentage)
        }
      }, 5000) // Save progress every 5 seconds
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [isPlaying, duration, onProgress])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleVolumeChange = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.volume = value[0]
      setVolume(value[0])
      setIsMuted(value[0] === 0)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds))
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative aspect-video bg-black rounded-lg overflow-hidden group", className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full"
        onClick={togglePlay}
      />

      {/* Controls Overlay */}
      <div 
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Play/Pause overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button 
              size="lg" 
              variant="secondary" 
              className="h-20 w-20 rounded-full"
              onClick={togglePlay}
            >
              <Play className="h-10 w-10" />
            </Button>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress bar */}
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />

          {/* Control buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={togglePlay}>
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              
              <Button size="sm" variant="ghost" onClick={() => skip(-10)}>
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button size="sm" variant="ghost" onClick={() => skip(10)}>
                <SkipForward className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-2 ml-2">
                <Button size="sm" variant="ghost" onClick={toggleMute}>
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <Slider
                  value={[volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>

              <span className="text-sm text-white ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost">
                <Settings className="h-5 w-5" />
              </Button>
              
              <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

