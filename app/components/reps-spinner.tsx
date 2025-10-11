import { useCallback, useId, useRef } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

type RepsSpinnerProps = {
	value: number
	onChange: (nextValue: number) => void
	label: string
	min?: number
	disabled?: boolean
}

export function RepsSpinner({
	value,
	onChange,
	label,
	min = 0,
	disabled = false,
}: RepsSpinnerProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const generatedId = useId()
	const inputId = `${generatedId}-input`

	const clampValue = useCallback(
		(candidate: number) => Math.max(min, Number.isFinite(candidate) ? candidate : min),
		[min],
	)

	const focusInput = useCallback(() => {
		inputRef.current?.focus()
	}, [])

	const handleIncrement = useCallback(() => {
		onChange(clampValue(value + 1))
		focusInput()
	}, [clampValue, focusInput, onChange, value])

	const handleDecrement = useCallback(() => {
		onChange(clampValue(value - 1))
		focusInput()
	}, [clampValue, focusInput, onChange, value])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'ArrowUp') {
				event.preventDefault()
				handleIncrement()
			} else if (event.key === 'ArrowDown') {
				event.preventDefault()
				handleDecrement()
			}
		},
		[handleIncrement, handleDecrement],
	)

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const raw = event.target.value.trim()
			if (raw === '') {
				onChange(min)
				return
			}
			const parsed = Number.parseInt(raw, 10)
			if (Number.isNaN(parsed)) {
				return
			}
			onChange(clampValue(parsed))
		},
		[clampValue, min, onChange],
	)

	return (
		<div className="border-app-border bg-app-surface/70 text-app-foreground flex flex-col overflow-hidden rounded-xl border">
			<button
				type="button"
				tabIndex={-1}
				aria-label={`Increase ${label}`}
				className="border-app-border/60 text-primary hover:bg-primary/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/80 w-full border-b px-4 py-2 text-lg font-semibold"
				onClick={handleIncrement}
				disabled={disabled}
			>
				+
			</button>
			<label htmlFor={inputId} className="sr-only">
				{label}
			</label>
			<input
				id={inputId}
				ref={inputRef}
				type="text"
				inputMode="numeric"
				pattern="[0-9]*"
				role="spinbutton"
				value={String(value)}
				autoComplete="off"
				aria-valuenow={value}
				aria-valuemin={min}
				aria-valuetext={`${value} reps`}
				aria-disabled={disabled}
				onKeyDown={handleKeyDown}
				onChange={handleChange}
				className="w-full border-none bg-transparent px-4 py-3 text-center text-xl font-semibold focus:outline-none"
			/>
			<button
				type="button"
				tabIndex={-1}
				aria-label={`Decrease ${label}`}
				className="border-app-border/60 text-primary hover:bg-primary/10 disabled:text-app-muted transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/80 w-full border-t px-4 py-2 text-lg font-semibold"
				onClick={handleDecrement}
				disabled={disabled || value <= min}
			>
				−
			</button>
		</div>
	)
}
