/**
 * Unpacks each module in this repository into raw JSON files, ready to be committed and tracked.
 */

console.log("Unpacking modules from local foundry instance...");

// Load .env for paths
import { configDotenv } from "dotenv";

configDotenv({
	quiet: true,
});

import { extractPack } from "@foundryvtt/foundryvtt-cli";
import FoundryVttConfig from "@foundryvtt/foundryvtt-cli/config.mjs";

const config = FoundryVttConfig.instance;

const { FOUNDRY_DATA_PATH, FOUNDRY_INSTALLATION_PATH } = process.env;

// Configure data paths
config.set("dataPath", FOUNDRY_DATA_PATH);
config.set("installPath", FOUNDRY_INSTALLATION_PATH);

import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

for (const module of readdirSync(resolve(import.meta.dirname, "../modules"))) {
	console.debug(`Unpacking ${module}`);

	config.set("currentPackageId", module);
	config.set("currentPackageType", "Module");

	for (const pack of readdirSync(
		resolve(import.meta.dirname, "../modules", module, "packs"),
	)) {
		console.debug(`Unpacking ${module}/${pack}`);

		try {
			await extractPack(
				`${FOUNDRY_DATA_PATH}/Data/modules/${module}/packs/${pack}`,
				`${FOUNDRY_DATA_PATH}/Data/modules/${module}/packs/${pack}/_source`,
				{
					folders: true, // Organize things neatly
					yaml: true,
					omitVolatile: true,
					expandAdventures: true,
					clean: true, // Clean destination before exporting
					transformName(doc, context) {
						// Preface document names with their types
						const safeFileName = doc.name.replace(/[^a-zA-Z0-9А-я]/g, "_");

						const prefix = ["Actor", "Item"].includes(context.documentType)
							? doc.type
							: context.documentType;

						let name = `${doc.name ? `${prefix}_${safeFileName}_${doc._id}` : doc._id}.yaml`;
						if (context.folder) name = join(context.folder, name);
						return name;
					},
				},
			);
		} catch (error) {
			console.error(`Unable to unpack ${module}/${pack}.`, error);
		}
	}
}

console.log("Done.");
