// Server bootstrap. Starts feature services in a fixed order:
// every feature registers its handlers first, profile starts last so "profile loaded" listeners are in place.
import { startProfileService } from "server/features/profile";

startProfileService();
