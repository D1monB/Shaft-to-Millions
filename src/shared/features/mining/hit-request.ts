// Checks the arguments of a MineHit request. Pure: the server passes `isNode` (an Instance with the OreNode tag),
// so the rules can be unit tested without Roblox.

export type HitRequest<T> =
	| { readonly kind: "hit"; readonly node: T }
	/** Not a cheat: a node removed while the request was on its way arrives as nil. Dropped without a log. */
	| { readonly kind: "drop" }
	| { readonly kind: "abuse" };

export function parseHitRequest<T>(
	args: ReadonlyArray<unknown>,
	isNode: (value: unknown) => value is T,
): HitRequest<T> {
	const [node] = args;
	if (node === undefined) {
		return { kind: "drop" };
	}
	if (args.size() !== 1 || !isNode(node)) {
		return { kind: "abuse" };
	}
	return { kind: "hit", node };
}
