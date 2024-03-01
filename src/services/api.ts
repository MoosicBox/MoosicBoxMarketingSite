import { QueryParams, objToStr } from './util';

class RequestError extends Error {
    constructor(public response: Response) {
        let message = `Request failed: ${response.status}`;

        if (response.statusText) {
            message += ` (${response.statusText})`;
        }

        if (response.url) {
            message += ` (url='${response.url}')`;
        }

        if (typeof response.redirected !== 'undefined') {
            message += ` (redirected=${response.redirected})`;
        }

        if (response.headers) {
            message += ` (headers=${objToStr(response.headers)})`;
        }

        if (response.type) {
            message += ` (type=${response.type})`;
        }

        super(message);
    }
}

export interface GitHubRelease {
    name: string;
    html_url: string;
    created_at: string;
    assets: Asset[];
}

export interface Asset {
    browser_download_url: string;
    name: string;
    size: number;
}

export interface OsRelease {
    assets: OsAsset[];
    version: string;
    url: string;
    releaseNotesUrl?: string;
}

export interface OsAsset {
    name: string;
    assetName: string;
    assetMatcher: (assetName: string) => boolean;
    asset?: Asset;
    showMoreFormats: boolean;
    otherFormats: Asset[];
}

export async function getGitHubReleases(opts: {
    org: string;
    repo: string;
}): Promise<GitHubRelease[]> {
    let releaseTag: string | undefined;
    const apiRoot = `https://api.github.com/repos/${opts.org}/${opts.repo}`;
    const releaseUrl = `${apiRoot}/releases/${releaseTag ? 'tags/' + releaseTag : 'latest'}`;

    return requestJson(releaseUrl);
}

async function requestJson<T>(
    url: string,
    options?: Parameters<typeof fetch>[1],
): Promise<T> {
    if (url[url.length - 1] === '?') url = url.substring(0, url.length - 1);

    const params = new QueryParams();

    if (params.size > 0) {
        if (url.indexOf('?') > 0) {
            url += `&${params}`;
        } else {
            url += `?${params}`;
        }
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        throw new RequestError(response);
    }

    return await response.json();
}

export function cancellable<T>(func: (signal: AbortSignal) => Promise<T>): {
    data: Promise<T>;
    controller: AbortController;
    signal: AbortSignal;
} {
    const controller = new AbortController();
    const signal = controller.signal;

    return { data: func(signal), controller, signal };
}

const abortControllers: { [id: string]: AbortController } = {};

export async function once<T>(
    id: string,
    func: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
    const controller = abortControllers[id];

    if (controller) {
        controller.abort();
    }

    const resp = cancellable(func);
    abortControllers[id] = resp.controller;

    let data: T;

    try {
        data = await resp.data;
    } catch (e) {
        throw e;
    } finally {
        delete abortControllers[id];
    }

    return data;
}
