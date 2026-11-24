// Number formatting for the UI. Big numbers are the point of the game (pauper to millionaire),
// so they must stay short and readable: 1 234 -> "$1.2K", 3 400 000 -> "$3.4M".

const SUFFIXES: ReadonlyArray<[number, string]> = [
	[1e12, "T"],
	[1e9, "B"],
	[1e6, "M"],
	[1e3, "K"],
];

/** Compact number: "950", "1.2K", "3.4M". NaN and infinity become "0" so a bug never shows garbage. */
export function formatCompact(value: number): string {
	if (value !== value || value === math.huge || value === -math.huge) {
		return "0";
	}
	const sign = value < 0 ? "-" : "";
	const abs = math.abs(value);
	for (const [threshold, suffix] of SUFFIXES) {
		if (abs >= threshold) {
			// One decimal, without a trailing ".0".
			const scaled = math.floor((abs / threshold) * 10) / 10;
			const text = scaled === math.floor(scaled) ? `${scaled}` : string.format("%.1f", scaled);
			return `${sign}${text}${suffix}`;
		}
	}
	return `${sign}${math.floor(abs)}`;
}

export function formatMoney(value: number): string {
	return `$${formatCompact(value)}`;
}

/** Seconds as "1:05" or "1:02:03". */
export function formatDuration(seconds: number): string {
	const total = seconds === seconds ? math.max(0, math.ceil(seconds)) : 0;
	const hours = math.floor(total / 3600);
	const minutes = math.floor((total % 3600) / 60);
	const secs = total % 60;
	if (hours > 0) {
		return string.format("%d:%02d:%02d", hours, minutes, secs);
	}
	return string.format("%d:%02d", minutes, secs);
}

/** Percent with up to one decimal: 0.125 -> "12.5%". */
export function formatPercent(fraction: number): string {
	const value = fraction === fraction ? fraction * 100 : 0;
	const rounded = math.floor(value * 10 + 0.5) / 10;
	return rounded === math.floor(rounded) ? `${rounded}%` : string.format("%.1f%%", rounded);
}
