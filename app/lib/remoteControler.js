(function() {

var io = require('socket.io');

var ChromeCastList;
var Playlist;

function RemoteControler(aChromeCastList, aPlaylist, instance) {
    ChromeCastList = aChromeCastList;
    Playlist = aPlaylist; 
    this._init(instance);
}; 


RemoteControler.prototype = {
    _init: function(nwInst) 
    {
        this._io = null; 
        this._inst = nwInst; 

        this._startSocketIO(); 

        Array.observe(ChromeCastList, function() {
                this.send({key: 'chromecast_list_changed', data: ChromeCastList});
            }.bind(this));
        Array.observe(Playlist, function() {
                this.send({key: 'playlist_changed', data: Playlist});
            }.bind(this));
    }, 

    _startSocketIO: function() 
    {
        this._io = io();
        this._io.on('connection', function(socket) { 
                // TODO -  a user connected - send init info 
                console.log('A user connection');
                //this._io.emit('server_message', {"foo": "bar"});
                this.send({key: 'chromecast_list_changed', data: ChromeCastList});
                //this.send({key: 'chromecast_current', data: ChromeCastList});
                this.send({key: 'playlist_changed', data: Playlist});

                socket.on('client_message', function(msg) {
                        console.log('REcebi do cliente %s', JSON.stringify(msg));
                        this._onMessageFromClient(msg); 
                    }.bind(this));

            }.bind(this));
        this._io.listen(8070);
    }, 

    _onMessageFromClient: function(oMsg)
    {
        if(typeof(oMsg) === 'object' && 'key' in oMsg) {
            switch(oMsg.key) {
                case 'click-player-control': 
                    switch(oMsg.data) {
                        case 'playpause':
                            this._inst._onClickPlayPause(); 
                            break;
                        case 'stop':
                            this._inst._onClickStop(); 
                            break;
                        case 'backward':
                            this._inst._onClickBackward(); 
                            break;
                        case 'forward':
                            this._inst._onClickForward(); 
                            break;
                        case 'playlist-backward':
                            this._inst._onClickPlaylistBackward(); 
                            break;
                        case 'playlist-forward':
                            this._inst._onClickPlaylistForward(); 
                            break;
                    }
                    break;
                case 'click-playlist':
                   this._inst._onClickInPlaylistWithId(oMsg.data); 
                   break; 

            }
        }
    },

    send: function(msg)
    {
        if(this._io && msg) {
            this._io.emit('server_message', msg);
        }
    },

    _debug: function() {}
};


module.exports = RemoteControler; 

})();
