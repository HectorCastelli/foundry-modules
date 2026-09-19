/**
 * Builds each module into `dist` for sharing
 */

console.log("Building modules...");

// Load .env for paths
import { configDotenv } from "dotenv";

configDotenv({
	quiet: true,
});

import { compilePack } from "@foundryvtt/foundryvtt-cli";

const { FOUNDRY_DATA_PATH } = process.env;

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// Setup `dist` folder
const distFolder = resolve(import.meta.dirname, "../dist");
if (existsSync(distFolder)) {
	rmSync(distFolder, { recursive: true, force: true });
}
mkdirSync(distFolder, { recursive: true });

for (const module of readdirSync(resolve(import.meta.dirname, "../modules"))) {
	console.debug(`Re-packing ${module}`);

	for (const pack of readdirSync(
		resolve(import.meta.dirname, "../modules", module, "packs"),
	)) {
		console.debug(`Re-packing ${module}/${pack}`);

		try {
			await compilePack(
				`${FOUNDRY_DATA_PATH}/Data/modules/${module}/packs/${pack}/_source`,
				`${FOUNDRY_DATA_PATH}/Data/modules/${module}/packs/${pack}`,
				{
					yaml: true,
					recursive: true,
				},
			);
		} catch (error) {
			console.error(`Unable to re-pack ${module}/${pack}.`, error);
		}
	}

	console.debug(`Moving ${module} to ${distFolder}`);
	mkdirSync(resolve(distFolder, module), { recursive: true });
	cpSync(
		resolve(import.meta.dirname, "../modules", module),
		resolve(distFolder, module),
		{
			force: true,
			recursive: true,
			filter(source, _destination) {
				// Remove `packs/*/_source` from copy
				if (/packs\/.*\/_source/.test(source)) {
					return false;
				}
				return true;
			},
		},
	);
}
console.log("Done.");
