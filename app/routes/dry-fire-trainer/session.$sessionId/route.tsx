import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { MetaFunction } from 'react-router'
import { useDryFireTrackerContext } from '../context.client'
import type { Session, Shot } from '../data.client'
import { ShotResultsChart } from '../shot-results-chart'

export const meta: MetaFunction = () => [
	{ title: 'Drill Session - Dry-Fire Trainer' },
]

type RepState =
	| 'ready'
	| 'waiting-to-start'
	| 'listening'
	| 'waiting-for-result'
	| 'complete'

class AudioSystem {
	private audioContext: AudioContext | null = null

	async initialize() {
		if (!this.audioContext) {
			console.log('creating audio context')
			this.audioContext = new AudioContext()
		}
		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume()
		}
	}

	playBeep(frequency: number, duration: number) {
		if (!this.audioContext) return

		const oscillator = this.audioContext.createOscillator()
		const gainNode = this.audioContext.createGain()

		oscillator.connect(gainNode)
		gainNode.connect(this.audioContext.destination)

		oscillator.frequency.value = frequency
		oscillator.type = 'sine'

		gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
		gainNode.gain.exponentialRampToValueAtTime(
			0.01,
			this.audioContext.currentTime + duration,
		)

		oscillator.start(this.audioContext.currentTime)
		oscillator.stop(this.audioContext.currentTime + duration)
	}

	playStartBeep() {
		this.playBeep(800, 0.1)
	}

	playEndBeep() {
		this.playBeep(400, 0.2)
	}

	cleanup() {
		if (this.audioContext) {
			console.log('cleaning up audio context')
			void this.audioContext.close()
			this.audioContext = null
		}
	}
}

class ShotDetector {
	private audioContext: AudioContext | null = null
	private analyser: AnalyserNode | null = null
	private stream: MediaStream | null = null
	private rafId: number | null = null
	private threshold = 0.7
	private detectionCallback: ((time: number) => void) | null = null
	private startTime: number | null = null
	private detected = false

	async initialize() {
		try {
			console.log('initializing microphone')
			this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			this.audioContext = new AudioContext()
			this.analyser = this.audioContext.createAnalyser()
			this.analyser.fftSize = 2048
			this.analyser.smoothingTimeConstant = 0.3

			const source = this.audioContext.createMediaStreamSource(this.stream)
			source.connect(this.analyser)

			return true
		} catch (error) {
			console.error('Failed to initialize microphone:', error)
			return false
		}
	}

	startListening(callback: (time: number) => void) {
		this.detectionCallback = callback
		this.startTime = Date.now()
		this.detected = false
		this.analyze()
	}

	private analyze = () => {
		if (!this.analyser || !this.detectionCallback || this.detected) return

		const bufferLength = this.analyser.fftSize
		const dataArray = new Uint8Array(bufferLength)
		this.analyser.getByteTimeDomainData(dataArray)

		// Simple peak detection
		let max = 0
		for (let i = 0; i < bufferLength; i++) {
			const value = Math.abs(dataArray[i]! - 128) / 128
			if (value > max) {
				max = value
			}
		}

		if (max > this.threshold && this.startTime) {
			const elapsedTime = (Date.now() - this.startTime) / 1000
			this.detected = true
			this.detectionCallback(elapsedTime)
			this.stopListening()
			return
		}

		this.rafId = requestAnimationFrame(this.analyze)
	}

	stopListening() {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId)
			this.rafId = null
		}
		this.detectionCallback = null
		this.startTime = null
	}

	cleanup() {
		this.stopListening()
		if (this.stream) {
			console.log('releasing microphone')
			this.stream.getTracks().forEach((track) => track.stop())
			this.stream = null
		}
		if (this.audioContext) {
			void this.audioContext.close()
			this.audioContext = null
		}
		this.analyser = null
	}
}

