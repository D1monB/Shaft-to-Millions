// The friend bonus (decision 070): playing with friends pays more, so players invite them.
import { FRIEND_BONUS, MAX_FRIENDS_COUNTED } from "shared/config/retention";
import { isFiniteNumber } from "shared/lib/validate";

export function friendBonus(friends: number): number {
	return isFiniteNumber(friends) ? math.clamp(math.floor(friends), 0, MAX_FRIENDS_COUNTED) * FRIEND_BONUS : 0;
}
