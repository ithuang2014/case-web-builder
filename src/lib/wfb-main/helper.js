
function isApp() {
    return typeof process != 'undefined' && process.versions && ('node-webkit' in process.versions);
}

var CrsaProfile = function(enab) {
    var enabled = false;
    var start_ms;
    var elapsed = 0;
    var paused = false;

    if(enabled) {
        start_ms = (new Date()).getTime();
    }

    this.pause = function() {
        elapsed += (new Date()).getTime() - start_ms;
        paused = true;
    }

    this.resume = function() {
        start_ms = (new Date()).getTime();
        paused = false;
    }

    this.show = function(name) {
        if(enabled) {
            var elapsed_ms = paused ? elapsed : elapsed + (new Date()).getTime() - start_ms;
            console.log(name + ' took ' + elapsed_ms + ' ms');
        }
    }
}

function crsaIsFileUrl(url) {
    return url.indexOf('file:') == 0;
}

function crsaMakeUrlFromFile(file) {
    var f = 'file://';
    if(isApp()) {
        var path = require('path');
        if(file.match(/^[a-z]\:/i)) {
            //win, c://ppp
            file = '/' + file
        } else if(file.startsWith('\\\\')) {
            //win, //sfp/aaa/aaa
            file = file.substr(2);
        }
    }
    return f + encodeURI(file.replace(/\\/g, "/"));
}

