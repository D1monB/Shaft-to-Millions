// Coins that burst out of the middle of the screen and fly into the money counter after a sale. Visual only: the
// server already paid; this just makes it feel like money. Coins are reused (object pool), never created per sale.
import { Players, TweenService } from "@rbxts/services";
import { SALE_MADE_REMOTE } from "shared/features/selling";
import { playSound } from "client/lib/sounds";
import { onServerMessage } from "client/lib/remotes";
import { COLORS, FONTS } from "client/lib/ui-kit";

/** Most coins one sale throws, so a huge sale does not flood the screen. */
const MAX_COINS = 14;
const COIN_SIZE = 34;
/** The money capsule's badge in the HUD (hud.tsx: 18 px from the left, 60 px from the top, 34 px high). */
const TARGET = new UDim2(0, 36, 0, 77);
const BURST = new TweenInfo(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out);
const FLY = new TweenInfo(0.55, Enum.EasingStyle.Quad, Enum.EasingDirection.In);

let layer: ScreenGui | undefined;
const pool: Frame[] = [];

function getLayer(): ScreenGui | undefined {
	if (layer !== undefined) {
		return layer;
	}
	const playerGui = Players.LocalPlayer.FindFirstChildOfClass("PlayerGui");
	if (playerGui === undefined) {
		return undefined;
	}
	const gui = new Instance("ScreenGui");
	gui.Name = "CoinBurst";
	gui.ResetOnSpawn = false;
	// Same insets as the main UI, so the coins land on the money capsule.
	gui.IgnoreGuiInset = false;
	gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets;
	gui.DisplayOrder = 50;
	gui.Parent = playerGui;
	layer = gui;
	return gui;
}

function makeCoin(): Frame {
	const coin = new Instance("Frame");
	coin.AnchorPoint = new Vector2(0.5, 0.5);
	coin.Size = new UDim2(0, COIN_SIZE, 0, COIN_SIZE);
	coin.BackgroundColor3 = COLORS.gold;
	coin.BorderSizePixel = 0;
	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(1, 0);
	corner.Parent = coin;
	const stroke = new Instance("UIStroke");
	stroke.Color = COLORS.goldDark;
	stroke.Thickness = 3;
	stroke.Parent = coin;
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = new UDim2(1, 0, 1, 0);
	label.Font = FONTS.display;
	label.Text = "$";
	label.TextScaled = true;
	label.TextColor3 = COLORS.goldDark;
	label.Parent = coin;
	return coin;
}

/** More money, more coins: about one coin per digit of the sale, plus a few. */
function coinCount(money: number): number {
	return math.clamp(math.floor(math.log10(math.max(money, 1))) * 2 + 4, 4, MAX_COINS);
}

function burst(money: number): void {
	const gui = getLayer();
	if (gui === undefined) {
		return;
	}
	const random = new Random();
	const count = coinCount(money);
	for (let i = 0; i < count; i++) {
		const coin = pool.pop() ?? makeCoin();
		coin.Position = new UDim2(0.5, 0, 0.55, 0);
		coin.Size = new UDim2(0, COIN_SIZE * 0.4, 0, COIN_SIZE * 0.4);
		coin.Parent = gui;
		const angle = random.NextNumber(0, math.pi * 2);
		const radius = random.NextInteger(60, 160);
		const scatter = new UDim2(0.5, math.cos(angle) * radius, 0.55, math.sin(angle) * radius);
		const delay = i * 0.04;
		task.delay(delay, () => {
			TweenService.Create(coin, BURST, { Position: scatter, Size: new UDim2(0, COIN_SIZE, 0, COIN_SIZE) }).Play();
		});
		task.delay(delay + BURST.Time + 0.1, () => {
			TweenService.Create(coin, FLY, {
				Position: TARGET,
				Size: new UDim2(0, COIN_SIZE * 0.6, 0, COIN_SIZE * 0.6),
			}).Play();
		});
		task.delay(delay + BURST.Time + 0.1 + FLY.Time, () => {
			coin.Parent = undefined;
			pool.push(coin);
			playSound("machineCollect");
		});
	}
}

export function startCoinBurst(): void {
	onServerMessage(SALE_MADE_REMOTE, (money) => {
		if (typeIs(money, "number") && money > 0 && money < math.huge) {
			burst(money);
		}
	});
}
