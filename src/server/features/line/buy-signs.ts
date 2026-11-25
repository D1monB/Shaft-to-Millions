// The buy sign beside a machine place that is not bought yet: a post with a board showing the machine and its price.
// Only the next machine's sign is active (orange glow); later ones are grey and say which machine comes first.
// Built by code until the map author models a sign; the server owns it, the client only sees it.

const POST_SIZE = new Vector3(0.5, 4.5, 0.5);
const BOARD_SIZE = new Vector3(6, 3.4, 0.4);
/** Pixels per stud on the board, so text stays sharp at any distance. */
const PIXELS_PER_STUD = 50;

const COLORS = {
	post: Color3.fromRGB(52, 56, 66),
	board: Color3.fromRGB(28, 31, 40),
	active: Color3.fromRGB(255, 140, 40),
	locked: Color3.fromRGB(120, 126, 140),
	text: Color3.fromRGB(255, 246, 230),
	muted: Color3.fromRGB(170, 176, 190),
	price: Color3.fromRGB(255, 200, 70),
};

export interface SignInfo {
	readonly machineName: string;
	readonly price: string;
	/** True only for the next machine in line. */
	readonly active: boolean;
	/** For a locked sign: the machine that must be bought before this one. */
	readonly requires?: string;
}

function part(name: string, size: Vector3, color: Color3, parent: Instance): Part {
	const result = new Instance("Part");
	result.Name = name;
	result.Anchored = true;
	result.CanCollide = false;
	result.CanTouch = false;
	result.Size = size;
	result.Color = color;
	result.Material = Enum.Material.SmoothPlastic;
	result.TopSurface = Enum.SurfaceType.Smooth;
	result.BottomSurface = Enum.SurfaceType.Smooth;
	result.Parent = parent;
	return result;
}

function label(parent: Instance, text: string, color: Color3, y: number, height: number, font: Enum.Font): void {
	const line = new Instance("TextLabel");
	line.BackgroundTransparency = 1;
	line.Position = new UDim2(0.05, 0, y, 0);
	line.Size = new UDim2(0.9, 0, height, 0);
	line.Text = text;
	line.TextColor3 = color;
	line.TextScaled = true;
	line.Font = font;
	line.TextStrokeTransparency = 0.6;
	line.Parent = parent;
}

/**
 * Builds a sign standing at `at` (its foot on the ground, front facing the walkway).
 * Returns the model and its board, where the caller puts the buy prompt.
 */
export function buildSign(name: string, at: CFrame, info: SignInfo, parent: Instance): { model: Model; board: Part } {
	const model = new Instance("Model");
	model.Name = name;
	const accent = info.active ? COLORS.active : COLORS.locked;

	const post = part("Post", POST_SIZE, COLORS.post, model);
	post.CFrame = at.mul(new CFrame(0, POST_SIZE.Y / 2, 0));

	const board = part("Board", BOARD_SIZE, COLORS.board, model);
	board.CFrame = at.mul(new CFrame(0, POST_SIZE.Y + BOARD_SIZE.Y / 2 - 0.4, 0));

	// A thin neon frame behind the board: the glow tells "buy me" from "later" at a glance.
	const frame = part("Glow", BOARD_SIZE.add(new Vector3(0.3, 0.3, -0.2)), accent, model);
	frame.Material = info.active ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
	frame.CFrame = board.CFrame.mul(new CFrame(0, 0, 0.15));

	// CFrame.lookAt points -Z at the walkway, so the readable side is the board's Front face.
	const gui = new Instance("SurfaceGui");
	gui.Face = Enum.NormalId.Front;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = PIXELS_PER_STUD;
	gui.LightInfluence = 0;
	gui.Parent = board;

	label(gui, info.machineName, COLORS.text, 0.06, 0.3, Enum.Font.BuilderSansExtraBold);
	label(gui, info.price, info.active ? COLORS.price : COLORS.muted, 0.38, 0.28, Enum.Font.BuilderSansExtraBold);
	const hint = info.active ? "Натисни, щоб купити" : `Спершу: ${info.requires ?? "попередня машина"}`;
	label(gui, hint, info.active ? accent : COLORS.muted, 0.7, 0.22, Enum.Font.BuilderSansBold);

	model.PrimaryPart = board;
	model.Parent = parent;
	return { model, board };
}
