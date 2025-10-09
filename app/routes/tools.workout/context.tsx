import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { WorkoutTrackerData } from './data'
import { useWorkoutTracker } from './data'

type WorkoutTrackerHelpers = ReturnType<typeof useWorkoutTracker>[1]

type WorkoutTrackerContextValue = {
	data: WorkoutTrackerData
	helpers: WorkoutTrackerHelpers
}

const WorkoutTrackerContext = createContext<WorkoutTrackerContextValue | null>(null)

export function WorkoutTrackerProvider({ children }: { children: ReactNode }) {
	const [data, helpers] = useWorkoutTracker()

	return (
		<WorkoutTrackerContext.Provider
			value={{
				data,
				helpers,
			}}
		>
			{children}
		</WorkoutTrackerContext.Provider>
	)
}

export function useWorkoutTrackerContext() {
	const context = useContext(WorkoutTrackerContext)
	if (!context) {
		throw new Error('useWorkoutTrackerContext must be used within provider')
	}
	return context
}
