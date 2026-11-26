// Whether something in the world belongs to the local player's plot. The server writes the owner on the plot model.
import { Players } from "@rbxts/services";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";

export function isOnOwnPlot(instance: Instance): boolean {
	let node: Instance | undefined = instance;
	while (node !== undefined) {
		const owner = node.GetAttribute(PLOT_ATTRIBUTES.Owner);
		if (owner !== undefined) {
			return owner === Players.LocalPlayer.UserId;
		}
		node = node.Parent;
	}
	return false;
}