export default function DrillSession() {
	const { sessionId } = useParams()
	const navigate = useNavigate()
	const { helpers } = useDryFireTrackerContext()
	const [session, setSession] = useState<Session | null>(null)
	const [currentRep, setCurrentRep] = useState(0)
	const [repState, setRepState] = useState<RepState>('ready')
	const [detectedTime, setDetectedTime] = useState<number | null>(null)
	const [ignoreTime, setIgnoreTime] = useState(false)
	const [microphoneError, setMicrophoneError] = useState<string | null>(null)
	const [microphoneGranted, setMicrophoneGranted] = useState(false)

	const audioSystemRef = useRef<AudioSystem | null>(null)
	const shotDetectorRef = useRef<ShotDetector | null>(null)
	const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const parTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		if (!sessionId) {
			void navigate('/dry-fire-trainer')
			return
		}

		const foundSession = helpers.getSession(sessionId)
		if (!foundSession) {
			void navigate('/dry-fire-trainer')
			return
		}

		setSession(foundSession)
	}, [sessionId, navigate, helpers])

	useEffect(() => {
		// Initialize audio system
		audioSystemRef.current = new AudioSystem()
		void audioSystemRef.current.initialize()

		// Initialize shot detector
		const initMicrophone = async () => {
			shotDetectorRef.current = new ShotDetector()
			const success = await shotDetectorRef.current.initialize()
			if (success) {
				setMicrophoneGranted(true)
			} else {
				setMicrophoneError(
					'Microphone access denied. You can still complete the drill, but shot times will not be detected automatically.',
				)
			}
		}

		void initMicrophone()

		return () => {
			// Clean up resources and stop media tracks
			shotDetectorRef.current?.cleanup()
			audioSystemRef.current?.cleanup()
		}
	}, [sessionId, navigate, helpers])

	useEffect(() => {
		return () => {
			if (delayTimeoutRef.current) {
				clearTimeout(delayTimeoutRef.current)
			}
			if (parTimeoutRef.current) {
				clearTimeout(parTimeoutRef.current)
			}
		}
	}, [])

	const startRep = useCallback(() => {
		if (!session) return

		setDetectedTime(null)
		setIgnoreTime(false)
		setRepState('waiting-to-start')

		// Random delay between 5-10 seconds before start beep
		const randomDelay = 5000 + Math.random() * 5000

		delayTimeoutRef.current = setTimeout(() => {
			setRepState('listening')

			// Play start beep
			audioSystemRef.current?.playStartBeep()

			// Start listening for shot
			if (microphoneGranted && shotDetectorRef.current) {
				shotDetectorRef.current.startListening((time) => {
					setDetectedTime(time)
				})
			}

			// Schedule end beep
			parTimeoutRef.current = setTimeout(() => {
				audioSystemRef.current?.playEndBeep()
				setRepState('waiting-for-result')

				// Stop listening after 5 more seconds
				setTimeout(() => {
					shotDetectorRef.current?.stopListening()
				}, 5000)
			}, session.parTime * 1000)
		}, randomDelay)
	}, [session, microphoneGranted])

	const handleResult = useCallback(
		(hit: boolean) => {
			if (!session || repState !== 'waiting-for-result') return

			// Record the result
			const updatedShots: Shot[] = [...session.shots]
			updatedShots[currentRep] = {
				time: detectedTime,
				hit,
				ignored: ignoreTime,
			}

			const updatedSession = {
				...session,
				shots: updatedShots,
			}

			helpers.updateSession(session.id, updatedSession)
			setSession(updatedSession)

			if (currentRep + 1 >= session.shots.length) {
				// Complete the session
				helpers.completeSession(session.id)
				setRepState('complete')
			} else {
				// Move to next rep and start automatically
				setCurrentRep(currentRep + 1)
				startRep()
			}
		},
		[
			session,
			repState,
			currentRep,
			detectedTime,
			ignoreTime,
			helpers,
			startRep,
		],
	)

	const handleFinish = () => {
		void navigate('/dry-fire-trainer/history')
	}

	if (!session) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-app-muted">Loading session...</p>
			</div>
		)
	}

	if (repState === 'complete') {
		const hitCount = session.shots.filter(
			(shot) => shot.hit === true && !shot.ignored,
		).length
		const totalCount = session.shots.filter((shot) => !shot.ignored).length

		return (
			<div className="space-y-6">
				<section className="space-y-4 text-center">
					<h2 className="text-2xl font-semibold">Drill Complete!</h2>
					<div className="border-app-border bg-app-surface/80 inline-block rounded-2xl border px-8 py-6">
						<p className="text-app-muted text-sm tracking-wider uppercase">
							Hit Rate
						</p>
						<p className="text-primary mt-2 text-5xl font-bold">
							{totalCount > 0 ? Math.round((hitCount / totalCount) * 100) : 0}%
						</p>
						<p className="text-app-muted mt-2 text-sm">
							{hitCount} / {totalCount} hit
						</p>
					</div>
				</section>

				<section className="border-app-border bg-app-surface/80 space-y-4 rounded-2xl border p-6">
					<h3 className="text-sm font-semibold tracking-wider uppercase">
						Shot Results
					</h3>
					<ShotResultsChart session={session} />
				</section>

				<div className="flex justify-center">
					<button
						type="button"
						onClick={handleFinish}
						className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-3 font-semibold transition"
					>
						View History
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<section className="space-y-4 text-center">
				<div className="space-y-2">
					<h2 className="text-2xl font-semibold">{session.drillName}</h2>
					<p className="text-app-muted text-sm">Par time: {session.parTime}s</p>
				</div>

				<div className="border-app-border bg-app-surface/80 inline-block rounded-2xl border px-8 py-4">
					<p className="text-app-muted text-sm">Rep</p>
					<p className="text-primary text-4xl font-bold">
						{currentRep + 1} / {session.shots.length}
					</p>
				</div>

				{microphoneError && (
					<div className="mx-auto max-w-md rounded-xl border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
						{microphoneError}
					</div>
				)}
			</section>

			{repState === 'ready' && (
				<div className="flex justify-center">
					<button
						type="button"
						onClick={startRep}
						className="bg-primary text-primary-foreground hover:bg-primary/90 h-32 w-32 rounded-full text-lg font-semibold transition hover:scale-105 active:scale-95"
					>
						Start
					</button>
				</div>
			)}

			{repState === 'waiting-to-start' && (
				<div className="space-y-6 text-center">
					<div className="border-app-border/50 mx-auto inline-flex h-32 w-32 items-center justify-center rounded-full border-4">
						<div className="bg-app-muted/30 h-24 w-24 animate-pulse rounded-full" />
					</div>
					<p className="text-app-muted text-sm">
						Get ready... (beep in 5-10 seconds)
					</p>
				</div>
			)}

			{repState === 'listening' && (
				<div className="space-y-6 text-center">
					<div className="border-primary/40 bg-primary/10 mx-auto inline-flex h-32 w-32 items-center justify-center rounded-full border-4">
						<div className="bg-primary h-24 w-24 animate-pulse rounded-full" />
					</div>
					<p className="text-app-muted text-sm">Listening for shot...</p>
					{detectedTime !== null && (
						<p className="text-primary text-lg font-semibold">
							Shot detected: {detectedTime.toFixed(2)}s
						</p>
					)}
				</div>
			)}

			{repState === 'waiting-for-result' && (
				<div className="space-y-6">
					{detectedTime !== null ? (
						<div className="text-center">
							<p className="text-app-muted text-sm">Shot time</p>
							<p className="text-primary text-4xl font-bold">
								{detectedTime.toFixed(2)}s
							</p>
						</div>
					) : (
						<div className="text-center">
							<p className="text-app-muted text-sm">No time recorded</p>
						</div>
					)}

					<div className="space-y-4">
						<div className="flex justify-center gap-4">
							<button
								type="button"
								onClick={() => handleResult(true)}
								className="max-w-xs flex-1 rounded-lg bg-green-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-green-600"
							>
								Hit
							</button>
							<button
								type="button"
								onClick={() => handleResult(false)}
								className="max-w-xs flex-1 rounded-lg bg-red-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-red-600"
							>
								Miss
							</button>
						</div>

						<div className="flex justify-center">
							<label className="text-app-muted flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={ignoreTime}
									onChange={(e) => setIgnoreTime(e.target.checked)}
									className="accent-primary h-4 w-4"
								/>
								Ignore time
							</label>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
