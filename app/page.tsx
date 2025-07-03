"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Volume2, VolumeX, Search, ImageIcon, HelpCircle } from "lucide-react"

// Add speech recognition types
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

interface TranscriptEntry {
  id: string
  text: string
  timestamp: number
  speaker?: string
}

interface OpportunityCard {
  id: string
  type: "question" | "memory" | "generative"
  trigger: string
  content: string
  explanation: string
  timestamp: number
}

export default function GaiaEmbryo() {
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [opportunityCards, setOpportunityCards] = useState<OpportunityCard[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Replace the simulateTranscription function with real speech recognition
  const startSpeechRecognition = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser. Please use Chrome or Edge.")
      return null
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        const newEntry: TranscriptEntry = {
          id: `transcript-${Date.now()}-${Math.random()}`,
          text: finalTranscript.trim(),
          timestamp: Date.now(),
          speaker: "You",
        }
        setTranscript((prev) => [...prev, newEntry])
      }
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow microphone access and try again.")
      }
    }

    recognition.onend = () => {
      if (isListening) {
        // Restart recognition if we're still supposed to be listening
        recognition.start()
      }
    }

    return recognition
  }

  // Update the startListening function
  const startListening = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Start speech recognition
      const recognition = startSpeechRecognition()
      if (!recognition) return

      recognition.start()

      // Store recognition instance for cleanup
      mediaRecorderRef.current = recognition as any
      setIsListening(true)

      // Clean up the stream since we're using speech recognition instead
      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      console.error("Error accessing microphone:", error)
      alert("Please allow microphone access to use this feature")
    }
  }

  // Update the stopListening function
  const stopListening = () => {
    if (mediaRecorderRef.current) {
      if (typeof mediaRecorderRef.current.stop === "function") {
        mediaRecorderRef.current.stop()
      }
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      }
    }
    setIsListening(false)
    audioChunksRef.current = []
  }

  // Process transcript for opportunities
  useEffect(() => {
    if (transcript.length === 0) return

    const processOpportunities = async () => {
      setIsProcessing(true)
      const recentTranscript = transcript
        .slice(-3)
        .map((t) => t.text)
        .join(" ")

      try {
        const response = await fetch("/api/analyze-opportunities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: recentTranscript }),
        })

        const data = await response.json()
        if (data.opportunities) {
          setOpportunityCards((prev) => [...prev, ...data.opportunities])
        }
      } catch (error) {
        console.error("Error processing opportunities:", error)
      } finally {
        setIsProcessing(false)
      }
    }

    const debounceTimer = setTimeout(processOpportunities, 2000)
    return () => clearTimeout(debounceTimer)
  }, [transcript])

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const dismissCard = (cardId: string) => {
    setOpportunityCards((prev) => prev.filter((card) => card.id !== cardId))
  }

  const getCardIcon = (type: string) => {
    switch (type) {
      case "question":
        return <HelpCircle className="w-4 h-4" />
      case "memory":
        return <Search className="w-4 h-4" />
      case "generative":
        return <ImageIcon className="w-4 h-4" />
      default:
        return <HelpCircle className="w-4 h-4" />
    }
  }

  const getCardColor = (type: string) => {
    switch (type) {
      case "question":
        return "bg-blue-50 border-blue-200"
      case "memory":
        return "bg-green-50 border-green-200"
      case "generative":
        return "bg-purple-50 border-purple-200"
      default:
        return "bg-gray-50 border-gray-200"
    }
  }

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Gaia Embryo</h1>
          <p className="text-slate-600">Ambient Conversational Assistant</p>
        </div>

        {/* Control Panel */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={isListening ? stopListening : startListening}
                  variant={isListening ? "destructive" : "default"}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  {isListening ? "Stop Listening" : "Start Listening"}
                </Button>

                <Button
                  onClick={toggleMute}
                  variant="outline"
                  size="lg"
                  disabled={!isListening}
                  className="flex items-center gap-2"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  {isMuted ? "Unmute" : "Mute"}
                </Button>
              </div>

              <div className="flex items-center gap-4">
                {isListening && (
                  <Badge variant="secondary" className="animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                    Listening
                  </Badge>
                )}
                {isProcessing && <Badge variant="outline">Processing...</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript Panel */}
          <div className="lg:col-span-2">
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Live Transcript</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div ref={transcriptRef} className="h-[520px] overflow-y-auto p-4 space-y-4">
                  {transcript.length === 0 ? (
                    <div className="text-center text-slate-500 mt-20">
                      <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Start listening to see the conversation transcript</p>
                      <p className="text-sm mt-2">Transcript appears with a 3-second delay to prevent echo effects</p>
                    </div>
                  ) : (
                    transcript.map((entry) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {entry.speaker || "Speaker"}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-800">{entry.text}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Opportunity Cards Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assistant Cards</CardTitle>
                <p className="text-sm text-slate-600">Contextual assistance based on your conversation</p>
              </CardHeader>
            </Card>

            <div className="space-y-4 max-h-[520px] overflow-y-auto">
              {opportunityCards.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <div className="text-slate-400 mb-2">
                      <Search className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">No opportunities detected yet</p>
                      <p className="text-xs mt-1">Cards will appear here when the AI identifies ways to help</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                opportunityCards.map((card) => (
                  <Card
                    key={card.id}
                    className={`${getCardColor(card.type)} transition-all duration-300 hover:shadow-md`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCardIcon(card.type)}
                          <Badge variant="secondary" className="text-xs capitalize">
                            {card.type}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => dismissCard(card.id)} className="h-6 w-6 p-0">
                          ×
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-800">{card.content}</p>
                        <p className="text-xs text-slate-600 italic">{card.explanation}</p>
                        <p className="text-xs text-slate-500">{new Date(card.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            {isListening
              ? `Active • ${transcript.length} utterances • ${opportunityCards.length} opportunities detected`
              : 'Ready to listen • Click "Start Listening" to begin'}
          </p>
        </div>
      </div>
    </div>
  )
}
