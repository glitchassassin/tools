import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { DryFireData } from './data.client'
import { useDryFireTracker } from './data.client'

type DryFireTrackerHelpers = ReturnType<typeof useDryFireTracker>[1]

type DryFireTrackerContextValue = {
	data: DryFireData
	helpers: DryFireTrackerHelpers
}

const DryFireTrackerContext = createContext<DryFireTrackerContextValue | null>(
	null,
)

export function DryFireTrackerProvider({ children }: { children: ReactNode }) {
	const [data, helpers] = useDryFireTracker()

	return (
		<DryFireTrackerContext.Provider
			value={{
				data,
				helpers,
			}}
		>
			{children}
		</DryFireTrackerContext.Provider>
	)
}

export function useDryFireTrackerContext() {
	const context = useContext(DryFireTrackerContext)
	if (!context) {
		throw new Error('useDryFireTrackerContext must be used within provider')
	}
	return context
}
