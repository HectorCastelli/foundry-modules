/**
 * Links this repository to a local installation of FoundryVTT.
 */

console.log("Linking repository to local foundry instance...");

// Load .env for paths
import { configDotenv } from "dotenv";

configDotenv({
	quiet: true,
});

const { FOUNDRY_DATA_PATH } = process.env;

import {
	existsSync,
	readdirSync,
	readlinkSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { resolve } from "node:path";

for (const module of readdirSync(resolve(import.meta.dirname, "../modules"))) {
	console.debug(`Linking ${module}`);

	const linkedDestination = resolve(
		FOUNDRY_DATA_PATH,
		"./Data/modules",
		module,
	);
	const linkedOrigin = resolve(import.meta.dirname, "../modules", module);

	if (existsSync(linkedDestination)) {
		console.warn(`Destination ${linkedDestination} already exists.`);
		try {
			if (readlinkSync(linkedDestination) === linkedOrigin) {
				console.warn(`It already is a symlink to the correct path. Skipping.`);
				continue;
			}
		} catch (e) {
			console.log(
				`This is not a symlink. The module must have been installed from a release.`,
			);
		}
		console.warn(`It will be replaced.`);
		rmSync(linkedDestination, { force: true, recursive: true });
	}
	symlinkSync(linkedOrigin, linkedDestination, "dir");
}

console.log("Done.");
