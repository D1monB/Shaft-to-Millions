// profile feature (client): read-only copy of the local player's data, pushed by the server.
// Public API of this feature. Other code imports only from this file.
export { getView, onViewChanged, startProfileController } from "./profile-controller";
