import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as fs from "fs";
import * as path from "path";

import { CacheFilename } from "../src/constants";
import * as tar from "../src/tar";

jest.mock("@actions/exec");
jest.mock("@actions/io");

function getTempDir(): string {
    return path.join(__dirname, "_temp", "tar");
}

beforeAll(async () => {
    jest.spyOn(io, "which").mockImplementation(tool => {
        return Promise.resolve(tool);
    });

    process.env["GITHUB_WORKSPACE"] = process.cwd();
    await jest.requireActual("@actions/io").rmRF(getTempDir());
});

afterAll(async () => {
    delete process.env["GITHUB_WORKSPACE"];
    await jest.requireActual("@actions/io").rmRF(getTempDir());
});

test("extract BSD tar", async () => {
    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");

    const IS_WINDOWS = process.platform === "win32";
    const archivePath = IS_WINDOWS
        ? `${process.env["windir"]}\\fakepath\\cache.tar`
        : "cache.tar";
    const workspace = process.env["GITHUB_WORKSPACE"];

    await tar.extractTar(archivePath);

    expect(mkdirMock).toHaveBeenCalledWith(workspace);

    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
        `"${tarPath}"`,
        [
            "-xz",
            "-f",
            archivePath?.replace(/\\/g, "/"),
            "-P",
            "-C",
            workspace?.replace(/\\/g, "/")
        ],
        { cwd: undefined }
    );
});

test("extract GNU tar", async () => {
    const IS_WINDOWS = process.platform === "win32";
    if (IS_WINDOWS) {
        jest.mock("fs");

        const execMock = jest.spyOn(exec, "exec");
        const existsSyncMock = jest
            .spyOn(fs, "existsSync")
            .mockReturnValue(false);
        const isGnuTarMock = jest
            .spyOn(tar, "isGnuTar")
            .mockReturnValue(Promise.resolve(true));
        const archivePath = `${process.env["windir"]}\\fakepath\\cache.tar`;
        const workspace = process.env["GITHUB_WORKSPACE"];

        await tar.extractTar(archivePath);

        expect(existsSyncMock).toHaveBeenCalledTimes(1);
        expect(isGnuTarMock).toHaveBeenCalledTimes(1);
        expect(execMock).toHaveBeenCalledTimes(2);
        expect(execMock).toHaveBeenLastCalledWith(
            "tar",
            [
                "-xz",
                "-f",
                archivePath?.replace(/\\/g, "/"),
                "-P",
                "-C",
                workspace?.replace(/\\/g, "/"),
                "--force-local"
            ],
            { cwd: undefined }
        );
    }
});

test("create BSD tar", async () => {
    const execMock = jest.spyOn(exec, "exec");

    const archiveFolder = getTempDir();
    const workspace = process.env["GITHUB_WORKSPACE"];
    const sourceDirectories = ["~/.npm/cache", `${workspace}/dist`];

    await fs.mkdir(archiveFolder, () => void { recursive: true });

    await tar.createTar(archiveFolder, sourceDirectories);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
        `"${tarPath}"`,
        [
            "-cz",
            "-f",
            CacheFilename?.replace(/\\/g, "/"),
            "-C",
            workspace?.replace(/\\/g, "/"),
            "--files-from",
            "manifest.txt"
        ],
        {
            cwd: archiveFolder
        }
    );
});
