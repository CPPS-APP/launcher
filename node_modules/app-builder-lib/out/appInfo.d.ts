import { PlatformSpecificBuildOptions } from "./options/PlatformSpecificBuildOptions";
import { Packager } from "./packager";
export declare class AppInfo {
    private readonly info;
    private readonly platformSpecificOptions;
    readonly description: string;
    readonly version: string;
    readonly buildNumber: string | undefined;
    readonly buildVersion: string;
    readonly productName: string;
    readonly productFilename: string;
    constructor(info: Packager, buildVersion: string | null | undefined, platformSpecificOptions?: PlatformSpecificBuildOptions | null);
    get channel(): string | null;
    getVersionInWeirdWindowsForm(isSetBuildNumber?: boolean): string;
    private get notNullDevMetadata();
    get companyName(): string | null;
    get id(): string;
    get macBundleIdentifier(): string;
    get name(): string;
    get linuxPackageName(): string;
    get sanitizedName(): string;
    get updaterCacheDirName(): string;
    get copyright(): string;
    computePackageUrl(): Promise<string | null>;
}
export declare function smarten(s: string): string;
