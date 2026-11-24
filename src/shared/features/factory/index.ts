// factory feature (shared): warehouse, machine queues (offline-safe) and processing estimates.
// Public API of this feature. Other code imports only from this file.
export {
	advance,
	cancelLast,
	collect,
	craftSeconds,
	depositAll,
	enqueue,
	machineProgress,
	maxCrafts,
	newMachineState,
	nextMachineUpgrade,
	nextWarehouseUpgrade,
	queueLimitOf,
	simulateProcessing,
	storageFree,
	storageTotal,
	warehouseCapacity,
} from "./factory";
export type { Counts, EnqueueResult, MachineProgress, MachineState, NextUpgrade, ProcessingEstimate } from "./factory";
export * from "./network";
