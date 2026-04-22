var JASSUBModule = require('../../vendor/jassub/jassubBundle');
var jassubAssets = require('../../vendor/jassub/jassubAssets');

var JASSUB = JASSUBModule.default || JASSUBModule;

function decodeBase64(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);

    for (var index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function createBlobUrl(parts, mimeType) {
    return URL.createObjectURL(new Blob(parts, {
        type: mimeType
    }));
}

function getTrackUrl(track, isFallback) {
    return isFallback ? track.fallbackUrl : track.url;
}

function readTrackContent(track, isFallback) {
    var url = getTrackUrl(track, isFallback);

    if (!isFallback && typeof track.content === 'string') {
        return Promise.resolve(track.content);
    }

    if (typeof url === 'string') {
        return fetch(url)
            .then(function(resp) {
                if (resp.ok) {
                    return resp.text();
                }

                throw new Error(resp.status + ' (' + resp.statusText + ')');
            });
    }

    if (!isFallback && track.buffer instanceof ArrayBuffer) {
        try {
            return Promise.resolve(new TextDecoder().decode(new Uint8Array(track.buffer)));
        } catch (error) {
            return Promise.reject(error);
        }
    }

    return Promise.reject(new Error('No `url`, `content` or `buffer` field available for this track'));
}

function createASSRenderer(options) {
    options = options || {};

    var containerElement = options.containerElement;
    if (!(containerElement instanceof HTMLElement)) {
        throw new Error('Container element required to be instance of HTMLElement');
    }

    var renderer = null;
    var rendererPromise = null;
    var assetUrls = null;
    var requestId = 0;
    var visible = true;
    var opacity = 1;
    var delay = 0;

    function getVideoElement() {
        if (options.videoElement instanceof HTMLVideoElement) {
            return options.videoElement;
        }

        var videoElement = containerElement.querySelector('video');
        if (videoElement instanceof HTMLVideoElement) {
            return videoElement;
        }

        return null;
    }

    function getCanvasElement(targetRenderer) {
        if (targetRenderer && targetRenderer._canvas instanceof HTMLCanvasElement) {
            return targetRenderer._canvas;
        }

        var canvasElement = containerElement.querySelector('canvas.JASSUB');
        if (canvasElement instanceof HTMLCanvasElement) {
            return canvasElement;
        }

        return null;
    }

    function revokeAssetUrls(urls) {
        if (!urls) {
            return;
        }

        Object.keys(urls).forEach(function(key) {
            if (typeof urls[key] === 'string') {
                URL.revokeObjectURL(urls[key]);
            }
        });
    }

    function ensureAssetUrls() {
        if (assetUrls !== null) {
            return assetUrls;
        }

        assetUrls = {
            workerUrl: createBlobUrl([jassubAssets.workerSource], 'text/javascript'),
            wasmUrl: createBlobUrl([decodeBase64(jassubAssets.wasmBase64)], 'application/wasm'),
            defaultFontUrl: createBlobUrl([decodeBase64(jassubAssets.defaultFontBase64)], 'font/woff2')
        };

        return assetUrls;
    }

    function applyCanvasState(targetRenderer) {
        var canvasElement = getCanvasElement(targetRenderer);
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            return;
        }

        canvasElement.style.zIndex = '1';
        canvasElement.style.display = visible ? '' : 'none';
        canvasElement.style.opacity = String(opacity);
    }

    function applyRendererState(targetRenderer) {
        if (!targetRenderer) {
            return;
        }

        targetRenderer.timeOffset = delay / 1000;
        applyCanvasState(targetRenderer);
    }

    function ensureRenderer(subtitleText) {
        var videoElement = getVideoElement();
        if (!(videoElement instanceof HTMLVideoElement)) {
            return Promise.reject(new Error('ASS subtitles require a HTMLVideoElement'));
        }

        if (renderer !== null) {
            if (typeof renderer.setVideo === 'function') {
                renderer.setVideo(videoElement);
            }

            return Promise.resolve(renderer.ready)
                .then(function() {
                    applyRendererState(renderer);
                    return {
                        instance: renderer,
                        initializedWithContent: false
                    };
                });
        }

        if (rendererPromise !== null) {
            return rendererPromise
                .then(function(instance) {
                    if (typeof instance.setVideo === 'function') {
                        instance.setVideo(videoElement);
                    }

                    applyRendererState(instance);
                    return {
                        instance: instance,
                        initializedWithContent: false
                    };
                });
        }

        var urls = ensureAssetUrls();
        var instance = new JASSUB({
            video: videoElement,
            subContent: subtitleText,
            workerUrl: urls.workerUrl,
            wasmUrl: urls.wasmUrl,
            modernWasmUrl: urls.wasmUrl,
            availableFonts: {
                'liberation sans': urls.defaultFontUrl
            },
            defaultFont: 'liberation sans',
            queryFonts: 'local'
        });

        renderer = instance;
        rendererPromise = Promise.resolve(instance.ready)
            .then(function() {
                if (renderer === instance) {
                    applyRendererState(instance);
                    rendererPromise = null;
                }

                return instance;
            })
            .catch(function(error) {
                if (renderer === instance) {
                    renderer = null;
                    rendererPromise = null;
                }

                return Promise.resolve(instance.destroy())
                    .catch(function() {})
                    .then(function() {
                        throw error;
                    });
            });

        return rendererPromise.then(function(readyInstance) {
            return {
                instance: readyInstance,
                initializedWithContent: true
            };
        });
    }

    function readSubtitleText(track) {
        return readTrackContent(track)
            .catch(function(error) {
                if (typeof track.fallbackUrl === 'string') {
                    return readTrackContent(track, true);
                }

                throw error;
            });
    }

    function load(track) {
        if (!track) {
            return Promise.reject(new Error('Subtitle track is required'));
        }

        var currentRequestId = ++requestId;

        return readSubtitleText(track)
            .then(function(subtitleText) {
                if (currentRequestId !== requestId) {
                    return null;
                }

                if (typeof subtitleText !== 'string' || subtitleText.length === 0) {
                    throw new Error('Missing ASS subtitle content');
                }

                return ensureRenderer(subtitleText)
                    .then(function(result) {
                        if (currentRequestId !== requestId) {
                            return null;
                        }

                        if (!result.initializedWithContent && typeof result.instance.setTrack === 'function') {
                            return Promise.resolve(result.instance.setTrack(subtitleText))
                                .then(function() {
                                    if (currentRequestId !== requestId) {
                                        return null;
                                    }

                                    applyRendererState(result.instance);
                                    return track;
                                });
                        }

                        applyRendererState(result.instance);
                        return track;
                    });
            });
    }

    function destroy() {
        var currentRenderer = renderer;
        var currentAssetUrls = assetUrls;

        requestId = requestId + 1;
        renderer = null;
        rendererPromise = null;
        assetUrls = null;

        if (currentRenderer === null) {
            revokeAssetUrls(currentAssetUrls);
            return Promise.resolve();
        }

        return Promise.resolve(currentRenderer.destroy())
            .catch(function() {})
            .then(function() {
                revokeAssetUrls(currentAssetUrls);
            });
    }

    function setVisibility(enabled) {
        visible = enabled !== false;
        applyCanvasState(renderer);
    }

    function setDelay(value) {
        delay = isFinite(value) ? parseInt(value, 10) : 0;
        if (!isFinite(delay)) {
            delay = 0;
        }

        if (renderer !== null) {
            renderer.timeOffset = delay / 1000;
        }
    }

    function setOpacity(value) {
        if (typeof value === 'number' && isFinite(value)) {
            opacity = Math.min(Math.max(value, 0), 1);
        } else {
            opacity = 1;
        }

        applyCanvasState(renderer);
    }

    return {
        load: load,
        destroy: destroy,
        setVisibility: setVisibility,
        setDelay: setDelay,
        setOpacity: setOpacity
    };
}

module.exports = createASSRenderer;
