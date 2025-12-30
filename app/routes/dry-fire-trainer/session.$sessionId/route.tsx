import { useCallback, useEffect, useRef, useState } from 'react'
import type { MetaFunction } from 'react-router'
import { useFetcher, useNavigate } from 'react-router'
import type { Session, Shot } from '../data.server'
import { getDryFireData, upsertSession } from '../data.server'
import { ShotResultsChart } from '../shot-results-chart'
import type { Route } from './+types/route'
import { getDb } from '~/db/client.server'

export const meta: MetaFunction = () => [
	{ title: 'Drill Session - Dry-Fire Trainer' },
]

export const loader = async ({ params, context }: Route.LoaderArgs) => {
	const db = getDb(context.cloudflare.env);
	const data = await getDryFireData(db);
	const session = data.sessions.find(s => s.id === params.sessionId);
	if (!session) {
		throw new Response('Session not found', { status: 404 });
	}
	return { session, dryFireData: data };
}

export const action = async ({ request, context }: Route.ActionArgs) => {
	const db = getDb(context.cloudflare.env);
	const formData = await request.formData();
	const intent = formData.get('intent');

	if (intent === 'update-session') {
		const session = JSON.parse(formData.get('session') as string) as Session;
		await upsertSession(db, session);
		return { success: true };
	}

	return { success: false };
}

type RepState = 'ready' | 'waiting-to-start' | 'waiting-for-result' | 'complete'

class AudioSystem {
	private audioContext: AudioContext | null = null
	private gunshotBuffers: AudioBuffer[] = []
	private maxBuffers = 10

	async initialize() {
		if (!this.audioContext) {
			this.audioContext = new AudioContext()
		}
		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume()
		}

