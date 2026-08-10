"use client"

import * as React from "react"
import { Camera, CameraOff, X } from "lucide-react"

import { looksLikeIsbn, normalizeIsbn, parseIsbn } from "@/lib/isbn"
import { Button } from "@/components/ui/button"

/** Chrome/Android ships this natively; Safari does not, hence the zxing fallback. */
type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike
      getSupportedFormats?: () => Promise<string[]>
    }
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"]

type Status = "idle" | "starting" | "scanning" | "error"

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (isbn: string) => void
  onClose: () => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const stoppedRef = React.useRef(false)
  const [status, setStatus] = React.useState<Status>("idle")
  const [message, setMessage] = React.useState<string | null>(null)

  const stop = React.useCallback(() => {
    stoppedRef.current = true
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  React.useEffect(() => {
    stoppedRef.current = false
    let cleanupScanner: (() => void) | undefined

    async function start() {
      setStatus("starting")

      if (!window.isSecureContext) {
        setStatus("error")
        setMessage(
          "The camera needs a secure connection. Open Librero over HTTPS (or on localhost) to scan."
        )
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error")
        setMessage("This browser cannot access the camera. Type the ISBN instead.")
        return
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        })
      } catch {
        setStatus("error")
        setMessage("Camera access was blocked. Allow it in your browser, or type the ISBN.")
        return
      }

      if (stoppedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => {})
      setStatus("scanning")

      cleanupScanner = window.BarcodeDetector
        ? runNativeDetector(video)
        : await runZxingDetector(video)
    }

    /** Handle a decode: only accept checksum-valid ISBNs. */
    function handle(rawValue: string): boolean {
      const normalized = normalizeIsbn(rawValue)
      if (!looksLikeIsbn(normalized) || !parseIsbn(normalized)) return false
      stop()
      onDetected(normalized)
      return true
    }

    function runNativeDetector(video: HTMLVideoElement) {
      const detector = new window.BarcodeDetector!({ formats: FORMATS })
      let frame = 0

      const tick = async () => {
        if (stoppedRef.current) return
        try {
          const codes = await detector.detect(video)
          for (const code of codes) {
            if (handle(code.rawValue)) return
          }
        } catch {
          // A frame that cannot be decoded is the normal case, not an error.
        }
        frame = requestAnimationFrame(tick)
      }

      frame = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(frame)
    }

    async function runZxingDetector(video: HTMLVideoElement) {
      // Loaded lazily so Chrome users never download it.
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()

      const controls = await reader.decodeFromVideoElement(video, (result) => {
        if (result) handle(result.getText())
      })

      return () => controls.stop()
    }

    void start()

    return () => {
      cleanupScanner?.()
      stop()
    }
  }, [onDetected, stop])

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted relative aspect-4/3 w-full overflow-hidden rounded-lg border">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          aria-label="Camera preview"
        />

        {status === "scanning" ? (
          // Framing guide: line the barcode up inside the box.
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-4/5 rounded-md border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        ) : null}

        {status !== "scanning" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            {status === "error" ? (
              <CameraOff className="text-muted-foreground size-8" />
            ) : (
              <Camera className="text-muted-foreground size-8 animate-pulse" />
            )}
            <p className="text-muted-foreground text-sm">
              {message ?? "Starting the camera…"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {status === "scanning" ? "Point at the barcode on the back cover." : null}
        </p>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X />
          Close camera
        </Button>
      </div>
    </div>
  )
}
