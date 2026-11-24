import { PlayerView } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { onViewChanged } from "client/features/profile";
import { THEME, getHud, getHudButtons, makeButton, makeLabel } from "client/lib/ui";

interface HudLine {
	readonly order: number;
	readonly render: (view: PlayerView) => string | undefined;
	label?: TextLabel;
}

const lines: HudLine[] = [];

/** Adds a status line. `render` returns undefined to hide the line. Lower `order` is shown higher. */
export function registerHudLine(order: number, render: (view: PlayerView) => string | undefined): void {
	lines.push({ order, render });
	lines.sort((a, b) => a.order < b.order);
}

/** Adds a button to the bottom-left column (e.g. "Equipment"). */
export function registerHudButton(text: string, onClick: () => void): void {
	makeButton(getHudButtons(), text, onClick);
}

export function startHudController(): void {
	registerHudLine(0, (view) => `💰 ${formatMoney(view.money)}`);

	onViewChanged((view) => {
		const hud = getHud();
		lines.forEach((line, index) => {
			// The first line (money) is the headline of the game, so it is bigger and gold.
			const isFirst = index === 0;
			if (line.label === undefined) {
				line.label = makeLabel(hud, "", { bold: isFirst, size: isFirst ? 20 : 15 });
				line.label.LayoutOrder = line.order;
			}
			const text = line.render(view);
			line.label.Visible = text !== undefined;
			line.label.Text = text ?? "";
			line.label.TextColor3 = isFirst ? THEME.accent : THEME.text;
		});
	});
}
