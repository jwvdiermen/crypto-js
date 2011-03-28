// Global namespace object
var CryptoJS;

// Don't overwrite
if ( ! CryptoJS) {
    // Private scope
    (function (undefined) {
        var C = CryptoJS = {};

        /* OOP
        ------------------------------------------------------------ */
        var C_oop = C.oop = {};

        /* OOP / BaseObj
        --------------------------------------------- */
        var BaseObj = C_oop.BaseObj = {
            extend: function (overrides) {
                // Spawn
                function F() {}
                F.prototype = this;
                var subtype = new F();

                // Constructor is meaningless in this pattern
                delete subtype.constructor;

                // Augment
                if (overrides) {
                    for (var o in overrides) {
                        if (overrides.hasOwnProperty(o)) {
                            subtype[o] = overrides[o];
                        }
                    }

                    // IE won't copy toString using the loop above
                    if (overrides.hasOwnProperty('toString')) {
                        subtype.toString = overrides.toString;
                    }
                }

                // Reference supertype
                subtype.super_ = this;

                return subtype;
            },

            create: function () {
                var instance = this.extend();
                instance.init.apply(instance, arguments);

                return instance;
            },

            init: function () {
                // Stub
            },

            clone: function () {
                return this.super_.extend(this);
            }
        };

        /* Encoding
        ------------------------------------------------------------ */
        var C_enc = C.enc = {};

        /* Encoding / Hex
        --------------------------------------------- */
        var Hex = C_enc.Hex = BaseObj.extend({
            encode: function (wordArray) {
                // Shortcuts
                var words = wordArray.words;
                var sigBytes = wordArray.sigBytes;

                var hexStr = [];
                for (var i = 0; i < sigBytes; i++) {
                    var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    hexStr.push((bite >>> 4).toString(16));
                    hexStr.push((bite & 0xf).toString(16));
                }

                return hexStr.join('');
            },

            decode: function (hexStr) {
                // Shortcuts
                var hexStrLength = hexStr.length;

                var words = [];
                for (var i = 0; i < hexStrLength; i += 2) {
                    words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
                }

                return WordArray.create(words, hexStrLength / 2);
            }
        });

        /* Encoding / ByteStr
        --------------------------------------------- */
        var ByteStr = C_enc.ByteStr = BaseObj.extend({
            encode: function (wordArray) {
                // Shortcuts
                var words = wordArray.words;
                var sigBytes = wordArray.sigBytes;

                var byteStr = [];
                for (var i = 0; i < sigBytes; i++) {
                    var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    byteStr.push(String.fromCharCode(bite));
                }

                return byteStr.join('');
            },

            decode: function (byteStr) {
                // Shortcuts
                var byteStrLength = byteStr.length;

                var words = [];
                for (var i = 0; i < byteStrLength; i++) {
                    words[i >>> 2] |= byteStr.charCodeAt(i) << (24 - (i % 4) * 8);
                }

                return WordArray.create(words, byteStrLength);
            }
        });

        /* Encoding / Utf8Str
        --------------------------------------------- */
        var Utf8Str = C_enc.Utf8Str = BaseObj.extend({
            encode: function (wordArray) {
                return decodeURIComponent(escape(ByteStr.encode(wordArray)));
            },

            decode: function (utf8Str) {
                return ByteStr.decode(unescape(encodeURIComponent(utf8Str)));
            }
        });

        /* Library
        ------------------------------------------------------------ */
        var C_lib = C.lib = {};

        /* Library / WordArray
        --------------------------------------------- */
        var WordArray = C_lib.WordArray = BaseObj.extend({
            init: function (words, sigBytes) {
                words = this.words = words || [];

                if (sigBytes != undefined) {
                    this.sigBytes = sigBytes;
                } else {
                    this.sigBytes = words.length * 4;
                }
            },

            defaultEncoder: Utf8Str,

            toString: function (encoder) {
                return (encoder || this.defaultEncoder).encode(this);
            },

            fromString: function (str, encoder) {
                return (encoder || this.defaultEncoder).decode(str);
            },

            concat: function (wordArray) {
                // Shortcuts
                var thisWords = this.words;
                var thatWords = wordArray.words;

                var thisSigBytes = this.sigBytes;
                var thatSigBytes = wordArray.sigBytes;

                for (var i = 0; i < thatSigBytes; i++) {
                    var thatBite = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    thisWords[thisSigBytes >>> 2] |= thatBite << (24 - (thisSigBytes % 4) * 8);
                    thisSigBytes++;
                }
                this.sigBytes = thisSigBytes;

                return this;
            },

            clamp: function () {
                // Shortcuts
                var words = this.words;
                var sigBytes = this.sigBytes;

                words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
                words.length = Math.ceil(sigBytes / 4);
            },

            clone: function () {
                var clone = WordArray.super_.clone.call(this);
                clone.words = this.words.slice(0);

                return clone;
            },

            random: function (nBytes) {
                var words = [];

                var nWords = Math.ceil(nBytes / 4);
                for (var i = 0; i < nWords; i++) {
                    words.push(Math.floor(Math.random() * 0x100000000));
                }

                return WordArray.create(words, nBytes);
            }
        });

        /* Library / CallbackDefaults
        --------------------------------------------- */
        var callbackDefaults = BaseObj.extend({
            fn: function () {},
            context: window,
            args: []
        });

        /* Library / CustomEvent
        --------------------------------------------- */
        var CustomEvent = C_lib.CustomEvent = BaseObj.extend({
            init: function () {
                this.subscribers = [];
            },

            subscribe: function (callback) {
                this.subscribers.push(callbackDefaults.extend(callback));
            },

            fire: function () {
                // Shortcuts
                var subscribers = this.subscribers;
                var subscribersLength = subscribers.length;

                // Execute callbacks
                for (var i = 0; i < subscribersLength; i++) {
                    var callback = subscribers[i];
                    callback.fn.apply(callback.context, callback.args);
                }
            }
        });

        /* Library / CmdQueue
        --------------------------------------------- */
        var CmdQueue = C_lib.CmdQueue = BaseObj.extend({
            init: function (async) {
                this.queue = [];
                this.index = 0;
                this.async = !! async;
                this.running = false;
            },

            execute: function (callback) {
                // Shortcuts
                var queue = this.queue;
                var index = this.index;

                // Add callback to queue
                if (callback) {
                    queue.push(
                        callbackDefaults.extend(callback)
                    );
                }

                // Execute next callback
                var nextCallback = queue[index];

                if (nextCallback && ! this.running) {
                    // Free memory
                    delete queue[index];

                    // Move callback pointer
                    this.index++;

                    if (this.async) {
                        // Execute asyncronously
                        this.running = true;

                        var thisCmdQueue = this;
                        setTimeout(function () {
                            // Sometime later, execute the callback
                            nextCallback.fn.apply(
                                nextCallback.context,
                                nextCallback.args
                            );

                            // Then execute the next callback
                            thisCmdQueue.running = false;
                            thisCmdQueue.execute();
                        }, 0);
                    } else {
                        // Execute syncronously
                        return nextCallback.fn.apply(
                            nextCallback.context,
                            nextCallback.args
                        );
                    }
                }
            }
        });

        /* Algorithms namespace
        ------------------------------------------------------------ */
        var C_algo = C.algo = {};
    }());
}
