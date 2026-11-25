import { Assert, Test } from "@rbxts/lunit";
import { decodeText, ref, text, translateText } from "./text";

class TextTests {
	@Test
	public refsAreTranslatedInTheTargetLanguage() {
		const message = text("line.built", { name: ref("machine.M01") });
		Assert.equal(translateText("en", message), "Built: Hydro Washer!");
		Assert.equal(translateText("uk", message), "Збудовано: Гідро-Мийка!");
		Assert.equal(translateText("pl", message), "Zbudowano: Hydro-Myjka!");
		// An "@" value that is not a key is shown as it is, never looked up.
		Assert.equal(translateText("en", text("line.built", { name: "@nope" })), "Built: @nope!");
	}

	@Test
	public decodesGoodNetworkTexts() {
		const decoded = decodeText("sell.sold", { count: 3, money: "$15" });
		Assert.notUndefined(decoded);
		Assert.equal(translateText("en", decoded as never), "Ore sold: 3 for $15!");
		Assert.deepEqual(decodeText("sell.bagEmpty", undefined), { key: "sell.bagEmpty" });
	}

	@Test
	public rejectsBadNetworkTexts() {
		Assert.equal(decodeText("no.such.key", undefined), undefined);
		Assert.equal(decodeText(5, undefined), undefined);
		Assert.equal(decodeText(undefined, undefined), undefined);
		Assert.equal(decodeText("sell.sold", "params"), undefined);
		Assert.equal(decodeText("sell.sold", { count: 0 / 0 }), undefined);
		Assert.equal(decodeText("sell.sold", { count: math.huge }), undefined);
		Assert.equal(decodeText("sell.sold", { count: {} }), undefined);
		Assert.equal(decodeText("sell.sold", { count: true }), undefined);
		Assert.equal(decodeText("sell.sold", { count: string.rep("x", 500) }), undefined);
		Assert.equal(decodeText("sell.sold", [1, 2]), undefined);
		const many: { [name: string]: number } = {};
		for (let i = 0; i < 20; i++) {
			many[`p${i}`] = i;
		}
		Assert.equal(decodeText("sell.sold", many), undefined);
	}
}

export = TextTests;
