import { readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Return the list of modules in the current project.
 */
export function getModules() {
    return readdirSync('modules').filter((file) => {
        return statSync(`modules/${file}`).isDirectory();
    });
}

export function configureFoundryDataPath() {
    const foundryDataPath = `${process.env.HOME}/Games/TTRPG/fvtt/data/14/`;
    execSync(`npm run fvtt configure set "dataPath" "${foundryDataPath}"`, { stdio: 'inherit' });
    return foundryDataPath;
}

export function configureCurrentModule(module) {
    execSync(`npm run fvtt configure set "currentPackageId" "${module}"`, { stdio: 'inherit' });
    execSync(`npm run fvtt configure set "currentPackageType" "Module"`, { stdio: 'inherit' });
}