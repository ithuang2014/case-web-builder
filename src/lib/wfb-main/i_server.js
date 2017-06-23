
var CrsaHttpServer = function(status_callback) {

    var config = {
        directory: '',
        port: parseInt(service.getSetting('webserver-port', '30000')),
        host : service.getSetting('webserver-host', '127.0.0.1')
    };

    var libs  = {
        http: require('http'),
        url: require('url'),
        fs: require('fs'),
        path: require('path')
    };

    var _this = this;
    this.serverStarted = false;

    this.url = 'http://' + config.host + ':' + config.port;

    this.encodeUrl = function(url) {
        return url;
        return url.replace(/#/g, '%23').replace(/\?/g, '%3F').replace(/;/g, '%3B').replace(/\&/g, '%26');
    }

    this.decodeUrl = function(url) {
        return url;
        return decodeURIComponent(url);
    }

    this.makeUrl = function(url) {
        if(url.indexOf('file://') === 0) {
            url = this.encodeUrl(url);
        }
        return url.replace('file://', this.url + '/file://');
    }

    this.getOriginalUrl = function(url) {
        if(url && url.indexOf(this.url + '/') == 0) {
            url = url.replace(this.url + '/', '');
            url = this.decodeUrl(url);
            if(url.indexOf('://') < 0) url = 'file://' + url;
        }
        return url;
    }

    this.makeProxyUrl = function(url, live) {
        if (url == null) return "";

        if(url.indexOf('file://') === 0) {
            url = this.makeUrl(url);
        } else if(!crsaIsAbsoluteUrl(url)) {
            //console.log('MakeProxyUrl: url is relative: ' + url);
        } else if(url.indexOf(this.url) != 0) {
            url = this.url + '/' + this.encodeUrl(url);
        }
        if(live) {
            url = crsaAppendQueryToUrl(url, ['pglive=1']);
        }
        return url;
    }

    var getMimeType = function(file){
        file = crsaRemoveUrlParameters(file);

        if(service.isFileEditable(file)) {
            return "text/html";
        }

        var i = file.lastIndexOf("."),
            ext = (i === -1) ? "default" : file.substr(i),
            mimeTypes = {
                ".bmp": "image/bmp",
                ".css": "text/css",
                ".gif": "image/gif",
                ".ico": "image/x-icon",
                ".htm": "text/html",
                ".html": "text/html",
                ".php": "text/html",
                ".php5": "text/html",
                ".htm": "text/html",
                ".asp": "text/html",
                ".aspx": "text/html",
                ".cfm": "text/html",
                ".cfml": "text/html",
                ".cfc": "text/html",
                ".shtml": "text/html",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".js": "application/javascript",
                ".json": "application/json",
                ".otf": "font/opentype",
                ".woff": "application/font-woff",
                ".woff2": "application/font-woff",
                ".ttf": "application/x-font-ttf",
                ".svg": "image/svg+xml",
                ".png": "image/png",
                ".text": "text/plain",
                ".mp3": "audio/mp4",
                ".mp4": "video/mp4",
                ".webm": "video/webm",
                ".ogv": "video/ogg",
                ".ogg": "audio/ogg",
                "default": null
                //"default": "application/octet-stream"
            };

        return mimeTypes[ext.toLowerCase()] || mimeTypes['default'];
    }

    this.getMimeType = function(file) {
        return getMimeType(file);
    }

    this.testServer = function(done) {
        $.ajax({
            url: this.url + '/pginternal/detect',
            dataType: 'text',
            timeout: 10000
        }).done(function(data) {
            if(data.indexOf('<h1>OK</h1>') >= 0) {
                done('OK');
            } else {
                done('ANOTHER_SERVER', '<p><b>Another server is already running</b> on network ports selected for Pinegrow (<b>' + config.port + ' to ' + (config.port + 10) + '</b>).</p><p>Stop the app that is using these ports or go to <b>Support -&gt; Settings</b> and change the value of the <b>Internal webserver port</b> setting.</p><p>Note: Pinegrow needs its own internal webserver during editing. Other webservers like Apache, Nginx etc will not do.</p>');
            }
        }).fail(function() {
            done('NOT_ACCESSIBLE', '<p><b>The internal webserver is not accessible.</b></p><p>The most likely reason is that your firewall or anti-virus software is blocking Pinegrow from accessing the network. In that case add a firewall rule that will allow Pinegrow to listen to the incoming network connections on port range <b>' + config.port + ' to ' + (config.port + 10) + '</b>.</p>');
        });
    }

    this.currentRequestContext = {documentNode: null, crsaPage: null, isRemote: false, remotePath: null, remotePathParts: null, remoteHost: null, base: "", body_element: null, html_element: null};

    this.releaseRequestContextForPage = function(page) {
        if(_this.currentRequestContext.crsaPage == page) {
            this.setCurrentRequestContext(null, null, false);
        }
    }

    this.setCurrentRequestContext = function(fullPath, documentNode, preview_mode, page) {
        if(page) {
            _this.currentRequestContext.crsaPage = page;
        } else {
            _this.currentRequestContext.crsaPage = documentNode ? service.getCrsaPageOfPgParserNode(documentNode) : null;
        }
        _this.currentRequestContext.documentNode = documentNode;
        _this.currentRequestContext.previewMode = preview_mode;
        _this.currentRequestContext.html_element = null;
        _this.currentRequestContext.body_element = null;

        if(documentNode) {
            _this.currentRequestContext.html_element = documentNode.findOne('html');
            _this.currentRequestContext.body_element = documentNode.findOne('body');
        }

        if(!fullPath || crsaIsFileUrl(fullPath)) {
            _this.currentRequestContext.isRemote = false;
            _this.currentRequestContext.remotePath = null;
            _this.currentRequestContext.remotePathParts = null;
            _this.currentRequestContext.remoteHost = null;
            _this.currentRequestContext.base = ""
        } else {
            //get base
            _this.currentRequestContext.base = "";
            if(documentNode) {
                var baseList = documentNode.find('base', true); //single
                if(baseList.length) {
                    _this.currentRequestContext.base = baseList[0].getAttr('href');
                }
            }
            _this.currentRequestContext.isRemote = true;

            _this.currentRequestContext.remotePath = crsaRemoveUrlParameters(fullPath).replace(/^[a-z]+:\/\//, '');
            _this.currentRequestContext.remotePathParts = _this.currentRequestContext.remotePath.split('/');

            if(_this.currentRequestContext.remotePathParts.length) {
                _this.currentRequestContext.remoteHost = _this.currentRequestContext.remotePathParts.shift();

                if(_this.currentRequestContext.remotePathParts.length) {
                    _this.currentRequestContext.remotePathParts.pop();
                    _this.currentRequestContext.remotePath = _this.currentRequestContext.remotePathParts.join('/');
                }
            }
        }

    }

    this.createProxyUrlNodeOutputFilter = function(linkNode, str, type, attr_name, attr_value, attr_quote) {
        if(type === 'attrs' && !linkNode.script_info) {
            str = crsaRemoveScripts(str);
            if(_this.currentRequestContext.crsaPage && !_this.currentRequestContext.crsaPage.javascriptEnabled) {
                str = str.replace(/\son[a-z]*\="[^"]*"/g, ''); //remove onX JS attributes
            }
        }
        if(type === 'attrs' && (linkNode.tagName === 'script' || linkNode.tagName === 'link' || linkNode.tagName === 'img' || linkNode.tagName === 'base')) {
            var is_remote = _this.currentRequestContext.isRemote;
            var remotePath = _this.currentRequestContext.remotePath;
            var remoteHost = _this.currentRequestContext.remoteHost;
            var remotePathParts = _this.currentRequestContext.remotePathParts;

            var attrs = linkNode.getAttributesString(function(linkNode, attrName, attrValue, attrQuote) {

                if(attrName.toLowerCase() == 'href' || attrName.toLowerCase() == 'src') {
                    var href = attrValue;

                    if(attrValue) {
                        //strip extra ../
                        if(crsaIsAbsoluteUrl(attrValue)) {

                            if(attrValue.indexOf('//') == 0) {
                                attrValue = 'http:' + attrValue;
                            }

                            var change = true;
                            if(attrValue.startsWith('http://')) {
                                change = false;
                            }
                            //include without proxy... Active CSS seems to work when we do it like that. Images should be also ok.
                            if(change) {
                                attrValue = _this.makeProxyUrl(attrValue);
                            }

                        } else if(is_remote) {
                            if(linkNode.tagName != 'base') {
                                if(remotePath !== null) {
                                    var a = attrValue.split('/');
                                    var last = remotePathParts.length;
                                    for(var j = 0; j < a.length; j++) {
                                        if(a[j] != '..') break;
                                        last--;
                                    }
                                    if(last < 0) {
                                        while(last < 0) {
                                            a.shift();
                                            last++;
                                        }
                                        attrValue = a.join('/');
                                        //console.log('CSS rel link fixed: ' + href);
                                    }
                                }
                                if(attrValue.length) {
                                    if(attrValue.charAt(0) != '/') {
                                        attrValue = _this.currentRequestContext.base + attrValue;
                                    }
                                    if(attrValue.charAt(0) == '/') {
                                        attrValue = 'http://' + remoteHost + attrValue;
                                        attrValue = _this.makeProxyUrl(attrValue);
                                    }
                                }
                            }
                        } else {
                            //local
                            if(attrValue.charAt(0) == '/') {
                                var project = pinegrow.getCurrentProject();
                                if(project) {
                                    attrValue = project.getUrl() + attrValue;
                                    attrValue = _this.makeProxyUrl(attrValue);
                                }
                            }
                        }
                    }
                }
                var str = attrValue === null ? attrName : attrName + '=' + attrQuote + attrValue + attrQuote;
                str = crsaRemoveScripts(str);
                return str;
            });

            if(linkNode.tagName === 'script' && _this.currentRequestContext.crsaPage && !_this.currentRequestContext.crsaPage.javascriptEnabled) {
                attrs = attrs.replace(/type\=[\"\'][^\"\']*[\"\']/g, '') + ' type="pinegrow/disabled"';
            }
            return attrs;
        } else if(type === 'attrs' && (linkNode.tagName === 'a' || linkNode.tagName === 'form') && !_this.currentRequestContext.previewMode) {
            //force remove target
            str = str.replace(/starget\=["'][^"']*["']/g, '');
            //if(!str.match(/\starget\=/i)) {
                str += ' target="_pg_blank"';
            //}
        } else if(type === 'node' && linkNode.script_info) {
            if(linkNode.script_info) {
                if(_this.currentRequestContext.html_element && !linkNode.closest('html') && linkNode.document && linkNode.document == _this.currentRequestContext.documentNode) {
                    //script is outside of html element, dont show it
                    str = '';
                } else {
                    str = '<php data-pg-id="' + linkNode.getId() + '" data-pg-script-type="' + linkNode.script_info.type + '">' + escapeHtmlCode( linkNode.content ) + '</php>';
                }
            }
        } else if(type === 'attribute') {
            if(attr_name == 'style') {
                if(str) {
                    str = str.replace(/url\('([^']*)'\)/g, function(m, a, b, c) {
                        return 'url(\'' + pinegrow.getProxyUrl(a) + '\')';
                    })
                    return str;
                }
            }
            return str;
        }
        return str;
    }

    try {
        var server = libs.http.createServer(function(request, response) {
            var url = libs.url.parse(request.url, true),
                path = decodeURIComponent(url.pathname),
                result = request.method + " " + path.bold,
                fileCount = 0;

            // Default file to index.html
            if (path === "/") path += "index.html";

            //console.log('SERVER: ' + path);

            var pathHandlers = {};

            pathHandlers['/pginternal/detect'] = function(path, request, response) {
                response.writeHead(200, {
                    'content-type': "text/html",
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma' : 'no-cache',
                    'Expires' : '0'
                });
                response.write("<h1>OK</h1>");
                response.end();
            }

            if(path in pathHandlers) {
                pathHandlers[path](path, request, response);
                return;
            }

            var referer = null;
            if('referer' in request.headers) {
                referer = _this.getOriginalUrl(request.headers.referer);
                referer = referer.replace(/[\?\#].*/g, '');
            }

            var is_remote = ((path.indexOf('://') >= 0 || path.indexOf('///') == 0) || (referer && referer.indexOf('://') >= 0 && referer.indexOf('file://') < 0)) && (path.indexOf('file://') < 0);

            var fullPath;
            var fullPathUrl;

            if(is_remote) {
                fullPath = decodeURIComponent(url.path).substr(1);
                fullPathUrl = fullPath;
            } else {
                //console.log('HTTP Server path: ' + path);
                fullPath = libs.path.join(config.directory, path.replace('file://', ''));

                while(fullPath.length > 1 && fullPath.charAt(0) == '\\') {
                    fullPath = fullPath.substr(1);
                }
                if(libs.path.sep == '\\') {
                    //win
                    if(!fullPath.match(/^[a-z]\:/i)) {
                        fullPath = '\\\\' + fullPath;
                    }
                }
                fullPathUrl = crsaIsFileUrl(fullPath) ? fullPath : crsaMakeUrlFromFile(fullPath);
            }

            //console.log('HTTP Server: ' + fullPath);

            var sendError = function(code, msg) {
                response.writeHead(code, {});
                response.write("<h1>" + code + " - " + msg + "</h1>");
                response.end();
            }

            var handleWrapper = function(html_for_browser, rootNode, done) {

                if(!crsaPage) {
                    done(html_for_browser);
                    return;
                }

                var onHtmlReady = function(html) {
                    var wp = new pgParser();
                    wp.assignIds = false;
                    wp.replaceExistingIds = false;
                    wp.parse(html);
                    var htmlel = wp.rootNode.findOne(crsaPage.wrapper_selector || 'body');
                    if(htmlel) {
                        var remove = [];
                        for(var i = 0; i < htmlel.children.length; i++) {
                            if(htmlel.children[i].tagName != 'script') remove.push(htmlel.children[i]);
                        }
                        for(var i = 0; i < remove.length; i++) {
                            remove[i].remove();
                        }
                        htmlel.prepend(rootNode.clone(true, true));

                        htmlel.pgId = rootNode.getId();
                        htmlel.addClass('pg-partial-container');
                    }
                    var opts = pinegrow.getFormatHtmlOptions();
                    opts.assign_missing_ids = false;
                    html_for_browser = wp.rootNode.toStringWithIds(true, opts, _this.createProxyUrlNodeOutputFilter);
                    done(html_for_browser);
                }

                if(crsaPage.wrapper_url) {
                    var wcp = pinegrow.getCrsaPageByUrl(crsaPage.wrapper_url);
                    if(wcp) {
                        var html = wcp.sourceNode.toStringOriginal(true, pinegrow.getFormatHtmlOptions());
                        onHtmlReady(html);

                    } else if(crsaIsFileUrl(crsaPage.wrapper_url)) {
                        var f = crsaMakeFileFromUrl(crsaPage.wrapper_url);
                        var html = libs.fs.readFileSync(f, {encoding: "utf8"});
                        onHtmlReady(html);
                    } else {
                        $.ajax({
                            url: crsaPage.wrapper_url,
                            data: null,
                            dataType: 'text'
                        }).done(function(data) {
                            onHtmlReady(data);
                        }).fail(function() {
                            onHtmlReady('File ' + crsaPage.wrapper_url + ' not found.');
                        });
                    }

                } else if(!rootNode.findIncludingSelf('body', true)) {
                    html_for_browser = '<body data-pg-id="' + rootNode.getId() + '">' + html_for_browser + '</body>';
                    done(html_for_browser);
                } else {
                    done(html_for_browser);
                }
            }

            var onContentRead = function(data, serverMime) {
                var mime = serverMime ? serverMime : getMimeType(fullPath);

                // sws: blocked
                /* pg: For project feature
                if(!mime) {
                    var project = pinegrow.getCurrentProject();
                    if(project && project.isFileInProject(fullPath)) {
                        //allow all files in project dir
                        mime = 'application/octet-stream';
                    }
                }
                */
                //debugger;
                if(mime) {
                    if(['image/gif','image/jpeg','image/png', 'application/octet-stream'].indexOf(mime) >= 0 && is_remote ) {

                        response.writeHead(200, {
                            'content-type': mime,
                            'Cache-Control': 'max-age=60000, public'
                        });
                    } else {
                        response.writeHead(200, {
                            'content-type': mime,
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma' : 'no-cache',
                            'Expires' : '0'
                        });
                    }

                    if(mime == "text/html" && service.sourceParser) {
                        /* pg : parse html source with pgParser */
                        var p = new pgParser();
                        p.replaceExistingIds = true;

                        var onParsed = function(original) {
                            var cp = service.getCrsaPageByUrl(url.href);

                            if(cp) {
                                cp.callGlobalFrameworkHandler('on_page_parsed_in_proxy', p.rootNode, url.href);
                            }

                            _this.setCurrentRequestContext(fullPathUrl, p.rootNode, false, cp);

                            var html_for_browser = p.toStringWithIds(true, null, _this.createProxyUrlNodeOutputFilter);

                            console.log(html_for_browser);

                            var rootNode = p.rootNode;
                            console.log(request.url);
                            console.log(rootNode);

                            handleWrapper(html_for_browser, rootNode, function(html_for_browser) {

                                data = new Buffer(html_for_browser);
                                //data = new Buffer(html);
                                response.write(data);
                                response.end();

                                //console.log('Server - data sent');

                                var obj = {
                                    rootNode : rootNode,
                                    data : data,
                                    pageId : pgid,
                                    url : crsaPage ? crsaPage.url : url.href
                                }
                                $('body').trigger('crsa-server-page-loaded', obj);
                            });
                        }

                        var profile = new CrsaProfile(true);

                        var original_html = data.toString('utf8');

                        // sws: blocked
                        // var project = pinegrow.getCurrentProject();
                        // if(project) {
                        //     var bck_page = project.getBackgroundPageForUrl(fullPathUrl);
                        //     if(bck_page) {
                        //         original_html = bck_page.getCode();
                        //     }
                        // }

                        //php


                        //console.log(original_html);
                        p.parse(original_html);

                        profile.show('HTML parse');
                        onParsed(original_html);
                        profile.show('HTML sent');
                    } else {
                        response.write(data);
                        response.end();
                    }

                } else {
                    sendError(403, "Type not allowed");
                }
            }

            var pgid = null;
            var pglive = false;
            var crsaPage = null;
            var pgnoids = false;
            if(url.query.pgid) {
                pgid = parseInt(url.query.pgid);
                crsaPage = service.getCrsaPageById(pgid);
            }
            if(url.query.pglive) {
                pglive = true;
            }
            if(url.query.pgnoids && url.query.pgnoids == '1') {
                pgnoids = true;
            }
            if(pglive && crsaPage) {
                response.writeHead(200, {
                    'content-type': "text/html",
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma' : 'no-cache',
                    'Expires' : '0'
                });
                crsaPage.callGlobalFrameworkHandler('on_page_parsed_in_proxy', crsaPage.sourceNode, url.href);

                var orig_js_enabled = crsaPage.javascriptEnabled;
                crsaPage.javascriptEnabled = crsaPage.javascriptEnabled || pgnoids; //if external preview

                _this.setCurrentRequestContext(fullPathUrl, crsaPage.sourceNode, pgnoids /* preview mode ? */);
                var html = pgnoids ? crsaPage.sourceNode.toStringOriginal(true, service.getFormatHtmlOptions(), _this.createProxyUrlNodeOutputFilter) : crsaPage.sourceNode.toStringWithIds(true, service.getFormatHtmlOptions(), _this.createProxyUrlNodeOutputFilter);

                crsaPage.javascriptEnabled = orig_js_enabled;

                var html_for_browser = html;

                handleWrapper(html_for_browser, crsaPage.sourceNode, function(html_for_browser) {
                    var data = new Buffer(html_for_browser);
                    response.write(data);
                    response.end();
                });
                return;
            }


            if(referer) {
                var m = referer.match(/[&\?]pgid=([0-9]+)/);
                if(m) {
                    pgid = parseInt(m[1]);
                    crsaPage = pinegrow.getCrsaPageById(pgid);
                }

                if(referer.match(/[&\?]pglive=1/)) pglive = true;

                if(fullPath.match(/\.css($|[^a-z])/g)) {
                    var path = is_remote ? fullPath : 'file://' + fullPath;
                    var cslist = findCrsaStylesheetForUrl(path);
                    var cs = cslist.length > 0 ? cslist[0] : null;
                    if(cs && cs.loaded) {
                        console.log('Live reload - found CSS ' + fullPath);
                        cs.getCssSource(function(css) {
                            var data = new Buffer(css);
                            response.write(data);
                            response.end();
                        })
                        return;
                    }
                }
            }


            if(crsaPage && pgid && crsaPage.wrapper_url) {
                fullPath = crsaMakeFileFromUrl(crsaPage.url);
                is_remote = false;
            }


            if(is_remote) {
                var r = require('request');

                //var x = r(fullPath);
                //request.pipe(x)
                //x.pipe(response)



                //console.log('Proxy: ' + fullPath);

                if('referer' in request.headers) {
                    var a = _this.getOriginalUrl(request.headers.referer).replace(/^[a-z]+:\/\//i,'').split(/[//\?\#]/);
                    if(a.length) {
                        var host = a[0];
                        //console.log('Referer host: ' + host);
                        if(fullPath.indexOf('//') === 0) {
                            var a = document.createElement('a');
                            a.href = request.headers.referer;
                            fullPath = a.protocol + fullPath;
                        } else if(fullPath.indexOf('://') < 0) {
                            //fullPath = fullPath.replace('://', '://' + host + '/');
                            fullPath = 'http://' + host + '/' + fullPath;
                            //console.log('Path fixed: ' + fullPath);
                        }
                    }
                } else {
                    if(fullPath.indexOf('//') === 0) {
                        fullPath = 'http:' + fullPath;
                    }
                }

                if(crsaPage) {
                    var data = crsaPage.getAsset(fullPath);
                    if(data !== null) {
                        if(data === false) {
                            sendError(404, "Not found or can't get remote file");
                        } else {
                            response.write(data);
                            response.end();
                        }
                        //console.log('Asset found in cache: ' + fullPath);
                        return;
                    }
                }
                //sendError(404, "Not found or can't get remote file: ");
                //return;
                //console.log('Getting remote file: ' + fullPath);



                var oReq = new XMLHttpRequest();
                oReq.open("GET", fullPath, true);
                oReq.responseType = "arraybuffer";

                oReq.onreadystatechange = function (oEvent) {
                    if(oReq.readyState == 4) {
                        if(oReq.status == 200) {
                            var arrayBuffer = oReq.response; // Note: not oReq.responseText
                            if (arrayBuffer) {
                                var buffer = new Buffer( new Uint8Array(arrayBuffer) );
                                var mime = oReq.getResponseHeader('content-type');
                                if(mime) {
                                    mime = mime.split(';')[0];
                                }
                                onContentRead(buffer, mime);
                            }
                        } else {
                            sendError(404, "Not found or can't get remote file: " + fullPath);
                            if(crsaPage) {
                                crsaPage.addAsset(fullPath, false);
                            }
                        }
                    }
                };

                oReq.onerror = function (oEvent) {
                    sendError(404, "Not found or can't get remote file: " + fullPath, oEvent);
                    if(crsaPage) {
                        crsaPage.addAsset(fullPath, false);
                    }
                }

                oReq.send(null);

                return;




                r.get({url: fullPath, encoding: null, headers: {
                    'User-Agent': navigator.userAgent,
                    'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Encoding' : 'identity',
                    'Accept-Language' : 'en-US,en;q=0.8',
                    'Cache-Control' : 'max-age=0',
                    'Connection' : 'close',
                    'Cookie' : ''
                }
                }, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        var mime = null;
                        if('content-type' in response.headers) {
                            var a = response.headers['content-type'].split(';');
                            if(a.length) {
                                mime = a[0];
                                //console.log('Server mime = ' + mime);
                            }
                        }
                        if(crsaPage && referer) {
                            crsaPage.addAsset(fullPath, body);
                        }
                        onContentRead(body, mime);
                    } else {
                        sendError(404, "Not found or can't get remote file: " + error + ' ' + (response && response.statusMessage ? response.statusMessage : ''));
                        if(crsaPage) {
                            crsaPage.addAsset(fullPath, false);
                        }
                    }
                });


            } else {

              /*  libs.fs.exists(fullPath, function(exists){

                    if (exists) {*/
                        libs.fs.readFile(fullPath, function(error, data) {
                            //console.log('READ ' + fullPath);
                            if (!error){
                                onContentRead(data);
                                //console.log('SENT ' + fullPath);
                            } else {
                                sendError(404, "Not found - File " + fullPath + " can not be read by Pinegrow: " + error);
                                console.log('File ' + fullPath + ' can not be read by Pinegrow: ' + error);
                            }
                        });
              /*      } else {
                        sendError(404, "Not found - File " + fullPath + " can not be read by Pinegrow.");
                    }
                });*/
            }

        });

        var port_idx = 0;

        server.on('listening', function(e) {
            _this.testServer(function(status) {
                if(status_callback) {
                    status_callback(status, null, _this);
                }
            })
        });

        server.on('error', function (e) {
            console.log('Could not start internal http server.');

            if(port_idx < 20) {
                port_idx += 2;

                _this.url = 'http://' + config.host + ':' + (config.port + port_idx);
                _this.port = config.port + port_idx;
                server.listen(config.port + port_idx);
            } else {
                //pinegrow.alert('Could not start the internal webserver on port ' + config.port + '. Please make sure that the port is available and that connections are not blocked by a firewall. Use Support -> Settings to set the port.');

                if(status_callback) {
                    status_callback('NOT_STARTED', '<p><b>Could not start the internal webserver</b> on any of the ports in range <b>' + config.port + ' to ' + (config.port + 10) + '</b>.</p><p>The most likely reasons are:</p><ul><li> Another app is using these ports. Go to <b>Support -&gt; Settings</b> and change the value of the <b>Internal webserver port</b> setting.</li><li>Your firewall or anti-virus software is blocking Pinegrow from using these ports. In that case add a firewall rule that will allow Pinegrow to use the network port.</li></ul>', _this);
                }
            }
        });
        _this.port = config.port + port_idx;
        server.listen(config.port + port_idx);
    }
    catch(err) {

    }
}

var PgApiServer = function(port) {
    var io = require('socket.io')(port);

    this.addEndPoint = function(endpoint, on_connection) {
        return io
            .of('/' + endpoint)
            .on('connection', function (socket) {
                on_connection(socket);
            })
            .on('error', function(error) {
                console.log('Socket error ' + error);
            })
    }

    this.addEndPoint('core', function(socket) {
        var name = "Pinegrow";
        var project = pinegrow.getCurrentProject();
        if(project) name = project.getName();
        socket.emit('introduceInstance', {name: name, port: port});
    })
}