function crsaMakeFileFromUrl(url, skip_remove_params) {
    if (!url) return '';
    if(isApp()) {
        var path = require('path');
        var f = path.sep == '/' ? 'file://' : 'file://';

        if(!skip_remove_params) {
            url = crsaRemoveUrlParameters(url);
        }
        if(!url.startsWith(f)) {
            //relative url
            return path.normalize(decodeURI(url.replace(/\//g, path.sep)));
        }
        url = url.replace(f, '');
        if(path.sep == '\\') {
            //win stuff
            if(url.startsWith('/')) {
                //win, c://ppp
                url = url.substr(1);
            } else {
                //win, \\spf\sdsd
                url = '//' + url;
            }
        }
        return path.normalize(decodeURI(url.replace(/\//g, path.sep)));
    } else {
        return crsaRemoveUrlParameters(url).replace('file://', '');
    }
}

function crsaIsAbsoluteUrl(url) {
    return url.indexOf('://') >= 0 || url.indexOf('//') === 0;
}

function crsaMakeUrlAbsolute(url) {
    if(url.match(/^[a-z]*:\/\//i)) return url;
    return crsaMakeUrlFromFile(crsaGetAppDir() + url);
}

function crsaGetNameFromUrl(url, def) {
    url = crsaRemoveUrlParameters(url);
    var n = url.split(/[\\\/]/).pop();
    if(n.length == 0) n = (def || '');
    var a = n.split('?');
    return a.length > 1 ? a[0] : n;
}

function crsaGetBaseForUrl(url) {
    if(!url) return url;
    url = crsaRemoveUrlParameters(url);
    var search_str;
    if (url.indexOf('\\') >= 0) search_str = '\\';
    else                   search_str = '/';
    var a = url.split(search_str);
    a.pop();
    return a.join('/');
}

function crsaGetAppDir() {
    if(isApp()) {
        return crsaGetBaseForUrl(crsaMakeFileFromUrl(nw.__dirname + "\\"));
    } else {
        return null;
    }
}

function crsaGetFileDir(file) {
    if(isApp()) {
        var path = require('path');
        var dir = path.dirname(file);
        if(dir.charAt(dir.length-1) != path.sep) dir += path.sep;
        return dir;
    }
    var a = file.split('/');
    var dir = '';
    if(a.length > 1) {
        a.splice(a.length-1,1);
        dir = a.join('/');
    }
    if(dir.charAt(dir.length-1) != '/') dir += '/';
    return dir;
}

function crsaRemoveUrlParameters(url) {
    var a = url.split(/[\?\#]/);
    return a.length > 0 ? a[0] : url;
}

function crsaIsFileOrDir(path, fs) {
    if(!isApp()) return false;

    try {
        if(!fs) fs = require('fs');
        var stat = fs.statSync(path);
        if(stat.isFile()) return 'file';
        if(stat.isDirectory()) return 'dir';
        return null;
    } catch(err) {
        return null;
    }
}

var cssHelperLink = document.createElement('a');

function crsaAppendQueryToUrl(url, queries) {
    cssHelperLink.href = url;
    if(cssHelperLink.search) cssHelperLink.search += '&';
    cssHelperLink.search += queries.join('&');
    return cssHelperLink.href;
}

function crsaIsInEdit() {
    return false;
}

function crsaRemoveScripts(str, replace_with) {
    if(str && str.indexOf('<?') >= 0) {
        str = str.replace(/<\?.*?\?>/g, replace_with || '');
    }
    return str;
}

function crsaAddCancelSearch($input, style) {
    var $cancel = $('<a/>', {class: 'cancel-search', href: '#'}).html('&times;').appendTo($input.parent()).on('click', function(e) {
        e.preventDefault();
        $input.val('').trigger('input');
    });
    $input.on('input', function() {
        var val = $input.val();
        if(val && val.length) {
            $cancel.show();
            $input.addClass('has-value');
        } else {
            $cancel.hide();
            $input.removeClass('has-value');
        }
    })
    $cancel.hide();
    if(style) $cancel.attr('style', style);
}

function removeCrsaClassesFromHtml(str) {
    var rr = /\s*crsa\-[a-z\-]*/g;
    //.replace(/\sdata\-pg\-id="[0-9]*"/g,'')
    //str = str.replace(/\sdata\-pg\-tree\-id="[0-9]+"/g, '');
    return str.replace(/class=".*"/g, function(m) {
        return m.replace(rr, '')
    }).replace(/(<[^>]*?)\s*class\=['"]\s*['"]/ig, '$1');
    //return str.replace(/(<[^>]*?)\s*crsa\-[a-z\-]*/ig,'$1').
}



function getIframeDocument(iframe) {
    return iframe.contentDocument || iframe.contentWindow.document;
}

function getIframeOfElement($el) {
    var r = null;
    if(!$el || $el.length == 0) return null;
    var od = $el.get(0).ownerDocument;
    $('iframe.content-iframe').each(function(i,iframe) {
        var doc = getIframeDocument(iframe);
        if(doc == od) {
            r = $(iframe);
            return false;
        }
    });
    return r;
}

function getCrsaPageOfElement($el) {
    var $iframe = getIframeOfElement($el);
    return $iframe ? getCrsaPageForIframe($iframe) : null;
}

function getPageName(url) {
    var n = url.split(/[\\\/]/).pop();
    if(n.length == 0) n = 'index.html';
    var a = n.split('?');
    n = a.length > 1 ? a[0] : n;
    if(!n.length) n = 'index.html';
    return n;
}

function getCrsaPageForIframe($iframe) {
    if(!$iframe) return null;
    return $iframe.data('crsa-page');
}

function getIframeHead(iframe) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    var head  = doc.getElementsByTagName('head')[0];
    return head;
}

function getIframeBody(iframe) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    return doc.body;
}

function getObjectFromElement($el) {
    return $el && $el.length > 0 ? {type : 'element', data : $el} : null;
}

function escapeHtmlCode(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getUniqueId(pref, page, prev) {
    var start = 0;
    if(typeof prev != 'undefined') {
        prev = "" + prev;
        start = parseInt(prev.replace(/[a-z]*/i, ''));
    }
    if(!page) page = service.getSelectedPage();
    debugger;
    var $html = page ? page.get$Html() : null;
    if(!pref) pref = 'crsa_id_';
    var c = prev ? start : gen_id_count;
    while(true) {
        c++;
        var nid = pref + c;
        if($html) {
            if($html.find('#' + nid).length == 0) {
                if(!prev) gen_id_count = c;
                return nid;
            }
        } else {
            if($('#' + nid).length == 0) {
                if(!prev) gen_id_count = c;
                return nid;
            }
        }
    }
}

function getType($e, evaluate, fast, crsaPage, pgel) {
    if(typeof evaluate == 'undefined') evaluate = false;
    var t = null;

    //special case - pgel is set, no $e - happens in batch updates, in non editable files
    if(!$e && pgel) {
        $.each(crsaPage.getComponentTypes(), function(i,def) {
            var isType = false;

            if(def.not_main_type) return true;

            if(def.selector_tag) {
                isType = pgel.tagName === def.selector_tag;
            } else if(typeof def.selector == 'function') {
                //isType = def.selector($e); <-- skip this, these functions expect $e
            } else if(def.selector) {
                isType = pgel.isSelector(def.selector);
            }

            if(isType) {
                t = def;
                return false;
            }
            return true;
        });
        return t;
    }

    if(!evaluate) {
        t = $e.data('crsa-def');
        if(t) return t;
        if(t === false) return null;
    }
    if(fast) return null;

    if(!pgel) {
        pgel = getElementPgNode($e);
    }

    if(!crsaPage) {
        crsaPage = getCrsaPageForIframe(getIframeOfElement($e));
        //console.log('no crsapage');
    }

    if(!crsaPage) {
        //console.log("El has no page " + $e.get(0));
        return null;
    }
    t = crsaPage.getMainType($e, pgel, true, false);
    /*
     $.each(crsaPage.getComponentTypes(), function(i,def) {
     var isType = ;

     if(def.not_main_type) return true;

     if(def.selector_tag) {
     isType = $e.get(0).tagName === def.selector_tag;
     } else if(typeof def.selector == 'function') {
     isType = def.selector($e);
     } else if(def.selector) {
     isType = $e.is(def.selector, pgel);
     }

     if(isType) {
     t = def;
     return false;
     }
     return true;
     });
     */
    if(t) {
        $e.data('crsa-def', t !== null ? t : false);
    }

    return t;
}

function getElementName($e, def, html, get_cls, get_text, show_tag, action_tag, crsaPage) {
    var node = $e.get(0);

    if(!$e || !node) {
        return def ? def.name : "Element";
    }
    if(!def) def = getType($e);

    if(!def) {
        return node.tagName + ' (unknown)';
    }
    var name = null;
    if(def.display_name && typeof def.display_name == 'function') {
        name = def.display_name($e, def);
    } else {
        var t;
        if(get_text) {
            //t = $e.text().substring(0,30);
            t = '';
            var text_done = false;
            //debugger;
            if(node.tagName == 'META') {
                var meta_name = node.getAttribute('name');
                var meta_content = node.getAttribute('content');
                if(meta_name) {
                    t = meta_name + '="' + (meta_content || '') + '"';
                } else {
                    if(node.attributes.length) {
                        t = node.attributes[0].nodeName + '="' + node.attributes[0].nodeValue + '"';
                    }
                }
                text_done = true;
            } else if(node.tagName == 'LINK') {
                t = service.getOriginalUrl((node.getAttribute('href') || ''));
                text_done = true;
            }  else if(node.tagName == 'SCRIPT') {
                var src = node.getAttribute('src');
                if(src) {
                    t = service.getOriginalUrl(src);
                    text_done = true;
                } else {
                    t = node.innerText || '';
                }
            }
            if(!text_done) {
                for(var ci = 0; ci < node.childNodes.length; ci++) {
                    if(node.childNodes[ci].nodeType == 3) {
                        t += $.trim(node.childNodes[ci].textContent);
                        if(t.length) {
                            t = t.substring(0,30);
                            break;
                        }
                    }
                }
            }
            if(t.length) t = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }
        name = def.name;

        if(node.tagName == 'HTML' && crsaPage) {
            name = crsaPage.name;
        } else {

            var tag = node.nodeName.toLowerCase();
            if(show_tag || def.display_name == 'tag') {
                name = tag;
            } else if(show_tag && name.toLowerCase() != tag) {
                name += ' (' + tag + ')';
            }
        }
        var pg_name = node.getAttribute('data-pg-name');
        if(pg_name) name = pg_name;

        var id = node.id;
        if(id) name += html ? '<span class="name-id">' + "#" + escapeHtmlCode(id) + '</span>' : "#" + escapeHtmlCode(id);

        if(get_cls) {
            ///debugger;
            var cls_count = 0;
            var first_cls = null;
            var all_cls = '';

            if(node.classList.length > 0) {
                for(var i = 0; i < node.classList.length; i++) {
                    if(node.classList[i].startsWith('crsa') || node.classList[i].startsWith('pgc-') || node.classList[i].startsWith('pg-')) continue;
                    cls_count++;
                    var cls = escapeHtmlCode(node.classList[i]);
                    if(cls_count === 1) first_cls = cls;
                    all_cls += '.' + cls;

                }
                if(cls_count > 0) {
                    name += html ? '<span class="name-text"' + (cls_count > 1 ? ' title="' + all_cls  + '"' : '') + '>' + '.' + first_cls + (cls_count > 1 ? '&hellip;' : '') + '</span>' : '.' + first_cls + (cls_count > 1 ? '&hellip;' : '');
                }

            }
            /*
            var cls = node.className;
            if(cls) {
                //cls = cls.replace(/\s*crsa\-[a-z\-]*    /ig,'');
                cls = cls.replace(/\s\s+/g,'').replace(/\s/ig,'.');
                if(cls && cls.length > 0) name += html ? '<span class="name-text">' + '.' + escapeHtmlCode(cls) + '</span>' : '.' + escapeHtmlCode(cls);
            }
            */
        }
        if(action_tag) name = name + ' | ' + (html ? '<span class="name-at">' + action_tag + '</span>' : action_tag);
        if(t) name = name + ' | ' + (html ? '<span class="name-text">' + t + '</span>' : t);
    }
    return name;
}

function getClosestCrsaElement($el) {
    var def = getType($el);
    while($el && $el.length > 0 && def === null) {
        $el = $el.parent();
        def = getType($el);
    }
    if(def) return $el;
    return $();
}

function crsaChooseFile(doneFunc, save_as, multiple, working_dir, folder) {
    var $fileInput = $('<input style="display:none;" type="file"/>').appendTo($('body'));
    
    if(multiple) {
        $fileInput.attr('multiple', '');
    }

    var using_project_working_dir = false;
    if(!working_dir) {
        working_dir = service.getWorkingDir();

        using_project_working_dir = true;
    }

    if(working_dir) {
        if(!working_dir.endsWith('\\')) {
            working_dir += '\\';
        }
        if(save_as) {
            save_as = require('path').join(working_dir, save_as);
        }
        $fileInput.attr('nwworkingdir', working_dir);
    }

    if(folder) {
        $fileInput.attr('nwdirectory', '');
    }

    if(save_as) {
        $fileInput.attr('nwsaveas', save_as);
    } else {
        $fileInput.removeAttr('nwsaveas');
    }

    $fileInput.on('change', function(evt) {
        var files = $(this).val();

        var url = !multiple ? crsaMakeUrlFromFile(files) : files;


        if(files && files.length > 0) {

            doneFunc(url, files);
        }
        $fileInput.remove();
    });

    $fileInput.trigger('click');
}

function crsaCreateDirs(path, fs) {
    if(crsaIsFileOrDir(path, fs)) return false;
    var mkdirp = require('mkdirp');
    mkdirp.sync(path);
    return true;

    var pm = require('path');
    if (!fs) fs = require('fs');
    if(crsaIsFileOrDir(path, fs)) return false;
    var a = path.split(pm.sep);
    var p = '';
    for(var i = 0; i < a.length; i++) {
        if(a[i].length == 0) {
            p += pm.sep;
            continue;
        }
        p += a[i] + pm.sep;
        if(!crsaIsFileOrDir(p, fs)) {
            fs.mkdirSync(p);
        }
    }
    return true;
}

function crsaCopyFileSync(fs, source, dest, filter_func) {
    if(!fs) fs = require('fs');
    if(filter_func) {
        var text = fs.readFileSync(source, {encoding: 'utf8'});
        text = filter_func(text);
        fs.writeFileSync(dest, text, {encoding: 'utf8'});
    } else {
        var data = fs.readFileSync(source);
        fs.writeFileSync(dest, data);
    }
}

function crsaWriteFileWithBackup(fs, file, data, enc) {

    if(!fs) fs = require('fs');
    var path = require('path');
    console.log(file);
    console.log(crsaIsFileOrDir(file, fs));
    if(crsaIsFileOrDir(file, fs) == 'file') {
        if(service.getSetting('backup', '1') == '1') {
        }
    } else {
        var paths = crsaGetFileDir(file);
        crsaCreateDirs(paths, fs);
    }
    //console.log('writing file ' + file);
    fs.writeFileSync(file, data, enc);
}

function pgRemoveMultiselects($el) {
    $el.find('.crsa-input[data-autocomplete]').each(function (i, elm) {
        var autoComplete = $(elm).data('pg-autocomplete')
        autoComplete.remove(true);
        $(elm).data('pg-autocomplete', autoComplete = null);
    });
}

var splitCssValue = function(v, comma_as_token) {
    var r = [];
    if(!v || v.length == 0) return r;
    v = v + " \n";
    var token = '';
    var in_exp = false;
    var operands = "+-/*";
    var space = false;
    var par_level = 0;
    var quote_level = 0;

    for(var i = 0; i < v.length; i++) {
        var ch = v.charAt(i);
        if(ch == ' ') {
            space = true;
        } else {
            if(comma_as_token && ch == ',' && par_level == 0 && quote_level == 0) {
                r.push($.trim(token));
                space = false;
                token = '';
                r.push(',');
                continue;
            } else if(space && par_level == 0 && quote_level == 0) {
                r.push($.trim(token));
                space = false;
                token = '';
            }
            if(ch == '(') {
                par_level++;
            } else if(ch == ')') {
                par_level--;
            } else if(ch == '"' || ch == '\'') {
                quote_level = quote_level == 0 ? 1 : 0;
            }
        }
        token = token + ch;
    }
    token = $.trim(token);
    if(token.length > 0 && token != "\n") {
        r.push(token);
    }
    return r;
}

var crsaMakeLinkRelativeTo = function(link, parent) {
    var re = /^[a-z:]*\/+/i;

    var m_link = link.match(re);
    if(!m_link) return link;
    var link_prot = m_link[0];

    var m_parent = parent.match(re);
    if(!m_parent) return link;
    var parent_prot = m_parent[0];

    if(link_prot.toLowerCase() != parent_prot.toLowerCase()) return link;

    var a = link.replace(re, '').split('/');
    var p = parent.replace(re, '').split('/');

    var i = 0;
    while(i < a.length && i < p.length && a[i] == p[i]) {
        i++;
    }
    if(i == 0) {
        //cant make relative
        return link;
    } else {
        a.splice(0, i);
        if(p.length > i+1) {
            for(var n = 0; n < p.length - i - 1; n++) {
                a.unshift('..');
            }
        }
        var rel = a.join('/');
        if(rel.indexOf('../..') >= 0) {
            return link; //too many backpaddles
        }
        return rel;
    }
}

function crsaGetSummaryStr (str, n, front) {
    n = n || 40;
    if (str.length <= n) return str;
    if(front) {
        return str.substr(0, n) + '...';
    } else {
        return '...' + str.substr(str.length - n, n);
    }
    //MT2MHD: the middle part is more importnt than beginning
    if (str.length < n*2) return str;
    return str.substr(0, n) + '...' + str.substr(str.length - n, str.length-1);
}

function crsaHtmlEncode(s) {
  var el = document.createElement("div");
  el.innerText = el.textContent = s;
  s = el.innerHTML;
  return s;
}

function crsaSplitCSSValue(v) {
    if(v === null) return v;
    if(typeof v != 'string') v += 'px';

    var m = v.match(/^([0-9\.]+)([a-z\%]*)$/);
    return m ? {value: parseFloat(m[1]), unit: m[2].toLowerCase() || 'px'} : null;
}

function crsaOneUpCSSValue(cv, down) {
    if(typeof down == 'undefined') down = 1;
    var breakpoints_units = {
        'px': 1,
        'em': 0.0625,
        'rem': 0.0625,
        'pt': 1
    }
    if(cv) {
        var a = cv.unit in breakpoints_units ? breakpoints_units[cv.unit] : 1;
        return {value: cv.value + down * a, unit: cv.unit};
    }
    return cv;
}

function makeDialog(title, cancel, ok, body) {
    if(typeof body == 'undefined') body = '';
    var bstr = typeof body == 'string' ? body : '';

    var html = '<div class="modal-content">\
                <div class="modal-header">\
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>\
                    <h4 class="modal-title">' + title + '</h4>\
                </div>\
                <div class="modal-body">' + bstr + '\
                </div>\
                <div class="modal-footer"><p class="pull-left"></p>';
    if(cancel) {
        html += '<button type="button" class="btn btn-default btn-sm cancel">' + cancel + '</button>';
    }
    if(ok) {
        html += '<button type="button" class="btn btn-primary btn-sm ok">' + ok + '</button>';
    }
    html += '</div>\
            </div>';

    var $d = $('<div/>', {class: "modal-dialog crsa-dialog-nonmodal"}).html(html);
    if(typeof body == 'object') {
        $d.find('.modal-body').append(body);
    }
    return $d;
}

function crsaHandleExternalLinks($d, func) {
    if(isApp()) {
        $d.find('a.external').on('click', function(e) {
            e.preventDefault();

            var gui = require('nw.gui');
            var url = $(e.delegateTarget).attr('href');
            gui.Shell.openExternal(url);

            if(func) func(url);
        });
    }
}

function showAlert(body, title, cancel, ok, onCancel, onOk) {
    if(!title) title = "Notice";
    if(!ok && !cancel) ok = "OK";
    var $d = makeModalDialog(title, cancel, ok, body, onCancel, onOk);
    crsaHandleExternalLinks($d);
    return $d;
}

function makeModalDialog(title, cancel, ok, body, onCancel, onOk, onBeforeShow) {
    if(typeof body == 'function') body = body();
    var $d = makeDialog(title, cancel, ok, body);
    $d.removeClass('crsa-dialog-nonmodal');

    var userChosed = false;

    var $o = $('<div/>', {class: 'modal fade', tabIndex: "-1", role: "dialog"}).append($d);
    $o.find('button.close,button.cancel').click(function() {
        if(onCancel) onCancel();
        onCancel = null;
        $o.modal('hide');
    });
    $o.find('button.ok').click(function() {
        if(onOk) onOk();
        $o.modal('hide');
        userChosed = true;
    });
    $o.on('hidden.bs.modal', function () {
        if(!userChosed && onCancel) onCancel();
        $o.remove();
    })
    if(onBeforeShow) onBeforeShow($o);
    $o.modal({backdrop: true});
    return $o;
}

var PgChooseFile = function(done, options) {
    options = options || {parent_url: null, save_as: null, folder: null, no_proxy: false, no_url: false};

    crsaChooseFile(function(url, file) {
        var setUrl = function() {
            if(fdef.file_picker_quotes && url) url = '"' + url + '"';

            if(fdef.file_picker_no_url) url = file;

            $input.val(url).trigger('change');
        }

        var parent_url = options.parent_url || null;
        if(parent_url) {
            if(crsaIsFileUrl(parent_url)) {
                var project = service.getCurrentProject();
                var outside_of_project = project && project.isUrlInProject(parent_url) && !project.isFileInProject(file);

                url = crsaMakeLinkRelativeTo(url, parent_url);

                if(!options.no_proxy) url = service.getProxyUrl(url);

                if((crsaIsAbsoluteUrl(url) || outside_of_project) && !options.no_url) {
                    service.showAlert("<p>Location of the file doesn't let us use a relative url. This can cause url to break when you upload the page to a server or if you open the page in a browser while service is not running.</p><p>Would you like to copy the file in the same folder (or subfolder of folder) where your HTML page is located? Then service can create relative urls that will work from wherever you open the page.</p>", "The file is not located in the project folder", 'No, use absolute link', 'Yes, copy the file', function() {
                        //use as is
                        done(url, file);
                    }, function() {
                        //copy
                        //debugger;

                        var folder = crsaMakeFileFromUrl(crsaGetBaseForUrl(parent_url));
                        var project_info;
                        if(project) {
                            project_info = project.getProjectInfo();
                            folder = project_info.getSetting('file-picker-copy-folder') || folder;
                        }
                        crsaChooseFile(function(new_url, new_file) {
                            if(new_file != file) {
                                try {
                                    crsaCopyFileSync(null, file, new_file);
                                    file = new_file;
                                    url = crsaMakeLinkRelativeTo(new_url, parent_url);
                                    if (crsaIsAbsoluteUrl(url)) {
                                        url = service.getProxyUrl(url);
                                    }
                                    done(url, file);

                                    if(project_info) {
                                        project_info.setSetting('file-picker-copy-folder', require('path').dirname(new_file));
                                        project_info.save();
                                    }
                                } catch(err) {
                                    service.showAlert('Could not copy file: ' + err, 'Error');
                                }
                            }
                        }, crsaGetNameFromUrl(url), null, /* folder */ folder);
                    });
                } else {
                    done(url, file);
                }
            } else {
                if(!options.no_proxy) url = service.getProxyUrl(url);
                done(url, file);
            }
        } else {
            done(url, file);
        }
    }, /* save as */ options.save_as || null, null, null, options.folder || false);
}

function crsaGetNameFromUrl(url, def) {
    url = crsaRemoveUrlParameters(url);
    var n = url.split(/[\\\/]/).pop();
    if(n.length == 0) n = (def || '');
    var a = n.split('?');
    return a.length > 1 ? a[0] : n;
}
