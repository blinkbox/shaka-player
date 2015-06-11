/**
 * Copyright 2015 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @fileoverview A polyfill to stub out {@link http://goo.gl/blgtZZ EME draft
 * 12 March 2015} on browsers with EME version http://www.w3.org/TR/2014/WD-encrypted-media-20140218/.
 *
 * @see http://enwp.org/polyfill
 */

goog.provide('shaka.polyfill.PatchedMediaKeys.v20140218');
goog.require('shaka.util.EventManager');
goog.require('shaka.util.FakeEvent');
goog.require('shaka.util.FakeEventTarget');
goog.require('shaka.util.PublicPromise');
goog.require('shaka.asserts');
goog.require('shaka.log');


/**
 * Install the polyfill.
 */
shaka.polyfill.PatchedMediaKeys.v20140218.install = function() {
    shaka.log.debug('PatchedMediaKeys.v20140218.install');

    // Alias
    var v20140218 = shaka.polyfill.PatchedMediaKeys.v20140218;

    // Delete mediaKeys to work around strict mode compatibility issues.
    delete HTMLMediaElement.prototype['mediaKeys'];
    // Work around read-only declaration for mediaKeys by using a string.
    HTMLMediaElement.prototype['mediaKeys'] = null;
    HTMLMediaElement.prototype.setMediaKeys = v20140218.setMediaKeys;

    // Install patches
    window.MediaKeySession = v20140218.MediaKeySession;
    window.MediaKeys = v20140218.MediaKeys;
    window.MediaKeySystemAccess = v20140218.MediaKeySystemAccess;
    Navigator.prototype.requestMediaKeySystemAccess = v20140218.requestMediaKeySystemAccess;
};


/**
 * An implementation of Navigator.prototype.requestMediaKeySystemAccess.
 * Retrieve a MediaKeySystemAccess object.
 *
 * @this {!Navigator}
 * @param {string} keySystem
 * @param {!Array.<!MediaKeySystemConfiguration>} supportedConfigurations
 * @return {!Promise.<!MediaKeySystemAccess>}
 */
shaka.polyfill.PatchedMediaKeys.v20140218.requestMediaKeySystemAccess =
    function(keySystem, supportedConfigurations) {
        shaka.log.debug('PatchedMediaKeys.v20140218.requestMediaKeySystemAccess');
        shaka.asserts.assert(this instanceof Navigator);

        // Alias.
        var v20140218 = shaka.polyfill.PatchedMediaKeys.v20140218;
        try {
            var access = new v20140218.MediaKeySystemAccess(keySystem, supportedConfigurations);
            return Promise.resolve(/** @type {!MediaKeySystemAccess} */ (access));
        } catch (exception) {
            return Promise.reject(exception);
        }
    };


