Ink.requireModules(['Ink.Dom.Event_1', 'Ink.Dom.Css_1', 'Ink.Dom.Element_1'], function(InkEvent, InkCss, InkElement) {


function RemoteControl() {
    this._init(); 
};

RemoteControl.prototype = {
    _init: function() 
    {
        this._socket = null;

        this._elms = {
            chromeCastList: '#chromecasts-list',
            playerControlsContainer: '#player-controls-container', 
            playlistContainer: '#playlist-container'
        };
        
        this._getElms(); 
        this._addEvents();

        this._startSocketIO(); 
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

    _addEvents: function() 
    {
        InkEvent.on(this._elms.chromeCastList, 'change', Ink.bindEvent(this._onChromeCastListChange, this));
        InkEvent.on(this._elms.playerControlsContainer, 'click', Ink.bindEvent(this._onClickPlayerControl, this));
        InkEvent.on(this._elms.playlistContainer, 'click', Ink.bindEvent(this._onClickPlaylistContainer, this));
    },

    _startSocketIO: function() 
    {
        this._socket = io('http://' + window.location.hostname + ':8070'); 

        this._socket.emit('client_message', 'Hello world ' + Math.round(Math.random() * 999));

        this._socket.on('server_message', Ink.bind(function(msg) {
                console.log('veio server_message', msg);
                this._onServerMessage(msg);
            }, this));
    },

    _onServerMessage: function(oMsg) 
    {
        if(typeof(oMsg) === 'object' && oMsg.key) {
            switch(oMsg.key) {
                case 'chromecast_list_changed':
                    // chromecast list changed 
                    this._onChromeCastListChanged(oMsg.data); 
                    break;
                case 'playlist_changed': 
                    // playlist changed 
                    this._onPlaylistChanged(oMsg.data); 
                    break;
            }
        }
    },



    // 
    // DOM actions
    //

    _onChromeCastListChanged: function(aData)
    {
    }, 

    _onPlaylistChanged: function(aData) 
    {
        var aAllTrs = Ink.ss('> tr[data-playlist-row-id]', this._elms.playlistContainer);
        for(var i = (aAllTrs.length - 1); i >= 0; i--) {
            aAllTrs[i].parentNode.removeChild(aAllTrs[i]);
        }

        for(var i=0, len=aData.length; i < len; i++) {
            this._appendToPlaylistHTML(aData[i]);
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
        //InkCss.addClassName(td1, 'small');
        var td1A = document.createElement('a');
        td1A.href = '#play';
        td1A.className = 'all-100';
        td1A.textContent = obj.name;
        td1A.setAttribute('title', 'Play ' + obj.link);
        td1.appendChild(td1A);

        var td2 = document.createElement('td');
        InkCss.addClassName(td2, 'pl-column-remove');
        //td2.style.width = '20px';
        //td2.innerHTML = '<a href="#" data-remove-from-playlist style="cursor:pointer;" title="Remove item"><span class="fa fa-trash small"></span></a>';

        tr.appendChild(td1);
        tr.appendChild(td2);

        this._elms.playlistContainer.appendChild(tr);
    },


    _onClickPlayerControl: function(event)
    {
        var tgt = InkEvent.element(event);
        var elmControl = InkElement.findUpwardsBySelector(tgt, '[data-player-control]');

        if(elmControl) {
            var controlType = elmControl.getAttribute('data-player-control');
            switch(controlType) {
                case 'playpause':
                case 'stop':
                case 'backward':
                case 'forward':
                case 'playlist-backward':
                case 'playlist-forward':
                    console.log('vou mandar emit ', {key: 'click-player-control', data: controlType});
                    this._socket.emit('client_message', {key: 'click-player-control', data: controlType});
                    break;
            }
        }
    },

    _onClickPlaylistContainer: function(event)
    {
        InkEvent.stopDefault(event); 

        var tgt = InkEvent.element(event);

        var clickToPlayRow = InkElement.findUpwardsBySelector(tgt, '[data-playlist-row-id]');
        if(clickToPlayRow) {
            var id = clickToPlayRow.getAttribute('data-playlist-row-id');
            if(id !== null) {
                console.log('vou mandar emit ', {key: 'click-playlist', data: id});
                this._socket.emit('client_message', {key: 'click-playlist', data: id});
            }
        }
    },

    _debug: function() {}
};

new RemoteControl(); 


});
