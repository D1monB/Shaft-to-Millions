// travel feature (shared): fast travel rules between the surface and opened camps.
// Public API of this feature. Other code imports only from this file.
export { SURFACE, canTravelTo, isTravelDestination, travelCooldownLeft, travelDestinations } from "./travel";
export { TRAVEL_REMOTE } from "./network";
export { TRAVEL_COOLDOWN } from "./tuning";