		// Pre-load multiple gunshot audio buffers for overlapping playback
		await this.loadGunshotBuffers()
	}

	private async loadGunshotBuffers() {
		if (!this.audioContext) return

		try {
			const response = await fetch('/gunshot.mp3')
			const arrayBuffer = await response.arrayBuffer()
			const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

			// Create multiple copies of the buffer for overlapping playback
			for (let i = 0; i < this.maxBuffers; i++) {
				this.gunshotBuffers.push(audioBuffer)
			}
		} catch (error) {
			console.warn('Failed to load gunshot audio:', error)
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

	playGunshot() {
		if (!this.audioContext || this.gunshotBuffers.length === 0) return

		// Get a random buffer
		const buffer =
			this.gunshotBuffers[
				Math.floor(Math.random() * this.gunshotBuffers.length)
			]

		// Create a new audio source for this playback
		const source = this.audioContext.createBufferSource()
		const gainNode = this.audioContext.createGain()

		// Configure the audio
		source.buffer = buffer
		gainNode.gain.value = 0.7 // 70% volume

		// Connect the audio graph
		source.connect(gainNode)
		gainNode.connect(this.audioContext.destination)

		// Play the sound
		source.start()

		// Clean up when finished
		source.onended = () => {
			source.disconnect()
			gainNode.disconnect()
		}
	}

	cleanup() {
		if (this.audioContext) {
			void this.audioContext.close()
			this.audioContext = null
		}
		this.gunshotBuffers = []
	}
}

export default function DrillSession({ loaderData: { session: loaderSession, dryFireData: data } }: Route.ComponentProps) {
	const navigate = useNavigate()
	const fetcher = useFetcher<typeof action>()
	
	const [session, setSession] = useState<Session>(loaderSession)
	const [currentRep, setCurrentRep] = useState(0)
	const [repState, setRepState] = useState<RepState>('ready')

	const audioSystemRef = useRef<AudioSystem | null>(null)
	const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const parTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const chaosTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

	useEffect(() => {
		setSession(loaderSession)
	}, [loaderSession])

	useEffect(() => {
		// Initialize audio system
		audioSystemRef.current = new AudioSystem()
		void audioSystemRef.current.initialize()

		return () => {
			audioSystemRef.current?.cleanup()
		}
	}, [])

	const startChaosMode = useCallback(() => {
		if (!data.chaosMode || !session) return

		// Clear any existing chaos timeouts
		chaosTimeoutsRef.current.forEach(clearTimeout)
		chaosTimeoutsRef.current = []

		// Schedule random gunshots between 0.5s after start and 0.5s before end
		const startTime = 500 // 0.5 seconds after start beep
		const endTime = session.parTime * 1000 - 500 // 0.5 seconds before end beep
		const duration = endTime - startTime

		if (duration <= 0) return

		// Schedule 6 random gunshots during the listening period
		const numShots = 6

		for (let i = 0; i < numShots; i++) {
			const randomDelay = startTime + Math.random() * duration
			const timeout = setTimeout(() => {
				audioSystemRef.current?.playGunshot()
			}, randomDelay)
			chaosTimeoutsRef.current.push(timeout)
		}
	}, [data.chaosMode, session])

	const stopChaosMode = useCallback(() => {
		chaosTimeoutsRef.current.forEach(clearTimeout)
		chaosTimeoutsRef.current = []
	}, [])

	useEffect(() => {
		return () => {
			if (delayTimeoutRef.current) {
				clearTimeout(delayTimeoutRef.current)
			}
			if (parTimeoutRef.current) {
				clearTimeout(parTimeoutRef.current)
			}
			stopChaosMode()
		}
	}, [stopChaosMode])

	const startRep = useCallback(() => {
		if (!session) return

		setRepState('waiting-to-start')

		// Random delay between 5-10 seconds before start beep
		const randomDelay = 5000 + Math.random() * 5000

		delayTimeoutRef.current = setTimeout(() => {
			// Play start beep
			audioSystemRef.current?.playStartBeep()

			// Start chaos mode if enabled
			startChaosMode()

			// Schedule end beep and transition to waiting-for-result
			parTimeoutRef.current = setTimeout(() => {
				// Stop chaos mode before end beep
				stopChaosMode()
				audioSystemRef.current?.playEndBeep()
				setRepState('waiting-for-result')
			}, session.parTime * 1000)
		}, randomDelay)
	}, [session, startChaosMode, stopChaosMode])

	const handleResult = useCallback(
		(result: 'hit' | 'slow' | 'miss') => {
			if (!session || repState !== 'waiting-for-result') return

			// Record the result
			const updatedShots: Shot[] = [...session.shots]
			updatedShots[currentRep] = {
				result,
			}

			const updatedSession: Session = {
				...session,
				shots: updatedShots,
				completed: currentRep + 1 >= session.shots.length ? true : session.completed,
			}

			setSession(updatedSession)
			void fetcher.submit(
				{ intent: 'update-session', session: JSON.stringify(updatedSession) },
				{ method: 'POST' },
			)

			if (currentRep + 1 >= session.shots.length) {
				setRepState('complete')
			} else {
				// Move to next rep and start automatically
				setCurrentRep(currentRep + 1)
				startRep()
			}
		},
		[session, repState, currentRep, startRep, fetcher],
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
			(shot) => shot.result === 'hit',
		).length
		const slowCount = session.shots.filter(
			(shot) => shot.result === 'slow',
		).length
		const missCount = session.shots.filter(
			(shot) => shot.result === 'miss',
		).length
		const totalCount = hitCount + slowCount + missCount

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
					<div className="flex justify-center gap-4">
						<div className="border-app-border bg-app-surface/80 rounded-xl border px-6 py-4">
							<p className="text-app-muted text-xs tracking-wider uppercase">
								Slow
							</p>
							<p className="mt-1 text-2xl font-bold text-yellow-500">
								{slowCount}
							</p>
						</div>
						<div className="border-app-border bg-app-surface/80 rounded-xl border px-6 py-4">
							<p className="text-app-muted text-xs tracking-wider uppercase">
								Miss
							</p>
							<p className="mt-1 text-2xl font-bold text-red-500">
								{missCount}
							</p>
						</div>
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

			{repState === 'waiting-for-result' && (
				<div className="space-y-6">
					<div className="text-center">
						<p className="text-app-muted mb-4 text-sm">How did you perform?</p>
					</div>

					<div className="flex justify-center gap-4">
						<button
							type="button"
							onClick={() => handleResult('hit')}
							className="max-w-xs flex-1 rounded-lg bg-green-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-green-600"
						>
							Hit
						</button>
						<button
							type="button"
							onClick={() => handleResult('slow')}
							className="max-w-xs flex-1 rounded-lg bg-yellow-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-yellow-600"
						>
							Slow
						</button>
						<button
							type="button"
							onClick={() => handleResult('miss')}
							className="max-w-xs flex-1 rounded-lg bg-red-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-red-600"
						>
							Miss
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
