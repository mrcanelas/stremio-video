var ERROR = {
    YOUTUBE_VIDEO: {
        API_LOAD_FAILED: {
            code: 90,
            message: 'YouTube player iframe API failed to load',
        },
        INVALID_PARAMETER: {
            code: 91,
            message: 'The request contains an invalid parameter value'
        },
        HTML5_VIDEO: {
            code: 92,
            message: 'The requested content cannot be played in an HTML5 player'
        },
        VIDEO_NOT_FOUND: {
            code: 93,
            message: 'The video requested was not found'
        },
        VIDEO_NOT_EMBEDDABLE: {
            code: 94,
            message: 'The owner of the requested video does not allow it to be played in embedded players'
        }
    },
    HTML_VIDEO: {
        MEDIA_ERR_ABORTED: {
            code: 80,
            message: 'Fetching process aborted'
        },
        MEDIA_ERR_NETWORK: {
            code: 81,
            message: 'Error occurred when downloading'
        },
        MEDIA_ERR_DECODE: {
            code: 82,
            message: 'Error occurred when decoding'
        },
        MEDIA_ERR_SRC_NOT_SUPPORTED: {
            code: 83,
            message: 'Video is not supported'
        }
    },
    UNKNOWN_ERROR: {
        code: 1,
        message: 'Unknown error'
    }
};

module.exports = ERROR;
