// promo feature (client): the promo code entry in the More menu (decision 068).
// Public API of this feature. Other code imports only from this file.
import React, { useState } from "@rbxts/react";
import { CODE_MIN_LENGTH, REDEEM_CODE_REMOTE } from "shared/features/promo";
import { registerHudButton } from "client/features/hud";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import { TextField } from "client/lib/text-field";
import { Button, Label } from "client/lib/ui-kit";

function PromoPanel() {
	const [code, setCode] = useState("");
	return (
		<>
			<Label text={t("promo.info")} tone="muted" order={1} />
			<TextField placeholder={t("promo.placeholder")} value={code} onChange={setCode} order={2} />
			<Button
				text={t("promo.redeem")}
				variant="success"
				height={48}
				shine={true}
				disabled={code.size() < CODE_MIN_LENGTH}
				onClick={() => sendToServer(REDEEM_CODE_REMOTE, code)}
				order={3}
			/>
		</>
	);
}

export function startPromoController(): void {
	registerHudButton(
		"🎁",
		() => t("menu.promo"),
		() => openPanel({ key: "promo", title: t("promo.title"), icon: "🎁", render: () => <PromoPanel /> }),
		11,
		"success",
		true,
	);
}
