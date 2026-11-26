// Little coins that jump out of the SellStation when an item from the belt is sold (decision 067). Looks only: the
// server paid already. Coins are pooled and capped, so a fast line never floods the screen.
import { TweenService, Workspace } from "@rbxts/services";

const MAX_COINS = 24;
const FLIGHT = new TweenInfo(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const pool: Part[] = [];
let active = 0;
const random = new Random();

function makeCoin(): Part {
	const coin = new Instance("Part");
	coin.Name = "SaleCoin";
	coin.Shape = Enum.PartType.Cylinder;
	coin.Size = new Vector3(0.2, 1.2, 1.2);
	coin.Color = Color3.fromRGB(255, 205, 60);
	coin.Material = Enum.Material.Neon;
	coin.Anchored = true;
	coin.CanCollide = false;
	coin.CanQuery = false;
	coin.CanTouch = false;
	return coin;
}

export function popCoins(at: Vector3): void {
	const camera = Workspace.CurrentCamera;
	if (camera === undefined || camera.CFrame.Position.sub(at).Magnitude > 150) {
		return;
	}
	for (let i = 0; i < 3 && active < MAX_COINS; i++) {
		const coin = pool.pop() ?? makeCoin();
		active += 1;
		coin.Transparency = 0;
		coin.CFrame = new CFrame(at.add(new Vector3(0, 1.5, 0)));
		coin.Parent = Workspace;
		const target = at.add(
			new Vector3(random.NextNumber(-2.5, 2.5), random.NextNumber(4, 6.5), random.NextNumber(-2.5, 2.5)),
		);
		TweenService.Create(coin, FLIGHT, {
			CFrame: new CFrame(target).mul(CFrame.Angles(random.NextNumber(0, 6), random.NextNumber(0, 6), 0)),
			Transparency: 1,
		}).Play();
		task.delay(FLIGHT.Time, () => {
			coin.Parent = undefined;
			active -= 1;
			pool.push(coin);
		});
	}
}
