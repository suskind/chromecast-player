(function() {

var http = require('http'); 
var url = require('url'); 
var fs = require('fs');
var dns = require('dns');
var os = require('os');
var Transcoder = require('stream-transcoder');

function ServerLocal() {
    this._init();
};

ServerLocal.prototype = {
    
    _init: function() 
    {
        this._serverHost = '127.0.0.1';
        this._serverPort = 8069; 

        this._server = null; 

        this._getLocalIP(); 
                
        this._startServer(); 
    },

    _getLocalIP: function(cb) 
    {
        dns.lookup(os.hostname(), function(err, add, fam) {
                if(err) {
                    console.log('Error on get IP');
                    return; 
                }
                this._serverHost = add; 
            }.bind(this));
    },

    _startServer: function() 
    {
        this._server = http.createServer(function(req, res) {

                //console.log('PEdido: '+req.url);

                var curUrl = url.parse(req.url, true);
                //console.log(curUrl);
                if('pathname' in curUrl && curUrl.pathname.indexOf('/remote') === 0) {
                    try {
                        this._procRemote(req, res, curUrl.pathname); 
                    } catch(ex) {
                        this._responseHttpError(res, 404);
                    }
                } else if('pathname' in curUrl && curUrl.pathname.indexOf('/stream') === 0 && 'query' in curUrl && 'file' in curUrl.query && 'type' in curUrl.query) {
                    var filePath = curUrl.query.file; 
                    var mimeType = curUrl.query.type; 

                    filePath = decodeURIComponent(filePath); 
                    mimeType = decodeURIComponent(mimeType);

                    if('transcode' in curUrl.query) {
                        this._procTranscodeStream(req, res, filePath, mimeType);
                    } else {
                        this._procFileStream(req, res, filePath, mimeType);
                    }
                } else if('pathname' in curUrl && curUrl.pathname.indexOf('/subtitles') === 0 && 'query' in curUrl && 'file' in curUrl.query) {
        
                    try {            
                        var filePath = curUrl.query.file; 
                        filePath = decodeURIComponent(filePath); 

                        console.log('Give subtitles '+ filePath);

                        //filePath = '/tmp/bigbang.srt'; 

                        this._procSubtitles(req, res, filePath);
                    } catch(ex) {
                        this._responseHttpError(res, 404);
                    }

                } else if('pathname' in curUrl && curUrl.pathname.indexOf('/socket.io') === 0) {
                } else {
                    this._responseHttpError(res, 404);
                }
                
            }.bind(this)).listen(this._serverPort);
            console.log('server start at :::', this._serverPort);
            //}).listen(this._serverPort, this._serverHost);
    },

    _procRemote: function(req, res, path) 
    {
        console.log(path);
        var contentType = 'text/html';
        var content = '';

        path = path.replace('/remote/', '');

        if(path.indexOf('js/') > -1) {
            contentType = 'application/javascript';
            content = fs.readFileSync('./'+ path, 'utf8');
        
            var stat = fs.statSync('./'+path);

        } else if(path.indexOf('css/') > -1) {
            contentType = 'text/css';
            content = fs.readFileSync('./'+ path, 'utf8');
            var stat = fs.statSync('./'+path);
        } else if(path.indexOf('fonts/') > -1) { 
            var oFonts = {
                'ttf': 'application/x-font-ttf',
                'ttc': 'application/x-font-ttf',
                'eot': 'application/vnd.ms-fontobject',
                'woff': 'application/x-font-woff',
                'otf': 'font/opentype',
                'svg': 'image/svg+xml'
            };
            for(var font in oFonts) {
                if(oFonts.hasOwnProperty(font)) {
                    if(path.indexOf('.'+font) > -1) {
                        contentType = oFonts[font];
                        break;
                    }
                }
            }
            //console.log(contentType);
            //content = fs.readFileSync('./'+ path, 'utf8');
            content = fs.readFileSync('./'+ path);
            var stat = fs.statSync('./'+path);
        } else {
            content = fs.readFileSync('./remote.html', 'utf8');
            var stat = fs.statSync('./remote.html');
        }
            
        var total = stat.size;

        res.writeHead(200, "OK", {'Content-Type': contentType, 'Access-Control-Allow-Origin': '*', 'Content-Length': total, 'Connection': 'close'});
        res.end(content);
    }, 

    _procFileStream: function(req, res, filePath, mimeType) 
    {
        var path = filePath;
        var stat = fs.stat(path, function(err, stat) {

            if(err) {
                console.log('nao existe ', filePath);
                this._responseHttpError(res, 404);
                return;
            }

            // TODO, check file format 

            //console.log('is file: ', stat.isFile());

            var total = stat.size;

            if (req.headers['range']) {
                var range = req.headers.range;

                var parts = range.replace(/bytes=/, "").split("-");
                var partialstart = parts[0];
                var partialend = parts[1];

                var start = parseInt(partialstart, 10);
                var end = partialend ? parseInt(partialend, 10) : total-1;

                var chunksize = (end-start)+1;

                //console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

                var file = fs.createReadStream(path, {start: start, end: end});

                /*
                var part = rangeParser(total, range)[0];
                var chunksize = (part.end - part.start) + 1;

                console.log('RANGE: ' + part.start + ' - ' + part.end + ' = ' + chunksize);

                var file = fs.createReadStream(path, {start: part.start, end: part.end});
                */

                var objRespHeaders = {
                    'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 
                    //'Content-Range': 'bytes ' + part.start + '-' + part.end + '/' + total, 
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    //'Content-Type': 'video/mp4',
                    'Content-Type': mimeType,
                    //'Content-Type': 'video/quicktime',
                    'Access-Control-Allow-Origin': '*'
                };
                res.writeHead(206, objRespHeaders);
                file.pipe(res);
            } else {
                //console.log('ALL: ' + total);
                var objRespHeaders = {
                    'Content-Length': total,
                    'Accept-Ranges': 'bytes',
                    //'Content-Type': 'video/mp4',
                    'Content-Type': mimeType,
                    //'Content-Type': 'video/quicktime',
                    'Access-Control-Allow-Origin': '*'
                };
                res.writeHead(200, objRespHeaders);
                fs.createReadStream(path).pipe(res);
            }

        }.bind(this));
    },


    _procTranscodeStream: function(req, res, filePath, mimeType) 
    {
        //res.setHeader('Access-Control-Allow-Origin', '*');
        // Transcoder 
        if(mimeType === 'audio/mpeg') { 
            var trans = new Transcoder(filePath)
                .format('mp3')
                .audioCodec('libmp3lame')
                .audioBitrate(128 * 1000)
                .on('finish', function() {
                }); 
        } else {
            var trans = new Transcoder(filePath)
                  //.maxSize(320, 240)
                  .videoCodec('h264')
                  .videoBitrate(800 * 1000)
                  .fps(25)
                  //.audioCodec('libfaac')
                  .sampleRate(44100)
                  .channels(2)
                  .audioBitrate(128 * 1000)
                  .format('mp4')
                  .on('finish', function() {
                    });
        }

        var objRespHeaders = {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*'
        };
        res.writeHead(200, objRespHeaders); 
        trans.stream().pipe(res);
    },


    _procSubtitles: function(req, res, filePath)
    {
        var content = fs.readFileSync(filePath, 'utf8');

        var aContent = content.split('\r\n');
        for(var i=0, len=aContent.length; i < len; i++) {
            aContent[i] = aContent[i].replace(/(\d\d:\d\d:\d\d),(\d\d\d)/ig, '$1.$2');
        }
        content = aContent.join('\r\n');

        content = 'WEBVTT FILE\r\n\r\n' + content;

        var stat = fs.statSync(filePath);
        var total = stat.size;

        //console.log(content);

        res.writeHead(200, "OK", {'Content-Type': 'text/vtt; charset=UTF-8', 'Access-Control-Allow-Origin': '*', 'Content-Length': total, 'Connection': 'close'});
        //res.writeHead(200, "OK", {'Content-Type': 'text/vtt', 'Access-Control-Allow-Origin': '*'});
        res.end(content);
    }, 

    _responseHttpError: function(res, code) 
    {
        if(res && code) {
            switch(code) {
                case 404: 
                    res.writeHead(code, "Not found", {'Content-Type': 'text/plain'});
                    res.end(code + ' - Not Found');
                    break;
                case 405: 
                    res.writeHead(code, "Method not supported", {'Content-Type': 'text/plain'});
                    res.end(code + ' - Method not supported');
                    break;
                case 406: 
                    res.writeHead(code, "Not Acceptable", {'Content-Type': 'text/plain'});
                    res.end(code + ' - Not Acceptable');
                    break;
            }
        }
    },


    getRemoteAddr: function() 
    {
        return 'http://' + this._serverHost + ':' + this._serverPort + '/remote';
    },

    getRemoteIp: function() 
    {
        return this._serverHost; 
    },

    _debug: function() {}
};

module.exports = ServerLocal;

})();