/**
 * An implementation of MediaKeySystemAccess.
 *
 * @constructor
 * @param {string} keySystem
 * @param {!Array.<!MediaKeySystemConfiguration>} supportedConfigurations
 * @implements {MediaKeySystemAccess}
 * @throws {Error} if the key system is not supported.
 */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySystemAccess =
    function(keySystem, supportedConfigurations) {
        shaka.log.debug('v20140218.MediaKeySystemAccess');

        /** @type {string} */
        this.keySystem = keySystem;

        /** @private {!MediaKeySystemConfiguration} */
        this.configuration_;

        // This is only a guess, since we don't really know from the prefixed API.
        var allowPersistentState = true;

        if (keySystem == 'org.w3.clearkey') {
            // ClearKey doesn't support persistence.
            allowPersistentState = false;
        }

        var success = false;
        for (var i = 0; i < supportedConfigurations.length; ++i) {
            var cfg = supportedConfigurations[i];

            // Create a new config object and start adding in the pieces which we
            // find support for.  We will return this from getConfiguration() if
            // asked.
            /** @type {!MediaKeySystemConfiguration} */
            var newCfg = {
                'audioCapabilities': [],
                'videoCapabilities': [],
                // It is technically against spec to return these as optional, but we
                // don't truly know their values from the prefixed API:
                'persistentState': 'optional',
                'distinctiveIdentifier': 'optional',
                // Pretend the requested init data types are supported, since we don't
                // really know that either:
                'initDataTypes': cfg.initDataTypes
            };

            // v0.1b tests for key system availability with an extra argument on
            // canPlayType.
            var ranAnyTests = false;
            if (cfg.audioCapabilities) {
                for (var j = 0; j < cfg.audioCapabilities.length; ++j) {
                    var cap = cfg.audioCapabilities[j];
                    if (cap.contentType) {
                        ranAnyTests = true;
                        var contentType = cap.contentType.split(';')[0];
                        if (MSMediaKeys.isTypeSupported(this.keySystem, contentType)) {
                            newCfg.audioCapabilities.push(cap);
                            success = true;
                        }
                    }
                }
            }
            if (cfg.videoCapabilities) {
                for (var j = 0; j < cfg.videoCapabilities.length; ++j) {
                    var cap = cfg.videoCapabilities[j];
                    if (cap.contentType) {
                        ranAnyTests = true;
                        var contentType = cap.contentType.split(';')[0];
                        if (MSMediaKeys.isTypeSupported(this.keySystem, contentType)) {
                            newCfg.videoCapabilities.push(cap);
                            success = true;
                        }
                    }
                }
            }

            if (!ranAnyTests) {
                // If no specific types were requested, we check all common types to find
                // out if the key system is present at all.
                success = MSMediaKeys.isTypeSupported(this.keySystem, 'video/mp4');
            }
            if (cfg.persistentState == 'required') {
                if (allowPersistentState) {
                    newCfg.persistentState = 'required';
                } else {
                    success = false;
                }
            }

            if (success) {
                this.configuration_ = newCfg;
                return;
            }
        }  // for each cfg in supportedConfigurations

        throw Error('None of the requested configurations were supported.');
    };


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySystemAccess.prototype.
    createMediaKeys = function() {
    shaka.log.debug('v20140218.MediaKeySystemAccess.createMediaKeys');

    // Alias
    var v20140218 = shaka.polyfill.PatchedMediaKeys.v20140218;

    var mediaKeys = new v20140218.MediaKeys(this.keySystem);
    return Promise.resolve(/** @type {!MediaKeys} */ (mediaKeys));
};


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySystemAccess.prototype.
    getConfiguration = function() {
    shaka.log.debug('v20140218.MediaKeySystemAccess.getConfiguration');
    return this.configuration_;
};

/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.setMediaKeys = function(mediaKeys) {
    shaka.log.debug('v20140218.setMediaKeys');

    if (!mediaKeys) {
        delete this['mediaKeys'];
        this['mediaKeys'] = null;

        return;
    }

    // Alias
    var v20140218 = shaka.polyfill.PatchedMediaKeys.v20140218;

    // Remove any old listeners.
    mediaKeys.eventManager_.removeAll();

    // Intercept and translate these prefixed EME events.
    mediaKeys.eventManager_.listen(this, 'msneedkey', v20140218.onMsNeedKey_);

    delete this['mediaKeys'];  // in case there is an existing getter
    this['mediaKeys'] = mediaKeys;  // work around read-only declaration

    // Wrap native HTMLMediaElement.msSetMediaKeys with Promise
    try {
        // IE11/Edge requires that readyState >=1 before mediaKeys can be set, so check this,
        // and wait for loadedmetadata event if we are not in the correct state
        if (this.readyState >= 1) {
            return Promise.resolve(this.msSetMediaKeys(mediaKeys.nativeMediaKeys_));
        }
        else {
            return new Promise(function(resolve, reject){
                resolve(); // Need to resolve immediately otherwise Shaka is waiting indefinitely

                function setMediaKeysDeferred(){
                    this.msSetMediaKeys(mediaKeys.nativeMediaKeys_);
                    this.removeEventListener("loadedmetadata", setMediaKeysDeferred);
                }

                this.addEventListener("loadedmetadata", setMediaKeysDeferred);
            }.bind(this));
        }

        return Promise.resolve();
    } catch (exception) {
        return Promise.reject(exception);
    }
};

/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeys = function(keySystem) {
    shaka.log.debug('v20140218.MediaKeys');

    this.keySystem_ = keySystem;
    this.nativeMediaKeys_ = new MSMediaKeys(keySystem);

    /** @private {!shaka.util.EventManager} */
    this.eventManager_ = new shaka.util.EventManager();
};

