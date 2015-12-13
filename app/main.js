Ink.requireModules(['Ink.Dom.Event_1', 'Ink.Dom.Css_1', 'Ink.Dom.Element_1'], function(InkEvent, InkCss, InkElement) {


//const LOCAL_SERVER = 'http://127.0.0.1:8069/stream?file=&type=';
const LOCAL_SERVER_PORT = '8069';
const LOCAL_SERVER_PATH = '/stream?file={%file%}&type={%mimetype%}';
const LOCAL_SERVER_SUBTITLES_PATH = '/subtitles?file={%file%}';
const QRCODE_FREE_SERVER = 'http://qrfree.kaywa.com/?l=1&s=8&d=';

const VIDEO_WARNING = './video/Im_watching_you-Wazowski.mp4';

const SUPORTED_TYPES = {
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.weba': 'audio/webm',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
};

//
// NW.js modules
//
var gui = require("nw.gui");
var win = gui.Window.get();
//win.focus();
if (process.platform === 'darwin') {
    var mb = new gui.Menu({ type: "menubar" });
    //mb.createMacBuiltin(gui.App.manifest.productName);
    mb.createMacBuiltin(gui.App.manifest.name);
    win.menu = mb;
}

// 
// Node Modules
//
var Client                = require('castv2-client').Client;
var DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;
var mdns                  = require('mdns'); 
var path                  = require('path');
var fs                    = require('fs');
//var readChunk             = require('read-chunk'); 
//var fileType              = require('file-type');

// 
// App Modules
//
var ServerLocal = require('./lib/ServerLocal');
var RemoteControler = require('./lib/RemoteControler');


var aChromeCast = []; // { name: name, ip: ip }
var playlistId = 0; 
var currentPlayingId = null; 
var aPlaylist = []; // { id: auto_increment, type: "file/url/magnet/youtube", link: "path/url/magnet_url/youtube_url", isPlaying: false}

var PlayerAPI = null; 
var PlayerStatus = null; 

var ChromeCastPlayer = function() {
    this._init(); 
}; 

ChromeCastPlayer.prototype = {
    _init: function() 
    {
        this._elms = {
            chromeCastCurrentPlaying: '#cur-chromecast-playing',
            chromeCastList: '#chromecasts-list', 
            timeFromStart: '#time-from-start',
            timeTotal: '#time-total',
            timeBar: '#time-bar',
            timeBarIcon: '#time-bar-icon',
            timeBarTooltip: '#time-bar-tooltip',
            playerControlsContainer: '#player-controls-container',
            playerControlPlayPause: '#player-control-playpause',
            inputLocalFile: '#input-local-file', 
            playlistContainer: '#playlist-container',
            remoteAddressLink: '#remote-server-address-link',
            remoteAddressText: '#remote-server-address',
            remoteAddressButton: '#remote-server-container .button-qr-code',
            remoteAddressQrCodeContainer: '#remote-server-qrcode-container',
            remoteAddressQrCodeImg: '#remote-server-qrcode-image',
            _debug: '#debug'
        };

        this._currentChromeCast = null; 
        this._castClient = null; 

        this._localFileServerAddr = null;
        this._localSubtitlesServerAddr = null;

        this._statusInt = false; 
        this._currentDuration = 0; 
        this._currentTime = 0; 

        this._getElms(); 
        this._addEvents(); 
        
        this._startChromeCast(); 

        this._ServerLocal = new ServerLocal(); 
        this._RemoteControler = new RemoteControler(aChromeCast, aPlaylist, this); 
        

        setTimeout(function() {

                this._getLocalServer(); 
                
                }.bind(this), 2000);
    }, 

    _getElms: function() 
    {
        for(var prop in this._elms) {
            if(this._elms.hasOwnProperty(prop)) {
                this._elms[prop] = Ink.s(this._elms[prop]);
                if(this._elms[prop] === null) {
                    console.log('Element selector not found ' + prop +'');
                }
            }
        }
    },

    _startChromeCast: function() 
    {
        var browser = mdns.createBrowser(mdns.tcp('googlecast'));

        var hasFoundOne = false; 
        var countFounds = 0; 
        browser.on('serviceUp', Ink.bind(function(service) {
            console.log('found device "%s" at %s:%d', service.name, service.addresses[0], service.port);
       
            if(!hasFoundOne) { 
                this._elms.chromeCastList.innerHTML = '';
                hasFoundOne = true;
            }
            //ondeviceup(service.addresses[0]);
            this._onChromeCastFound(service.name, service.addresses[0], ++countFounds);
            aChromeCast.push({ name: service.name, ip: service.addresses[0] });
            browser.stop();
        }, this));
        browser.start(); 
    },

    _onChromeCastFound: function(name, address, countFounds) 
    {
        // <li data-chromecast-address="192.168.1.xxx"><a href="#">Searching...</a></li> 
        var alreadyListed = Ink.s('[data-chromecast-address="'+address+'"]', this._elms.chromeCastList);
        if(alreadyListed !== null) {
            return;
        }
        var li = document.createElement('li');
        li.setAttribute('data-chromecast-address', address);
        li.setAttribute('data-chromecast-name', name);
        var a = document.createElement('a');
        a.href = "#";
        a.textContent = name;
        li.appendChild(a);
        this._elms.chromeCastList.appendChild(li);

        if(countFounds === 1) {
            a.click(); 
        }
    },

    _addEvents: function()
    {
        InkEvent.on(this._elms.chromeCastList, 'click', Ink.bindEvent(this._onClickChromeCastList, this));
        InkEvent.on(this._elms.playerControlsContainer, 'click', Ink.bindEvent(this._onClickPlayerControl, this));
        InkEvent.on(this._elms.inputLocalFile, 'change', Ink.bindEvent(this._onInputLocalFileChanged, this));
        InkEvent.on(this._elms.playlistContainer, 'click', Ink.bindEvent(this._onClickPlaylistContainer, this)); 

        InkEvent.on(this._elms.timeBar, 'mousemove', Ink.bindEvent(this._onBarMouseMove, this));
        InkEvent.on(this._elms.timeBar, 'click', Ink.bindEvent(this._onBarClick, this));
        //this._elms.timeBar.addEventListener('mouseover', Ink.bindEvent(this._onBarMouseOver, this), false);
        //this._elms.timeBar.addEventListener('click', Ink.bindEvent(this._onBarMouseOver, this), false);
        
        gui.Window.get().on('close', Ink.bindEvent(this._onUnload, this));

        InkEvent.on(this._elms.remoteAddressButton, 'click', Ink.bindEvent(this._toggleQrCodeContainer, this));
        InkEvent.on(this._elms.remoteAddressLink, 'click', Ink.bindEvent(this._openRemoteAddressInBrowser, this));
    }, 

    _onUnload: function(event) 
    {
        console.log('No unload...');
        this._onClickStop();
        gui.Window.get().close(true);
    },

    _onClickChromeCastList: function(event) 
    {
        InkEvent.stopDefault(event);

        var tgt = InkEvent.element(event);
        var elmChromeCastItem = InkElement.findUpwardsBySelector(tgt, '[data-chromecast-address]');

        if(elmChromeCastItem) {
            var name = elmChromeCastItem.getAttribute('data-chromecast-name');
            var address = elmChromeCastItem.getAttribute('data-chromecast-address');

            this._elms.chromeCastCurrentPlaying.textContent = name; //  + '('+ address +')';

            this._currentChromeCast = address; 

            this._RemoteControler.send({key: 'chromecast_current', name: name, address: address});
        }
    },

    _onClickPlayerControl: function(event)
    {
        var tgt = InkEvent.element(event);
        var elmControl = InkElement.findUpwardsBySelector(tgt, '[data-player-control]');

        if(elmControl) {
            var controlType = elmControl.getAttribute('data-player-control');

            switch(controlType) {
                case 'open-file': 
                    this._onClickOpenFile(); 
                    break;
                case 'open-link':
                    this._onClickOpenLink(); 
                    break;
                case 'playpause': 
                    this._onClickPlayPause(); 
                    break;
                case 'stop': 
                    this._onClickStop(); 
                    break;
                case 'backward':
                    this._onClickBackward();
                    break;
                case 'forward':
                    this._onClickForward(); 
                    break;
                case 'playlist-backward':
                    this._onClickPlaylistBackward();
                    break;
                case 'playlist-forward':
                    this._onClickPlaylistForward();
                    break;
                default:
                    console.log('Nothing to do with this control', controlType);
            }
        }
    },

    _onClickOpenFile: function() 
    {
        this._elms.inputLocalFile.click(); 
    },

    _onClickOpenLink: function() 
    {
        var link = prompt('URL to Play', '');

        //var link = prompt('URL to Play', 'http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4');
        //var link = prompt('URL to Play', 'http://127.0.0.1:8069/?file=/tmp/ED_1280.mp4');
        //var link = prompt('URL to Play', 'http://192.168.1.66:8069/?file=/tmp/ED_1280.mp4');
        //var link = prompt('URL to Play', 'http://127.0.0.1:8069/?file=/tmp/big_buck_bunny_1080p.mp4');
        //var link = prompt('URL to Play', 'http://127.0.0.1:4100/coiso');
        //var link = prompt('URL to Play', '');
        //console.log('coiso e tal', link);
        if(link) {
            //console.log('Entrou para add link');
            var name = 'N/A';
            var aLink = link.split('/');
            if(aLink.length > 0) {
                name = aLink[(aLink.length - 1)];
                if(name === '') {
                    name = link;
                }
            }
            var obj = {
                id: ++playlistId,
                type: 'url',
                link: link,
                name: name,
                isPlaying: false
            };
            aPlaylist.push(obj);

            if(aPlaylist.length === 1) {
                this._startPlayFile(obj);
            }

            this._appendToPlaylistHTML(obj);
        }
        //console.log('fim de add link');
    },

    _onClickPlayPause: function(justForceState) 
    {

        if(justForceState && (justForceState === 'play' || justForceState === 'pause')) {
            InkCss.removeClassName(this._elms.playerControlPlayPause, 'fa-play');
            InkCss.removeClassName(this._elms.playerControlPlayPause, 'fa-pause');

            if(justForceState === 'play') {
                InkCss.addClassName(this._elms.playerControlPlayPause, 'fa-play');
            } else if(justForceState === 'pause') {
                InkCss.addClassName(this._elms.playerControlPlayPause, 'fa-pause');
            }
            return; 
        }

        if(!PlayerAPI) {
            if(aPlaylist.length > 0) {
                this._startPlayFile(aPlaylist[0]);
            } else {
                //alert('Please, add some files to playlist');
            }
            return;
        }

        InkCss.removeClassName(this._elms.playerControlPlayPause, 'fa-play');
        InkCss.removeClassName(this._elms.playerControlPlayPause, 'fa-pause');

        if(PlayerStatus === 'PLAYING') {
            PlayerAPI.pause();
            InkCss.addClassName(this._elms.playerControlPlayPause, 'fa-play');
        } else if(PlayerStatus === 'PAUSED') {
            PlayerAPI.play();
            InkCss.addClassName(this._elms.playerControlPlayPause, 'fa-pause');
        }
    },

    _onClickBackward: function() 
    {
        var curTime = this._currentTime; 

        var newTime = curTime - 10; 
        if(newTime < 0) {
            newTime = 0; 
        }
        if(PlayerAPI) {
            this._currentTime = newTime;

            PlayerAPI.seek(newTime, function(err, status) {
                    //console.log('Cena do BACKWARD playerState=%s', status.playerState);
                });
        }
    },

    _onClickForward: function() 
    {
        var curTime = this._currentTime; 
        var curDuration = this._currentDuration; 

        var newTime = curTime + 10; 
        if(newTime > curDuration) {
            newTime = curDuration; 
        }
        if(PlayerAPI) {
            this._currentTime = newTime;

            PlayerAPI.seek(newTime, function(err, status) {
                    //console.log('Cena do FORWARD playerState=%s', status.playerState);
                });
        }
    },

    _onClickStop: function() 
    {
        if(!PlayerAPI) {
            //alert('No Player API');
            return;
        }
        this._stopInt(); 
        try {
        PlayerAPI.stop(); 
        } catch(ex) {}
        this._onClickPlayPause('play');
        PlayerAPI = null; 

        this._updateCurrentTime(0, 0);
        this._updateDuration(0);

        this._setAllPlaylistItemsIsPlayingFalse(); 
        this._setPlaylistCurrentPlaying(); 
        //this._castClient.stop();
    },

    _onClickPlaylistBackward: function() 
    {
        if(aPlaylist.length <= 1) {
            return; 
        }
        var idxIsPlaying = this._findItemInPlaylistIsPlaying();
        if(idxIsPlaying > -1) {
            var newIdx = idxIsPlaying - 1;
            if(newIdx < 0) {
                newIdx = (aPlaylist.length - 1);
            }
            this._onClickStop();
            this._startPlayFile(aPlaylist[newIdx]);
        }
    },

    _onClickPlaylistForward: function() 
    {
        if(aPlaylist.length <= 1) {
            return; 
        }
        var idxIsPlaying = this._findItemInPlaylistIsPlaying();
        if(idxIsPlaying > -1) {
            var newIdx = idxIsPlaying + 1;
            if(newIdx > (aPlaylist.length - 1)) {
                newIdx = 0;
            }
            this._onClickStop();
            this._startPlayFile(aPlaylist[newIdx]);
        }
    },


    _onInputLocalFileChanged: function(event) 
    {
        var aFiles = this._elms.inputLocalFile.files;

        if(aFiles.length === 0) {
            return;
        }
        var inputValue = this._elms.inputLocalFile.value;
        var aPaths = inputValue.split(';');

        console.log('LocalFile choosen: ', inputValue);

        var fileAdded = false; 

        for(var i=0, len=aFiles.length; i < len; i++) {
            //console.log('Entrou para add link');
            var name = aFiles[i].name; 
            var mime = aFiles[i].type; 
            if(mime === '') {
                mime === 'video/mp4';
            }
            var link = aPaths[i]; 

            var obj = {
                id: ++playlistId,
                type: 'file', 
                link: link,
                name: name,
                mime: mime, 
                isPlaying: false
            };

            // check for subtitles file 
            /* better check this on load video 
            var hasSubtitles = this._checkForSubtitlesFile(link);
            console.log('Has SUBTITLES '+ hasSubtitles +'');
            if(hasSubtitles !== null) {
                obj.subtitles = hasSubtitles; 
            }
            */

            aPlaylist.push(obj);

            fileAdded = true; 

            this._appendToPlaylistHTML(obj);
        }

        console.log(JSON.stringify(aPlaylist));

        if(fileAdded) {
            if(aPlaylist.length === 1) {
                this._startPlayFile(aPlaylist[0]);
            }
        }
    },

    _onClickPlaylistContainer: function(event) 
    {
        InkEvent.stopDefault(event);

        var tgt = InkEvent.element(event);

        // 
        // Remove from Playlist 
        //
        var clickRemove = InkElement.findUpwardsBySelector(tgt, '[data-remove-from-playlist]');
        if(clickRemove) {
            var curPLRow = InkElement.findUpwardsBySelector(tgt, '[data-playlist-row-id]');

            if(curPLRow) {
                var id = curPLRow.getAttribute('data-playlist-row-id');
                if(id !== null) {
                    id = parseInt(id, 10);

                    this._removeFromPlaylist(id); 

                    curPLRow.parentNode.removeChild(curPLRow);
                }
            }
            return; 
        }

        // 
        // Play clicked file in playlist 
        //
        var clickToPlayRow = InkElement.findUpwardsBySelector(tgt, '[data-playlist-row-id]');
        if(clickToPlayRow) {
            var id = clickToPlayRow.getAttribute('data-playlist-row-id');
            if(id !== null) {
                id = parseInt(id, 10);

                var idx = this._getPlaylistIdxFromId(id);

                if(idx > -1) {
                    if(PlayerAPI) { 
                        this._onClickStop();
                    }
                    this._startPlayFile(aPlaylist[idx]);
                }
            }
        }
    },

    _onClickInPlaylistWithId: function(id) 
    {
        id = parseInt(id, 10);
        var idx = this._getPlaylistIdxFromId(id);

        if(idx > -1) {
            if(PlayerAPI) { 
                this._onClickStop();
            }
            this._startPlayFile(aPlaylist[idx]);
        }
    },

    _getPlaylistIdxFromId: function(id) 
    {
        if(id) {
            for(var i=0, len=aPlaylist.length; i < len; i++) {
                if(aPlaylist[i].id === id) {
                    return i;
                }
            }
        }
        return -1; 
    },

    _findItemInPlaylistIsPlaying: function() 
    {
        for(var i=0, len=aPlaylist.length; i < len; i++) {
            if(aPlaylist[i].isPlaying) {
                return i; 
            }
        }
        return -1;
    },

    _removeFromPlaylist: function(id) 
    {
        if(id) {
            var idx = this._getPlaylistIdxFromId(id);
            if(idx === -1) {
                return; 
            }

            if(aPlaylist[idx].isPlaying && PlayerAPI) {
                this._onClickStop();
            }
            aPlaylist.splice(idx, 1);
        }
    },

    _setAllPlaylistItemsIsPlayingFalse: function() 
    {
        for(var i=0, len=aPlaylist.length; i < len; i++) {
            aPlaylist[i].isPlaying = false; 
        }
    },

    _appendToPlaylistHTML: function(obj) 
    {
        /*
        */
        var tr = document.createElement('tr');
        tr.setAttribute('data-playlist-row-id', obj.id);

        if(obj.isPlaying) {
            InkCss.addClassName(tr, 'green');
        }

        var td1 = document.createElement('td');
        InkCss.addClassName(td1, 'small');
        var td1A = document.createElement('a');
        td1A.href = '#play';
        td1A.className = 'all-100';
        td1A.textContent = obj.name; 
        td1A.setAttribute('title', 'Play ' + obj.link);
        td1.appendChild(td1A);

        var td2 = document.createElement('td');
        InkCss.addClassName(td2, 'pl-column-remove');
        //td2.style.width = '20px';
        td2.innerHTML = '<a href="#" data-remove-from-playlist style="cursor:pointer;" title="Remove item"><span class="fa fa-trash small"></span></a>';

        tr.appendChild(td1);
        tr.appendChild(td2);

        this._elms.playlistContainer.appendChild(tr);
    },

    _setPlaylistCurrentPlaying: function() 
    {
        var aAllPLRows = Ink.ss('[data-playlist-row-id]', this._elms.playlistContainer);
        for(var i=0, len=aAllPLRows.length; i < len; i++) {
            InkCss.removeClassName(aAllPLRows[i], 'green');
        }

        for(var i=0, len=aPlaylist.length; i < len; i++) {
            if(aPlaylist[i].isPlaying) {
                var plRow = Ink.s('[data-playlist-row-id='+aPlaylist[i].id+']', this._elms.playlistContainer);
                if(plRow !== null) {
                    InkCss.addClassName(plRow, 'green');
                    break; 
                }
            }
        }
    },

    _startPlayFile: function(obj) 
    {
        if(obj.isPlaying) {
            return; 
        }

        if(!this._currentChromeCast) {
            //alert('Please select first a Chrome Cast');
            return; 
        }
        var type = obj.type; 
        var link = obj.link; 
        var name = obj.name; 

        var mimetype = 'video/mp4';

        if(type === 'file') {
            var extName = path.extname(link);
            if(extName === '') {
                extName = 'mp4';
            }
            var extentionSupported = true;
            if(extName in SUPORTED_TYPES) {
                mimetype = SUPORTED_TYPES[extName];
            } else {
                extentionSupported = false; 
                if(typeof(obj.mime) === 'string') {
                    if(obj.mime.indexOf('audio') > -1) {
                        mimetype = 'audio/mpeg';
                    } else if(obj.mime.indexOf('video') > -1) {
                        mimetype = 'video/mp4';
                    } else {
                        mimetype = 'video/mp4';
                    }
                }
            }

            // Double check with file-type 
            /*
            var buffer = readChunk.sync(link, 0, 262);
            var oFileType = fileType(buffer);
            if(oFileType !== null && oFileType.mime) {
                if(/!(video|audio|image)/i.test(oFileType.mime)) {
                    link = VIDEO_WARNING;
                }
            } else {
                link = VIDEO_WARNING;
            }
            */

            // gamboa
            
            var subtitlesUrl = null;
            var hasSubtitles = this._checkForSubtitlesFile(link);

            // create webserver and get url
            link = this._localFileServerAddr
                            .replace('{%file%}', encodeURIComponent(link))
                            .replace('{%mimetype%}', encodeURIComponent(mimetype)) + (extentionSupported ? '' : '&transcode=1');

            if(hasSubtitles !== null) {
                //subtitlesUrl = 'http://192.168.1.66:8069/subtitles?file=' + encodeURIComponent(obj.subtitles);
                subtitlesUrl = this._localSubtitlesServerAddr
                            .replace('{%file%}', encodeURIComponent(hasSubtitles))
            }
        }


        //var client = new Client();
        this._castClient = new Client(); 

        var _that = this;

        console.log('VAI LIGAR COM: ' + JSON.stringify([link]));

        this._castClient.connect(this._currentChromeCast, function() {
            this._castClient.launch(DefaultMediaReceiver, function(err, player) {
                PlayerAPI = player; 
                var media = {
                    // Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
                    contentId: link, // 'http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4',
                    //contentType: 'video/mp4',
                    contentType: mimetype,
                    streamType: 'BUFFERED', // or LIVE
                    // Title and cover displayed while buffering
                    metadata: {
                        type: 0,
                        metadataType: 0,
                        title: name /*,
                        images: [
                            { url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg' }
                        ]*/
                    },
                    tracks: []
                };

                if(subtitlesUrl !== null) {
                    var objToTrack = {
                            trackId: 1, // This is an unique ID, used to reference the track
                            type: 'TEXT', // Default Media Receiver currently only supports TEXT
                            trackContentId: subtitlesUrl,  //'http://192.168.1.66:8069/subtitles', // the URL of the VTT (enabled CORS and the correct ContentType are required)
                            trackContentType: 'text/vtt', // Currently only VTT is supported
                            name: 'Subtitles', // 'Portuguese', // a Name for humans
                            language: 'pt-PT', // the language
                            subtype: 'SUBTITLES' // should be SUBTITLES
                          };
                    
                    //console.log('Track to with subtitles ' + JSON.stringify(objToTrack))
                    media.tracks.push(objToTrack); 
                }


                player.on('status', function(status) {
                    // 
                    // gamboa status update 
                    //
                    console.log('status broadcast playerState=%s', status.playerState);
                    PlayerStatus = status.playerState; 
                   
                    if(status && typeof(status.media) !== 'undefined' && typeof(status.media.duration) !== 'undefined') {
                        _that._updateDuration(status.media.duration);
                    }

                    if(PlayerStatus === 'PLAYING') {
                        _that._startInt(); 
                        _that._onClickPlayPause('pause');
                    } else if(PlayerStatus === 'PAUSED') {
                        _that._onClickPlayPause('play');
                    } else if(PlayerStatus === 'IDLE') {
                        if(aPlaylist.length > 1) {
                            console.log('Passa pro seguinte :: %s :: %s ', _that._currentTime+'', _that._currentDuration +'');
                            // 
                            // TODO fix this - there is a problem with this props to check to go to next track 
                            //
                            if( _that._currentDuration > 0 && (Math.floor(_that._currentTime) === Math.floor(_that._currentDuration)) ) {
                                _that._onClickPlaylistForward(); 
                            }
                        } else {
                            _that._onClickStop();
                        }
                    } else {
                        _that._stopInt(); 
                        // stop ping currentTime
                    }
                }); 

                var optionsToLoad = {
                    autoplay: true,
                    activeTrackIds: []
                };
                //console.log(' As optionsToLoad e o length ' + media.tracks.length + ' :: ' + JSON.stringify(optionsToLoad));
                if(media.tracks.length > 0) {
                    optionsToLoad.activeTrackIds.push(1);

                    //console.log('Vai pro Load e vai com legendas...');
                }

                console.log('WILL LOAD WITH THIS OPTIONS '+ JSON.stringify(optionsToLoad) +' AND MEDIA :: ' + JSON.stringify(media) );

                player.load(media, optionsToLoad, function(err, status) {

                    if(err) {
                        console.log('LOAD error: %s ', err);
                    }

                    console.log('LOAD COISO media loaded playerState=%s AND STATUS %s ', status.playerState, JSON.stringify(status));
                    PlayerStatus = status.playerState; 

                    obj.isPlaying = true; 

                    //
                    // emit event to play list changed 
                    //
                    _that._RemoteControler.send({key: 'playlist_changed', data: aPlaylist});

                    _that._setPlaylistCurrentPlaying(); 
                    
                    if(PlayerStatus === 'PLAYING') {
                        _that._onClickPlayPause('pause');
                    } else if(PlayerStatus === 'PAUSED') {
                        _that._onClickPlayPause('play');
                    }
                });



            }.bind(this));
        }.bind(this));

        this._castClient.on('error', function(err) {
            console.log('Error: %s', err.message);
            this._castClient.close();
        }.bind(this));

    },

    _updateCurrentTime: function(curTime, duration) 
    {
        this._currentDuration = duration; 
        this._currentTime = curTime; 

        this._elms.timeFromStart.textContent = this._formatSecToHMS(curTime); 

        var timeBarWidth = this._elms.timeBar.offsetWidth; 

        var curTimeBarIconPos = ((curTime * timeBarWidth) / duration); 

        this._elms.timeBarIcon.style.left = (curTimeBarIconPos - 9)+'px';
    },

    _startInt: function() 
    {
        if(!PlayerAPI) {
            return; 
        }
        if(this._statusInt) {
            return; 
        }
        this._statusInt = setInterval(function() {
                    PlayerAPI.getStatus(function(err, status) {
                        if(status && status.currentTime && status && status.media && status.media.duration) {
                            this._updateCurrentTime(status.currentTime, status.media.duration);
                        } else {
                            this._updateCurrentTime(0, 0);
                        }
                    }.bind(this));
                }.bind(this), 250);
    },

    _stopInt: function() 
    {
        if(this._statusInt) {
            clearInterval(this._statusInt);
            this._statusInt = false; 
        }
    },

    _updateDuration: function(duration)
    {
        this._currentDuration = duration; 
        this._elms.timeTotal.textContent = this._formatSecToHMS(duration); 
    },


    // 
    // TimeBar Stuff 
    //

    _getBarPositionOnEvent: function(event)
    {
        var barPosLeft = this._elms.timeBar.offsetLeft;
        var barWidth = this._elms.timeBar.offsetWidth;
        var mousePos = InkEvent.pointer(event);
        var mouseInBar = mousePos.x - barPosLeft;
        var mouseInPercentBar = (mouseInBar / barWidth);

        return mouseInPercentBar || 0;
    },

    _onBarMouseMove: function(event)
    {
        var percentBarPosition = this._getBarPositionOnEvent(event);

        this._elms.timeBarTooltip.textContent = this._formatSecToHMS(this._currentDuration * percentBarPosition); 
    },

    _onBarClick: function(event)
    {
        var percentBarPosition = this._getBarPositionOnEvent(event);
       
        var durationInPercent = (this._currentDuration * percentBarPosition);  
        this._elms.timeBarTooltip.textContent = this._formatSecToHMS(durationInPercent); 

        if(PlayerAPI) {
            PlayerAPI.seek(durationInPercent, function(err, status) {
                    //console.log('Cena do SEEK playerState=%s', status.playerState);
                });
        }
    }, 


    _formatSecToHMS: function(seconds) 
    {
        var hours = parseInt(seconds / 3600) % 24;
        var minutes = parseInt(seconds / 60) % 60;
        var seconds = parseInt(seconds % 60); 

        return ((hours < 10) ? '0'+hours : hours ) + ':' + ((minutes < 10) ? '0'+minutes : minutes) + ':' + ((seconds < 10) ? '0'+seconds : seconds)
    },

    // 
    // LocalServer Stuff 
    //
    _getLocalServer: function() 
    {
        var remoteAddr = this._ServerLocal.getRemoteAddr();
        var remoteIp = this._ServerLocal.getRemoteIp();

        this._localFileServerAddr = 'http://' + remoteIp + ':' + LOCAL_SERVER_PORT + '' + LOCAL_SERVER_PATH;
        this._localSubtitlesServerAddr = 'http://' + remoteIp + ':' + LOCAL_SERVER_PORT + '' + LOCAL_SERVER_SUBTITLES_PATH;

        this._elms.remoteAddressLink.setAttribute('href', remoteAddr);
        this._elms.remoteAddressText.textContent = remoteAddr; 

        this._elms.remoteAddressQrCodeImg.src = QRCODE_FREE_SERVER + encodeURIComponent(remoteAddr);
    },

    _toggleQrCodeContainer: function() 
    {
        InkCss.toggleClassName(this._elms.remoteAddressQrCodeContainer, 'hide-all');
    },

    _openRemoteAddressInBrowser: function(event) 
    {
        InkEvent.stopDefault(event);

        var href = this._elms.remoteAddressLink.href;
        gui.Shell.openExternal(href);
    },


    // 
    // Subtitles stuff 
    //
    _checkForSubtitlesFile: function(filePath) 
    {
        var fileName = path.basename(filePath);
        var dirName = path.dirname(filePath);
        var extName = path.extname(filePath); 

        var aFileName = fileName.split(extName);
        if(aFileName.length > 1) {
            aFileName.splice(-1);
        }

        var newNameToSrt = aFileName.join(extName) + '.srt';

        //console.log('SRT: Nome ' + newNameToSrt);

        var newFileSrtPath = dirName + '/' + newNameToSrt;
        
        console.log('SRT: Path ' + newFileSrtPath);

        try {
            var stat = fs.statSync(newFileSrtPath);
            if(stat.isFile()) {
                return newFileSrtPath;
            }
        } catch (e) { 
            return null; 
        }

        return null;

    },



    _logObj: function(obj) 
    {
        var str = [];
        for(var i in obj) {
            //if(obj.hasOwnProperty(i)) {
                str.push(i + ' (' + typeof(obj[i]) + ') ');
            //}
        }

        console.log('ZBR', JSON.stringify(str));
    },
    _debug: function() {}
};

new ChromeCastPlayer();

/*
player.launch(media, function(err, p) {
  p.once('playing', function() {
    var elm = document.getElementById('cur_chromecast_playing');
    if(elm) {
        elm.innerHTML = 'Is playing...';
    }
    console.log('playback has started.');
  });
});

*/

}); 
