// bag feature (shared): carried ore and capacity. Pure logic, unit tested.
// Public API of this feature. Other code imports only from this file.
export { addToBag, bagCapacity, bagFreeSpace, bagTotal } from "./bag";
export type { OreCounts } from "./bag";