/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeys.prototype.createSession = function(){
    shaka.log.debug('v20140218.MediaKeys.createSession');

    // Alias
    var v20140218 = shaka.polyfill.PatchedMediaKeys.v20140218;

    return new v20140218.MediaKeySession(this.nativeMediaKeys_);
};

/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeys.prototype.setServerCertificate = function(serverCertificate) {
        shaka.log.debug('v20140218.MediaKeys.setServerCertificate');

        // There is no equivalent in v20140218, so return failure.
        return Promise.reject(new Error('setServerCertificate not supported on this platform.'));
    };


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySession = function(nativeMediaKeys_) {
    shaka.log.debug('v20140218.MediaKeySession');
    shaka.util.FakeEventTarget.call(this, null);

    // This is the wrapped native MediaKeySession, which will be create in generateRequest
    this.nativeMediaKeySession_ = null;

    this.nativeMediaKeys_ = nativeMediaKeys_;

    /** @type {!shaka.util.PublicPromise} */
    this.closed = new shaka.util.PublicPromise();
};
goog.inherits(shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySession, shaka.util.FakeEventTarget);


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySession.prototype.generateRequest = function(initDataType, initData) {
    shaka.log.debug('v20140218.MediaKeySession.generateRequest');

    try {
        // This EME spec version requires a MIME content type as the 1st param
        // to createSession, but doesn't seem to matter what the value is...
        this.nativeMediaKeySession_ =  this.nativeMediaKeys_.createSession("video/mp4", initData);

        // Attach session event handlers here
        this.nativeMediaKeySession_.addEventListener("mskeymessage", shaka.polyfill.PatchedMediaKeys.v20140218.onMsKeyMessage_.bind(this));

        return Promise.resolve();
    }
    catch(exception) {
        return Promise.reject(exception);
    }
};


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySession.prototype.load = function() {
    shaka.log.debug('v20140218.MediaKeySession.load');

    return Promise.reject(new Error('MediaKeySession.load is only applicable for persistent licenses, which are not supported on this platform'));
};


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySession.prototype.update = function(response) {
    shaka.log.debug('v20140218.MediaKeySession.update');

    try {
        // Pass through to the native session
        this.nativeMediaKeySession_.update(response);

        return Promise.resolve();
    }
    catch(exception) {
        return Promise.reject(exception);
    }
};


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySession.prototype.close = function() {
    shaka.log.debug('v20140218.MediaKeySession.close');

    try {
        // Pass through to the native session
        // NOTE: IE seems to have spec discpency here - v2010218 should have MediaKeySession.release, but uses "close".
        // The next version of the spec is the initial Promise based one, so it's not the target spec either. Am supporting
        // both just in case..
        if (this.nativeMediaKeySession_.release) {
            this.nativeMediaKeySession_.release();
        }
        else {
            this.nativeMediaKeySession_.close();
        }

        this.closed.resolve();
        return this.closed;
    }
    catch(exception) {
        this.closed.reject(exception);
        return this.closed;
    }
};


/** @override */
shaka.polyfill.PatchedMediaKeys.v20140218.MediaKeySession.prototype.remove = function() {
    shaka.log.debug('v20140218.MediaKeySession.remove');

    return Promise.reject(new Error('MediaKeySession.remove is only applicable for persistent licenses, which are not supported on this platform'));
};


/**
 * @param {!MediaKeyEvent} event
 * @private
 */
shaka.polyfill.PatchedMediaKeys.v20140218.onMsNeedKey_ = function(event) {
    shaka.log.debug('v20140218.onMsNeedKey_', event);

    var event2 = shaka.util.FakeEvent.create({
        type: 'encrypted',
        initDataType: 'cenc',  // ContentType is sent, not initDataType, not sure where to source an accurate value
        initData: event.initData
    });

    this.dispatchEvent(event2);
};


shaka.polyfill.PatchedMediaKeys.v20140218.onMsKeyMessage_ = function(event) {
    // [this] is bound to v20140218.MediaKeySession, not the native MSMediaKeySession
    var event2 = shaka.util.FakeEvent.create({
        type: 'message',
        messageType: 'licenserequest',
        message: event.message
    });

    this.dispatchEvent(event2);
}