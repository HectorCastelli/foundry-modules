import { configureFoundryDataPath, getModules } from "./common.js";
import { TYPE_COLLECTION_MAP } from '@foundryvtt/foundryvtt-cli/lib/package.mjs';
import { existsSync, readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const foundryDataPath = configureFoundryDataPath();

for (const module of getModules()) {
    console.log(`Unpacking module: ${module}`);
    configureCurrentModule(module);

    for (const pack in TYPE_COLLECTION_MAP) { // One module per document type
        const packSlug = TYPE_COLLECTION_MAP[pack];
        console.log(`Unpacking pack: ${packSlug}`);

        const foundryPackPath = `${foundryDataPath}/Data/modules/${module}/packs/${packSlug}`;
        if (!existsSync(foundryPackPath)) {
            console.warn(`Pack ${packSlug} does not exist in module ${module}, skipping.`);
            continue;
        }

        try {
            // If the pack exists in foundry data, unpack it
            execSync(`npm run fvtt package unpack ${packSlug}`, { stdio: 'inherit' });

            const unpackedPackPath = `${foundryDataPath}/Data/modules/${module}/packs/${packSlug}/_source`;
            const unpackedPackFiles = readdirSync(unpackedPackPath);
            if (unpackedPackFiles.length === 0) {
                console.warn(`Pack ${packSlug} in module ${module} is empty, skipping.`);
                continue;
            }

            // Create destination pack
            mkdirSync(`./modules/${module}/packs/${packSlug}`, { recursive: true });

            for (const file of unpackedPackFiles) {
                const sourceFilePath = `${unpackedPackPath}/${file}`;
                const destFilePath = `./modules/${module}/packs/${packSlug}/${file}`;

                copyFileSync(sourceFilePath, destFilePath);
            }
        } catch (error) {
            console.error(`Error unpacking pack ${packSlug} for module ${module}:`, error);
        }
    }
}