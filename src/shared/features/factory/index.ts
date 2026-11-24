// factory feature (shared): warehouse, machine queues (offline-safe) and processing estimates.
// Public API of this feature. Other code imports only from this file.
export {
	advance,
	cancelLast,
	collect,
	depositAll,
	enqueue,
	machineProgress,
	maxCrafts,
	newMachineState,
	simulateProcessing,
	storageFree,
	storageTotal,
} from "./factory";
export type { Counts, EnqueueResult, MachineProgress, MachineState, ProcessingEstimate } from "./factory";
export * from "./network";
